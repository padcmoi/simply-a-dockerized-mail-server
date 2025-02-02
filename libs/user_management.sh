#!/bin/bash

_userManagementCalculateUserDomainMailUsage() {
    local queries=(
        "SELECT COUNT(id) FROM VirtualDomains"
        "SELECT SUM(messages) FROM VirtualQuotaUsers"
        "SELECT SUM(quota) FROM VirtualDomains"
        "SELECT SUM(bytes) FROM VirtualQuotaUsers"
    )
    local variables=(
        "countVirtualDomains"
        "countTotalMessagesVirtualDomains"
        "countTotalQuotaVirtualDomains"
        "countTotalCurrentQuotaVirtualDomains"
    )
    local results=""

    # set these variables
    countVirtualDomains=0
    countTotalMessagesVirtualDomains=0
    countTotalQuotaVirtualDomains=0
    countTotalCurrentQuotaVirtualDomains=0
    countVirtualAliases=0
    countVirtualUsers=0
    countTotalUsedBytesByDomain=0
    countTotalUsedMessagesByDomain=0
    countTotalUsedBytesByRecipient=0
    countTotalUsedMessagesByRecipient=0

    if [ $currentDomain ]; then
        queries+=(
            "SELECT COUNT(id) FROM VirtualAliases WHERE domain='$currentDomain'"
            "SELECT COUNT(id) FROM VirtualUsers WHERE domain='$currentDomain'"
            "SELECT SUM(bytes) FROM VirtualQuotaUsers WHERE domain='$currentDomain'"
            "SELECT SUM(messages) FROM VirtualQuotaUsers WHERE domain='$currentDomain'"
        )
        variables+=(
            "countVirtualAliases"
            "countVirtualUsers"
            "countTotalUsedBytesByDomain"
            "countTotalUsedMessagesByDomain"
        )
    fi

    if [ $currentRecipient ]; then
        queries+=(
            "SELECT SUM(bytes) FROM VirtualQuotaUsers WHERE email='$currentRecipient'"
            "SELECT SUM(messages) FROM VirtualQuotaUsers WHERE email='$currentRecipient'"
        )
        variables+=(
            "countTotalUsedBytesByRecipient"
            "countTotalUsedMessagesByRecipient"
        )
    fi

    for i in "${!queries[@]}"; do
        deadLoopCount=0
        while true; do
            results=$(_mysqlExec "${queries[$i]}" list)
            eval "${variables[$i]}=\$(_cleanMysqlValue \"\$results\")"
            _isInteger "${!variables[$i]}"
            [[ $? -eq 0 ]] && break
            [[ $deadLoopCount -gt 3 ]] && break
            ((deadLoopCount++))
        done
    done
}

_userManagementAddRecipient() {
    local currentDomain="${1}"
    local newEmail="${2}"
    local password="${3}"
    local quota="${4}"
    local enabled="${5}"
    if [[ "$enabled" != "1" && "$enabled" != "0" ]]; then
        echo -e "${COLOR_RED}Invalid value for enabled. It must be 1 or 0.${COLOR_DEFAULT}"
        return 1
    fi

    local hashedPassword=""
    local escapedPassword=""
    local maildir=""
    local results=""

    if [[ "$quota" =~ ^[0-9]+$ ]] && [ "$quota" -ge 1 ]; then
        if [[ "$newEmail" != *"@$currentDomain" ]]; then
            echo -e "${COLOR_RED}The email address must belong to the domain $currentDomain. Please try again.${COLOR_DEFAULT}"
            continue
        fi

        _isValidEmail "$newEmail"
        if [ $? -eq 0 ]; then
            results=$(_mysqlExec "SELECT email FROM VirtualUsers WHERE email='$newEmail'")
            if [ -z "$results" ]; then
                hashedPassword=$(_dockerExec "doveadm pw -s SHA512-CRYPT -p \"$password\" | sed 's/{SHA512-CRYPT}//'")
                escapedPassword=$(echo "$hashedPassword" | sed 's/\$/\\$/g')
                escapedPassword=$(_trim "$escapedPassword")

                maildir="$currentDomain/${newEmail%@*}/"

                results=$(_mysqlExec "INSERT INTO VirtualUsers SET domain='$currentDomain', email='$newEmail', password='$escapedPassword', maildir='$maildir', quota='$(_convertToBytes "$quota")', active='$enabled', user_start_date=NOW()-INTERVAL 1 DAY")
                if [ -z "$results" ]; then
                    _mysqlExec "REPLACE INTO VirtualQuotaUsers SET domain='$currentDomain', email='$newEmail';"

                    echo -e "Email address ($newEmail) created successfully"

                    return 0
                else
                    echo "Error:"
                    echo "$results"
                fi
            else
                echo -e "${COLOR_RED}The email address already exists. Please try again.${COLOR_DEFAULT}"
            fi
        else
            echo -e "${COLOR_RED}Invalid email address. Please try again.${COLOR_DEFAULT}"
        fi
    else
        echo -e "${COLOR_RED}Invalid quota. Please enter a number between 1 and 20000.${COLOR_DEFAULT}"
    fi

    return 1
}

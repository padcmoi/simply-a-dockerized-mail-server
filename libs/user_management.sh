#!/bin/bash

_userManagementResetVariables() {
    # Define default variables
    diskAvailableDockerVolume=0
    disRemainingDockerVolume=0

    countVirtualDomains=0
    countMessagesWrittenInVirtualDomains=0
    countAllocableQuotasInVirtualDomains=0
    countQuotasUsedInVirtualDomains=0

    countVirtualAliasesPerVirtualDomain=0
    countVirtualUsersPerVirtualDomain=0
    calculateTotalBytesConsumedPerVirtualDomain=0
    CalculateTotalMessagesConsumedPerVirtualDomain=0
    quotasAllocatedPerVirtualDomains=0
    countQuotasAllocatedPerVirtualDomain=0

    calculateTotalBytesConsumedPerVirtualRecipient=0
    CalculateTotalMessagesConsumedPerRecipient=0
    countQuotasAllocatedPerRecipient=0

    virtualRecipientStatus="0"
}

_userManagementCalculateUserDomainMailUsage() {

    _userManagementResetVariables

    DOCKER_VOLUMES=$(_trimQuotes $(grep -oP '(?<=DOCKER_VOLUMES=).*' "$ENV_TARGET"))
    diskAvailableDockerVolume=$(_convertHumanReadableToBytes $(df -h $DOCKER_VOLUMES | awk 'NR==2 {print $4}'))

    local queries=(
        "SELECT COUNT(id) FROM VirtualDomains"
        "SELECT SUM(messages) FROM VirtualQuotaUsers"
        "SELECT SUM(quota) FROM VirtualDomains"
        "SELECT SUM(bytes) FROM VirtualQuotaUsers"
    )
    local variables=(
        "countVirtualDomains"
        "countMessagesWrittenInVirtualDomains"
        "countAllocableQuotasInVirtualDomains"
        "countQuotasUsedInVirtualDomains"
    )
    local results=""

    if [ $currentDomain ]; then
        queries+=(
            "SELECT COUNT(id) FROM VirtualAliases WHERE domain='$currentDomain'"
            "SELECT COUNT(id) FROM VirtualUsers WHERE domain='$currentDomain'"
            "SELECT SUM(bytes) FROM VirtualQuotaUsers WHERE domain='$currentDomain'"
            "SELECT SUM(messages) FROM VirtualQuotaUsers WHERE domain='$currentDomain'"
            "SELECT quota FROM VirtualDomains WHERE domain='$currentDomain'"
            "SELECT SUM(quota) FROM VirtualUsers WHERE domain='$currentDomain'"
        )
        variables+=(
            "countVirtualAliasesPerVirtualDomain"
            "countVirtualUsersPerVirtualDomain"
            "calculateTotalBytesConsumedPerVirtualDomain"
            "CalculateTotalMessagesConsumedPerVirtualDomain"
            "quotasAllocatedPerVirtualDomains"
            "countQuotasAllocatedPerVirtualDomain"
        )
    fi

    if [ $currentRecipient ]; then
        queries+=(
            "SELECT SUM(bytes) FROM VirtualQuotaUsers WHERE email='$currentRecipient'"
            "SELECT SUM(messages) FROM VirtualQuotaUsers WHERE email='$currentRecipient'"
            "SELECT SUM(quota) FROM VirtualUsers WHERE email='$currentRecipient'"
        )
        variables+=(
            "calculateTotalBytesConsumedPerVirtualRecipient"
            "CalculateTotalMessagesConsumedPerRecipient"
            "countQuotasAllocatedPerRecipient"
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

    diskRemainingDockerVolume=$((diskAvailableDockerVolume - countAllocableQuotasInVirtualDomains))

    virtualRecipientStatus=$(_cleanMysqlValue "$(_mysqlExec "SELECT active FROM VirtualUsers WHERE email='$currentRecipient';" list)")
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

                results=$(_mysqlExec "INSERT INTO VirtualUsers SET domain='$currentDomain', email='$newEmail', password='$escapedPassword', maildir='$maildir', quota='$(_convertMBToBytes "$quota")', active='$enabled', user_start_date=NOW()-INTERVAL 1 DAY")
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
        echo -e "${COLOR_RED}Invalid quota. Please enter a number minimum 1 MByte.${COLOR_DEFAULT}"
    fi

    return 1
}

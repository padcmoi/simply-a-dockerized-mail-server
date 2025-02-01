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
        while true; do
            results=$(_mysqlExec "${queries[$i]}" list)
            eval "${variables[$i]}=\$(_cleanMysqlValue \"\$results\")"
            _isInteger "${!variables[$i]}"
            [[ $? -eq 0 ]] && break
        done
    done
}

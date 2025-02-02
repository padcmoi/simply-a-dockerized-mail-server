#!/bin/bash

_managementToolPostfix() {
    while true; do
        headerPart
        mailserver=$?

        if _dockerExec "ps aux | grep -v grep | grep '/usr/lib/postfix' >/dev/null"; then
            servicePostfix=0
        else
            servicePostfix=1
        fi

        echo -e "${COLOR_CYAN}"
        echo -e " -------------------- POSTFIX ------------------- ${COLOR_DEFAULT}"

        echo -e "${COLOR_BLUE}0) Main menu${COLOR_DEFAULT}"
        if [ $servicePostfix -eq 0 ]; then
            echo -e "1) See tail"
            echo -e "2) Flush the queue"
            echo -e "3) View content of mail in queue"
            echo -e "4) Delete a specific mail with a queueId"
            echo -e "5) Delete all queued mails"
            echo -e "6) Delete all mails in « Deferred »"
            echo -e "7) Delete mail in queue by sender or recipient"
        fi

        [[ $servicePostfix -eq 0 ]] && echo -e "9) Switch off Postfix (Stop receiving mail)"
        [[ $servicePostfix -eq 1 ]] && echo -e "9) Switch on Postfix"

        echo -e "   $(_uppercase "Special commands")"
        echo -e "X) See which domains have a lot of deferred incoming mail"
        echo -e "C) See which domains have a lot of active outgoing mail"

        read -n1 -e -p "Please choose a number: [0-9,X,C] " choice

        case $choice in
        0) break ;;
        1)
            if [ $servicePostfix -eq 0 ]; then
                clear && _dockerExec "mailq" && _confirm "Press any key to continue" 1
            fi
            ;;
        2)
            if [ $servicePostfix -eq 0 ]; then
                _confirm "Do you confirm this action ?"
                if [ $? -eq 0 ]; then
                    clear && _dockerExec "postfix flush" && _confirm "Press any key to continue" 1
                else
                    echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
                fi
            fi
            ;;
        3)
            if [ $servicePostfix -eq 0 ]; then
                read -e -p "Provide me with the queue identifier " queueId
                clear && _dockerExec "postcat -q $queueId" && _confirm "Press any key to continue" 1
            fi
            ;;
        4)
            if [ $servicePostfix -eq 0 ]; then
                _confirm "Do you confirm this action ?"
                if [ $? -eq 0 ]; then
                    read -e -p "Provide me with the queue identifier " queueId
                    clear && _dockerExec "postsuper -d $queueId" && _confirm "Press any key to continue" 1
                else
                    echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
                fi
            fi
            ;;
        5)
            if [ $servicePostfix -eq 0 ]; then
                _confirm "Do you confirm this action ?"
                if [ $? -eq 0 ]; then
                    clear && _dockerExec "postsuper -d ALL" && _confirm "Press any key to continue" 1
                else
                    echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
                fi
            fi
            ;;
        6)
            if [ $servicePostfix -eq 0 ]; then
                _confirm "Do you confirm this action ?"
                if [ $? -eq 0 ]; then
                    clear && _dockerExec "postsuper -d ALL deferred" && _confirm "Press any key to continue" 1
                else
                    echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
                fi
            fi
            ;;
        7)
            if [ $servicePostfix -eq 0 ]; then
                _confirm "Do you confirm this action ?"
                if [ $? -eq 0 ]; then
                    echo -e ""
                    echo -e "Delete mails from the queue according to sender or recipient:"
                    echo -e "1) Sender"
                    echo -e "2) Recipient"
                    echo -e ""
                    read -n1 -e -p "Please choose a number: [1-2] " orig
                    case $orig in
                    1) rule="Sender" ;;
                    2) rule="Recipient" ;;
                    *) rule="Recipient" ;;
                    esac

                    read -e -p "Provide me an email " email

                    clear && _dockerExec "mailq | tail -n+2 | awk 'BEGIN { RS = \"\" } { if ($rule == \"$email\")print $1 }' | tr -d '*!' | postsuper -d -"
                    _confirm "Press any key to continue" 1
                else
                    echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
                fi

            fi
            ;;
        x | X)
            if [ $servicePostfix -eq 0 ]; then
                clear && echo -e "See which domains have a lot of deferred incoming mail:"
                _dockerExec "qshape deferred" && _confirm "Press any key to continue" 1
            fi
            ;;
        c | C)
            if [ $servicePostfix -eq 0 ]; then
                clear && echo -e "See which domains have a lot of active outgoing mail:"
                _dockerExec "qshape -s active" && _confirm "Press any key to continue" 1
            fi
            ;;
        9)
            [[ $servicePostfix -eq 0 ]] && _dockerExec "service postfix stop"
            [[ $servicePostfix -eq 1 ]] && _dockerExec "service postfix start"
            sleep 1
            ;;

        esac
    done
}

_managementToolFail2ban() {
    while true; do
        headerPart
        mailserver=$?

        if _dockerExec "ps aux | grep -v grep | grep 'fail2ban-server' >/dev/null"; then
            serviceFail2ban=0
        else
            serviceFail2ban=1
        fi

        jailsList=($(_dockerExec "fail2ban-client status" | grep 'Jail list:' | cut -d ':' -f2 | tr -d ' ' | tr ',' ' '))

        echo -e "${COLOR_CYAN}"
        echo -e " ------------------- FAIL2BAN ------------------- ${COLOR_DEFAULT}"

        echo -e "${COLOR_BLUE}0) Main menu${COLOR_DEFAULT}"
        if [ $serviceFail2ban -eq 0 ]; then
            echo -e "1) Status"
            echo -e "2) Status of all jails"
            echo -e "3) Status of a specific jail"
            echo -e "4) Unban an IP"
            echo -e "5) Ban an IP"
            echo -e "6) List all banned IPs"
            echo -e "7) Unban all IPs"
        fi

        [[ $serviceFail2ban -eq 0 ]] && echo -e "9) Switch off Fail2ban"
        [[ $serviceFail2ban -eq 1 ]] && echo -e "9) Switch on Fail2ban"

        read -n1 -e -p "Please choose a number: [0-9] " choice

        case $choice in
        0) break ;;
        1)
            if [ $serviceFail2ban -eq 0 ]; then
                clear && _dockerExec "fail2ban-client status" && _confirm "Press any key to continue" 1
            fi
            ;;
        2)
            if [ $serviceFail2ban -eq 0 ]; then
                clear && _dockerExec "fail2ban-client status" && _confirm "Press any key to continue" 1
            fi
            ;;
        3)
            if [ $serviceFail2ban -eq 0 ]; then
                # read -e -p "Provide the jail name " jailName

                echo -e "Available jails: ${jailsList[*]}"
                while true; do
                    read -e -p "Provide the jail name: " jail
                    if [[ " ${jailsList[*]} " == *" $jail "* ]]; then
                        break
                    else
                        echo -e "${COLOR_RED}Invalid jail name. Please choose from the available jails.${COLOR_DEFAULT}"
                    fi
                done

                clear && _dockerExec "fail2ban-client status $jailName" && _confirm "Press any key to continue" 1
            fi
            ;;
        4)
            if [ $serviceFail2ban -eq 0 ]; then
                read -e -p "Provide the IP to unban " ip

                echo -e "Available jails: ${jailsList[*]}"
                while true; do
                    read -e -p "Provide the jail name: " jail
                    if [[ " ${jailsList[*]} " == *" $jail "* ]]; then
                        break
                    else
                        echo -e "${COLOR_RED}Invalid jail name. Please choose from the available jails.${COLOR_DEFAULT}"
                    fi
                done

                _dockerExec "fail2ban-client set $jail unbanip $ip"
                _confirm "Press any key to continue" 1
            fi
            ;;
        5)
            if [ $serviceFail2ban -eq 0 ]; then
                read -e -p "Provide the IP to ban " ip

                echo -e "Available jails: ${jailsList[*]}"
                while true; do
                    read -e -p "Provide the jail name: " jail
                    if [[ " ${jailsList[*]} " == *" $jail "* ]]; then
                        break
                    else
                        echo -e "${COLOR_RED}Invalid jail name. Please choose from the available jails.${COLOR_DEFAULT}"
                    fi
                done

                _dockerExec "fail2ban-client set $jail banip $ip"
                _confirm "Press any key to continue" 1
            fi
            ;;
        6)
            if [ $serviceFail2ban -eq 0 ]; then
                clear && _dockerExec "fail2ban-client banned" && _confirm "Press any key to continue" 1
            fi
            ;;
        7)
            if [ $serviceFail2ban -eq 0 ]; then
                _confirm "Do you confirm this action ?"
                if [ $? -eq 0 ]; then
                    clear && _dockerExec "fail2ban-client unban --all" && _confirm "Press any key to continue" 1
                else
                    echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
                fi
            fi
            ;;
        9)
            [[ $serviceFail2ban -eq 0 ]] && _dockerExec "service fail2ban stop"
            [[ $serviceFail2ban -eq 1 ]] && _dockerExec "service fail2ban start"
            sleep 1
            ;;
        esac
    done
}

_managementRecipients() {

    cancelAction="***CANCEL***"

    currentDomain="example.local"
    currentRecipient="user@example.local"
    currentAlias=""

    _userManagementResetVariables

    while true; do
        clear

        __headerCurrentPart() {
            # headerPart
            echo -e "DETAILS: "
            [ -n "$currentDomain" ] && echo -e "Currently selected domain: ${currentDomain}"
            [ -n "$currentRecipient" ] && echo -e "Currently selected recipient: ${currentRecipient}"
            [ -n "$currentAlias" ] && echo -e "Currently selected alias: ${currentAlias}"
        }

        echo -e " ------------------- RECIPIENTS ------------------- "

        #
        # MESSAGES
        #

        if [ $currentAlias ]; then

            __part() {
                __headerCurrentPart
                _mysqlExec "SELECT source, destination FROM VirtualAliases WHERE source='$currentAlias'"
                echo -e " "
            }

            list=(
                "Deselect this alias ($currentAlias)"
                "Delete this alias ($currentAlias)"
            )
            _menuSelection "index" "$(__part)" "${list[@]}"

        elif [ $currentRecipient ]; then

            _userManagementCalculateUserDomainMailUsage

            __part() {
                __headerCurrentPart
                echo -e "Quota used [Current/Maximum]: $(_convertBytesToMB "$calculateTotalBytesConsumedPerVirtualRecipient" 1)/$(_convertBytesToMB "$countQuotasAllocatedPerRecipient" 1)"
                echo -e "Messages: $CalculateTotalMessagesConsumedPerRecipient"
                echo -e "Last activity: $(_mysqlExec "SELECT last_activity FROM VirtualQuotaUsers WHERE email='$currentRecipient';" list)"
                echo -e " "
            }

            list=(
                "Deselect this recipient ${currentRecipient}"
                "Modify the quota of ${currentRecipient}"
                "Change the password of ${currentRecipient}"
                "Deactivate this recipient ${currentRecipient}"
                "Delete this recipient ${currentRecipient}"
            )
            _menuSelection "index" "$(__part)" "${list[@]}"

        elif [ $currentDomain ]; then

            _userManagementCalculateUserDomainMailUsage

            __part() {
                __headerCurrentPart
                echo -e " "
                echo -e "Quota allocated [Current/Maximum]: $(_convertBytesToMB "$countQuotasAllocatedPerVirtualDomain" 1)/$(_convertBytesToMB "$quotasAllocatedPerVirtualDomains" 1)"
                echo -e "Remaining quota: $(_convertBytesToMB $((quotasAllocatedPerVirtualDomains - countQuotasAllocatedPerVirtualDomain)) 1)"
                [[ $countQuotasAllocatedPerVirtualDomain -gt $quotasAllocatedPerVirtualDomains ]] && echo -e "${COLOR_RED}Quota exceed${COLOR_DEFAULT}"

                echo -e "Recipients: $countVirtualUsersPerVirtualDomain"
                echo -e "Aliases: $countVirtualAliasesPerVirtualDomain"
                echo -e "Total used bytes for $currentDomain: $(_convertBytesToMB "$calculateTotalBytesConsumedPerVirtualDomain" 1)"
                echo -e "Total used messages for $currentDomain: $CalculateTotalMessagesConsumedPerVirtualDomain"
                echo -e " "
            }

            list=(
                "Deselect the domain ${currentDomain}"
                "Select a recipient for this domain ${currentDomain}"
                "List all recipients for a domain ${currentDomain}"
                "Add a recipient for this domain ${currentDomain}"
                "Select an alias for this domain ${currentDomain}"
                "List all aliases for a domain ${currentDomain}"
                "Add an alias for this domain ${currentDomain}"
                "View DKIM public key for this domain ${currentDomain}"
                "Renew DKIM key for this domain ${currentDomain}"
                "Modify the quota of this domain ${currentDomain}"
                "Delete this domain ${currentDomain} and corresponding DKIM key"
            )

            _menuSelection "index" "$(__part)" "${list[@]}"

        else

            _userManagementCalculateUserDomainMailUsage

            __part() {
                __headerCurrentPart
                echo -e "Domains: $countVirtualDomains"
                echo -e "Quota [Current/Maximum/%]: $(_convertBytesToMB "$countQuotasUsedInVirtualDomains" 1) / $(_convertBytesToMB "$countAllocableQuotasInVirtualDomains" 1) / $(_displayPercentage $countQuotasUsedInVirtualDomains $countAllocableQuotasInVirtualDomains)"
                echo -e "Current remaining disk space: $(_convertBytesToMB "$diskAvailableDockerVolume" 1)"
                echo -e "Remaining disk space with virtual domain allocation: $(_convertBytesToMB "$diskRemainingDockerVolume" 1)"
                echo -e "Total messages: $countMessagesWrittenInVirtualDomains"
                echo -e " "
            }

            list=(
                "Main menu"
                "Select a domain"
                "Add a domain"
            )
            _menuSelection "index" "$(__part)" "${list[@]}"

        fi

        choice="${__menuSelectionValue}"

        #
        # ACTIONS
        #
        if [ $currentAlias ]; then

            case $choice in
            0) currentAlias="" ;;
            1)
                _confirm "Do you confirm the deletion of this alias ($currentAlias)?"
                if [ $? -eq 0 ]; then
                    results=$(_mysqlExec "DELETE FROM VirtualAliases WHERE source='$currentAlias'" list)
                    echo -e "Alias ($currentAlias) deleted successfully"
                    currentAlias=""
                else
                    echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
                fi
                ;;
            esac

        elif [ $currentRecipient ]; then

            case $choice in
            0) currentRecipient="" ;;
            1)
                curQuota=$((countQuotasAllocatedPerRecipient / 1048576))
                oldValue=$((curQuota * 1048576))
                RemainingQuota=$((quotasAllocatedPerVirtualDomains - countQuotasAllocatedPerVirtualDomain))
                maxAttributable=$((RemainingQuota + countQuotasAllocatedPerRecipient - 1048576))
                clear
                while true; do
                    echo -e "Max value allowed: $(_convertBytesToMB "$maxAttributable" 1 "MB" 1)"

                    while true; do
                        read -e -p "Change the current quota (in MB): " -i "$curQuota" curQuota
                        if [[ "$curQuota" =~ ^[0-9]+$ ]]; then
                            break
                        else
                            echo -e "${COLOR_RED}Invalid input. Please enter an integer value.${COLOR_DEFAULT}"
                        fi
                    done

                    curQuotaConverted=$((curQuota * 1048576))
                    calcul=$((curQuotaConverted - oldValue))

                    if [ "$calcul" -le "$RemainingQuota" ]; then
                        break
                    else
                        clear && echo -e "${COLOR_RED}The new quota exceeds the total domain quota. Please enter a smaller value.${COLOR_DEFAULT}"
                    fi
                done

                _mysqlExec "UPDATE VirtualUsers SET quota=$((${curQuota} * 1048576)) WHERE email='$currentRecipient'"
                echo -e "Quota updated successfully"
                ;;
            2) ;;
            3) ;;
            4) ;;
            esac

        elif [ $currentDomain ]; then

            case $choice in
            0) currentDomain="" ;;
            1)
                results=$(_mysqlExec "SELECT email FROM VirtualUsers WHERE domain='$currentDomain'" list)
                results=("$cancelAction" $(echo $results))

                _menuSelection "text" "Select a recipient:" "${results[@]}"

                currentRecipient="$(_cleanMysqlValue "${__menuSelectionValue}")"
                [[ "$currentRecipient" == "$cancelAction" ]] && currentRecipient=""

                ;;
            2)
                clear && _mysqlExec "
                    SELECT 
                        U.email, CAST(VirtualQuotaUsers.bytes / 1048576 AS INT) AS current_quota_mb, CAST(U.quota / 1048576 AS INT) AS max_quota_mb, 
                        U.active, U.user_start_date, VirtualQuotaUsers.last_activity AS last_change
                    FROM VirtualUsers AS U
                    INNER JOIN VirtualQuotaUsers ON U.email = VirtualQuotaUsers.email
                    WHERE U.domain='$currentDomain';
                "
                _confirm "Press any key to continue" 1
                ;;
            3)
                newRecipient="" && password="" && quota=0
                while true; do
                    [[ $countQuotasAllocatedPerVirtualDomain -gt $quotasAllocatedPerVirtualDomains ]] && echo -e "${COLOR_CYAN}Quota exceed action cancelled" && break
                    while true; do
                        read -e -p "New email address (without domain): " -i "$newRecipient" newRecipient
                        if [ -z "$newRecipient" ]; then
                            echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
                            break 2
                        fi
                        if [[ "$newRecipient" == *"@"* ]]; then
                            echo -e "${COLOR_RED}The email address should not contain the '@' symbol. Please try again.${COLOR_DEFAULT}"
                        else
                            break
                        fi
                    done
                    newEmail="${newRecipient}@${currentDomain}"
                    read -e -p "Password: " -i "$password" password
                    if [ -z "$password" ]; then
                        echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
                        break
                    fi

                    # Check quota remaining ...
                    RemainingQuota=$((quotasAllocatedPerVirtualDomains - countQuotasAllocatedPerVirtualDomain))
                    while true; do
                        echo -e "Remaining quota: $(_convertBytesToMB $RemainingQuota 1)"

                        while true; do
                            read -e -p "Quota (in MB): " -i "$quota" quota
                            if [[ "$quota" =~ ^[0-9]+$ ]]; then
                                break
                            else
                                echo -e "${COLOR_RED}Invalid input. Please enter an integer value.${COLOR_DEFAULT}"
                            fi
                        done

                        curQuotaConverted=$((quota * 1048576))

                        if [ "$curQuotaConverted" -le "$RemainingQuota" ]; then
                            break
                        else
                            echo -e "${COLOR_RED}The new quota exceeds the total domain quota. Please enter a smaller value.${COLOR_DEFAULT}"
                        fi
                    done

                    _userManagementAddRecipient "${currentDomain}" "${newEmail}" "${password}" "${quota}" "1"
                    response=$?
                    [[ $response -eq 0 ]] && break
                done

                _confirm "Press any key to continue" 1
                ;;
            4)
                results=$(_mysqlExec "SELECT source FROM VirtualAliases WHERE domain='$currentDomain'" list)
                results=("$cancelAction" $(echo $results))

                _menuSelection "text" "Select an alias:" "${results[@]}"

                currentAlias="$(_cleanMysqlValue "${__menuSelectionValue}")"
                [[ "$currentAlias" == "$cancelAction" ]] && currentAlias=""
                ;;
            5)
                clear && _mysqlExec "SELECT source, destination FROM VirtualAliases WHERE domain='$currentDomain'"
                _confirm "Press any key to continue" 1
                ;;
            6)
                sourceWithoutDomain="" && destination=""
                while true; do
                    while true; do
                        read -e -p "New alias (without domain): " -i "$sourceWithoutDomain" sourceWithoutDomain

                        if [ -z "$sourceWithoutDomain" ]; then
                            echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
                            break
                        fi

                        if [[ "$sourceWithoutDomain" == *"@"* ]]; then
                            echo -e "${COLOR_RED}The alias should not contain the '@' symbol. Please try again.${COLOR_DEFAULT}"
                        else
                            source="${sourceWithoutDomain}@${currentDomain}"
                            break
                        fi
                    done

                    _isValidEmail "$source"
                    if [ $? -ne 0 ]; then
                        echo -e "${COLOR_RED}Invalid domain for alias. Please try again.${COLOR_DEFAULT}"
                        continue
                    fi

                    if [[ "$source" != *"@$currentDomain" ]]; then
                        echo -e "${COLOR_RED}The alias must belong to the domain $currentDomain. Please try again.${COLOR_DEFAULT}"
                        continue
                    fi

                    results=$(_mysqlExec "SELECT source FROM VirtualAliases WHERE source='$source'")
                    if [ ! -z "$results" ]; then
                        echo -e "${COLOR_RED}The alias already exists. Please try again.${COLOR_DEFAULT}"
                        continue
                    fi

                    while true; do
                        read -e -p "Destination email: " -i "$destination" destination
                        if [ -z "$destination" ]; then
                            echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
                            break 2
                        fi
                        _isValidEmail "$destination"
                        if [ $? -ne 0 ]; then
                            echo -e "${COLOR_RED}Invalid domain for destination email. Please try again.${COLOR_DEFAULT}"
                            continue
                        fi

                        if [ "$destination" == "$source" ]; then
                            echo -e "${COLOR_RED}Destination email cannot be the same as the source email. Please try again.${COLOR_DEFAULT}"
                            continue
                        fi

                        results=$(_mysqlExec "SELECT source FROM VirtualAliases WHERE source='$destination'")
                        if [ ! -z "$results" ]; then
                            echo -e "${COLOR_RED}It is not possible to point a destination to an existing source. Please try again.${COLOR_DEFAULT}"
                            continue
                        fi

                        # add alias to db
                        results=$(_mysqlExec "INSERT INTO VirtualAliases SET domain='$currentDomain', source='$source', destination='$destination'")
                        if [ -z "$results" ]; then
                            echo -e "Alias added successfully"
                        else
                            echo "Error:"
                            echo "$results"
                        fi

                        _confirm "Press any key to continue" 1

                        break 2
                    done

                done

                ;;
            7)
                clear
                _dockerExec "cat /etc/opendkim/keys/$currentDomain/public_key-*.txt "
                _confirm "Press any key to continue" 1
                ;;
            8)
                _confirm "Do you confirm this action ?"
                if [ $? -eq 0 ]; then
                    _dockerExec "/usr/local/bin/dkim-create.sh \"$currentDomain\" force"
                    echo -e "DKIM key renewed"
                    _confirm "Press any key to continue" 1
                fi
                ;;

            9)
                curQuota=$((quotasAllocatedPerVirtualDomains / 1048576))
                oldValue=$((curQuota * 1048576))
                maxAttributable=$((diskRemainingDockerVolume + quotasAllocatedPerVirtualDomains))
                while true; do
                    while true; do
                        echo -e "Max value allowed: $(_convertBytesToMB "$maxAttributable" 1 "MB" 1)"
                        read -e -p "Change the current quota (in MB): " -i "$curQuota" curQuota
                        if [ -z "$curQuota" ]; then
                            echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
                            break 2
                        fi

                        if [[ "$curQuota" =~ ^[0-9]+$ ]]; then
                            break
                        else
                            echo -e "${COLOR_RED}Invalid input. Please enter an integer value.${COLOR_DEFAULT}"
                        fi
                    done

                    curQuotaConverted=$((curQuota * 1048576))
                    calcul=$((curQuotaConverted - oldValue))

                    if [ "$calcul" -le "$diskRemainingDockerVolume" ]; then
                        _mysqlExec "UPDATE VirtualDomains SET quota='$curQuotaConverted' WHERE domain='$currentDomain'"
                        echo -e "Quota updated successfully"
                        _confirm "Press any key to continue" 1
                        break
                    else
                        clear && echo -e "${COLOR_RED}The new quota exceeds the total domain quota. Please enter a smaller value.${COLOR_DEFAULT}"
                    fi
                done
                ;;

            10)
                _confirm "Do you confirm this action ?"
                if [ $? -eq 0 ]; then

                    _userManagementCalculateUserDomainMailUsage

                    echo -e " "
                    if [[ "$countVirtualAliasesPerVirtualDomain" -gt 0 ]] || [[ "$countVirtualUsersPerVirtualDomain" -gt 0 ]]; then
                        echo "This domain has $countVirtualUsersPerVirtualDomain recipients and $countVirtualAliasesPerVirtualDomain aliases"
                        _confirm "This action will delete all recipients and aliases for this domain. Do you want to proceed?"
                        if [ $? -ne 0 ]; then
                            echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
                            continue
                        fi
                        echo -e " "
                    fi

                    _countdownTimer
                    if [ "$?" -eq 0 ]; then
                        echo -e "\nProceeding with the action..."
                        _dockerExec "/usr/local/bin/dkim-delete.sh \"$currentDomain\""
                        _mysqlExec "DELETE FROM VirtualDomains WHERE domain='$currentDomain'"
                        _dockerExec "rm -Rf /var/mail/vhosts/$currentDomain"
                        echo "Domain and dkim key $currentDomain deleted"
                        currentDomain=""
                    fi

                    _confirm "Press any key to continue" 1
                fi
                ;;

            esac

        else
            case $choice in
            0) break ;;
            1)
                results=$(_mysqlExec "SELECT domain FROM VirtualDomains" list)
                results=("$cancelAction" $(echo $results))

                _menuSelection "text" "Select a domain:" "${results[@]}"

                currentDomain="$(_cleanMysqlValue "${__menuSelectionValue}")"
                [[ "$currentDomain" == "$cancelAction" ]] && currentDomain=""
                ;;
            2)
                domainQuota=$MENU_SELECTION_DEFAULT_QUOTA_MB && newDomain=""
                while true; do
                    while true; do
                        read -e -p "Name of the new domain: " -i "$newDomain" newDomain
                        if [ -z "$newDomain" ]; then
                            echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
                            break 2
                        fi

                        while true; do
                            while true; do
                                echo -e "Max value attributable: $(_convertBytesToMB "$diskRemainingDockerVolume" 1 "MB" 1)"
                                read -e -p "Domain quota: (Megabytes) " -i "$domainQuota" domainQuota
                                if [ -z "$domainQuota" ]; then
                                    echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
                                    break 4
                                fi
                                break
                            done
                            domainQuotaBytes=$(_convertMBToBytes "$domainQuota")
                            if [ "$domainQuotaBytes" -le "$diskRemainingDockerVolume" ]; then
                                break
                            else
                                echo -e "${COLOR_RED}Domain quota cannot exceed the remaining disk space. Please enter a smaller value.${COLOR_DEFAULT}"
                            fi
                        done

                        if [[ "$domainQuota" =~ ^[0-9]+$ ]] && [ "$domainQuota" -ge 1 ]; then
                            _isValidDomain "$newDomain" 1
                            if [ $? -eq 0 ]; then
                                results=$(_mysqlExec "SELECT domain FROM VirtualDomains WHERE domain='$newDomain'")
                                if [ -z "$results" ]; then
                                    break
                                else
                                    echo -e "${COLOR_RED}Error: The domain ($newDomain) already exists.${COLOR_DEFAULT}"
                                fi
                            fi
                        else
                            echo -e "${COLOR_RED}Invalid quota. Please enter a number minimum 1 MByte.${COLOR_DEFAULT}"
                        fi
                    done

                    currentDomain="$(_lowercase "$newDomain")"

                    results=$(_mysqlExec "INSERT INTO VirtualDomains SET domain='$currentDomain', active=1, quota='$(_convertMBToBytes "$domainQuota")', user_start_date=NOW()-INTERVAL 1 DAY")

                    if [ -z "$results" ]; then
                        echo -e "Domain ($currentDomain) added"

                        passwordRandom=$(tr -dc A-Za-z0-9 </dev/urandom | head -c 12)
                        _userManagementAddRecipient "${currentDomain}" "root@${currentDomain}" "${passwordRandom}" "1" "0"
                        _mysqlExec "REPLACE INTO VirtualQuotaDomains SET domain='$currentDomain';"

                        _confirm "Now you will create the DKIM key, Press any key to continue" 1
                        _dockerExec "/usr/local/bin/dkim-create.sh \"$currentDomain\" force"
                    else
                        echo "Error:"
                        echo "$results"
                    fi

                    _confirm "Press any key to continue" 1
                    break
                done
                ;;
            esac

        fi

    done
}

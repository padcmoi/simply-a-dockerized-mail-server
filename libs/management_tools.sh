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

        jailsList=(
            "apache-auth" "apache-badbots" "apache-botsearch" "apache-fakegooglebot" "apache-modsecurity" "apache-nohome" "apache-noscript" "apache-overflows" "apache-shellshock" "dovecot" "postfix"
        )

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

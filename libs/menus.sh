#!/bin/bash

headerPart() {
    clear && echo -e "${COLOR_CYAN} -------------------- STATUS -------------------- ${COLOR_DEFAULT}"
    source $ENV_MENU_TARGET

    echo "LOGGED IN WITH: $(whoami)"
    sudo df -h /

    _checkDependencies

    [[ -f $ENV_TARGET ]] && local stateEnv=🟢
    [[ ! -f $ENV_TARGET ]] && local stateEnv=🔴
    [[ -f $ENV_MAKEFILE ]] && local stateMade=🟢
    [[ ! -f $ENV_MAKEFILE ]] && local stateMade=🟠
    [[ -f $ENV_MENU_TARGET ]] && local stateEnvMenu=🟢
    [[ ! -f $ENV_MENU_TARGET ]] && local stateEnvMenu=🔴

    echo "ENVIRONMENTS: .env: $stateEnv | .env.file_tmp: $stateMade | .env.menu: $stateEnvMenu"
    [[ -f $ENV_NEWFILE ]] && echo -e "${COLOR_YELLOW}A NEW ENVIRONMENT FILE HAS BEEN CREATED. YOU MUST BUILD IT BEFORE STARTING THE CONTAINER.${COLOR_DEFAULT}"

    _helloContainer 1
    mailserver=$?

    _checkLetsencryptProcessRunning 1

    lastDate=$(_findMostRecentBackupDate 1)
    [[ $(_countBackupFiles) -eq 0 ]] && lastDate="NO BACKUP !"
    backupStatus=🔴
    _checkLatestBackup $MENU_BACKUP_TOO_OLD
    [[ $? -eq 0 ]] && backupStatus=🟢
    echo -e "BACKUP STATUS: $backupStatus (last: $lastDate | Total performed: $(_countBackupFiles) | Check latest: $(_checkLatestBackup $MENU_BACKUP_TOO_OLD 1))"
    echo -e "BACKUP FOLDER: $MENU_BACKUP_FOLDER"

    if [ $mailserver -eq 0 ]; then
        echo -e "${COLOR_CYAN}"
        _dockerExec "uptime"
        _dockerExec "services.sh"
    fi

    return $mailserver
}

mainMenu() {
    while true; do

        headerPart
        mailserver=$?

        echo -e "${COLOR_CYAN}"
        echo -e " ------------ SIMPLY MAILSERVER MENU ------------ ${COLOR_DEFAULT}"

        echo -e "${COLOR_BLUE}0) Quit${COLOR_DEFAULT}"
        [[ -f $ENV_NEWFILE ]] && [[ -f $ENV_TARGET ]] && echo -e "${COLOR_YELLOW}4) Build${COLOR_DEFAULT}"

        if [[ ! -f $ENV_NEWFILE ]] && [[ -f $ENV_TARGET ]]; then
            [[ $mailserver -eq 1 ]] && echo -e "1) Start Mailserver"
            [[ $mailserver -eq 0 ]] && echo -e "1) Stop Mailserver"
            [[ $mailserver -eq 0 ]] && echo -e "2) Open console"
            [[ $mailserver -eq 0 ]] && echo -e "3) Display logs"
            [[ $mailserver -eq 1 ]] && echo -e "4) Build"
            [[ $mailserver -eq 0 ]] && echo -e "5) Management tools"
        fi
        [[ -f $ENV_TARGET ]] && echo -e "6) Third party"

        [[ $mailserver -eq 1 ]] && echo -e "8) Configuration"

        echo -e "   $(_uppercase "Special commands")"
        echo -e "   Menu configuration, PRESS X"
        [[ $mailserver -eq 1 ]] && echo -e "   Update mailserver, PRESS U"

        # PROMPT
        read -n1 -e -p "Please choose a number: [0-9,X,U] " choice

        case $choice in
        0) _leaveMenu && break ;;
        1) _startStopContainer ;;
        2) [[ ! -f $ENV_NEWFILE ]] && [[ $mailserver -eq 0 ]] && [[ -f $ENV_TARGET ]] && clear && _dockerExec "bash" ;;
        3) [[ ! -f $ENV_NEWFILE ]] && [[ $mailserver -eq 0 ]] && [[ -f $ENV_TARGET ]] && _logsContainer ;;
        4) [[ $mailserver -eq 1 ]] && [[ -f $ENV_TARGET ]] && _buildContainer ;;
        5) [[ $mailserver -eq 0 ]] && [[ -f $ENV_TARGET ]] && managementToolsMenu ;;
        6) [[ -f $ENV_TARGET ]] && thirdPartyMenu ;;

        8) [[ $mailserver -eq 1 ]] && environmentMenu ;;

        u | U) [[ $mailserver -eq 1 ]] && _updateMailserver && break ;;
        x | X) menuConfiguration ;;

        *) ;;
        esac

    done

}

menuConfiguration() {
    while true; do

        headerPart
        mailserver=$?

        echo -e "${COLOR_CYAN}"
        echo -e " --------------- MENU CONFIGURATION ------------- ${COLOR_DEFAULT}"

        echo -e "${COLOR_BLUE}0) Main menu${COLOR_DEFAULT}"

        [[ -f $ENV_MENU_TARGET ]] && echo -e "1) Modify from menu environment file (Env.Menu > Tmp)"
        [[ -f $ENV_MENU_TARGET ]] && echo -e "2) Reset menu environment (Env.Menu file)"

        read -n1 -e -p "Please choose a number: [0-9] " choice

        case $choice in
        0) break ;;

        1) [[ -f $ENV_MENU_TARGET ]] && _configureEnvFile "menu" ;;
        2)
            echo -e "${COLOR_YELLOW}"
            _confirm "Do you confirm the deletion of the environment file ? this will delete all settings."
            if [ $? -eq 0 ]; then
                sudo rm $ENV_MENU_TARGET
                sudo cp -f $ENV_MENU_SAMPLE $ENV_MENU_TARGET
            else
                echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
            fi
            echo -e "${COLOR_DEFAULT}"
            ;;
        esac

    done
}

environmentMenu() {
    while true; do

        headerPart
        mailserver=$?

        echo -e "${COLOR_CYAN}"
        echo -e " ----------- ENVIRONMENT CONFIGURATION ---------- ${COLOR_DEFAULT}"

        echo -e "${COLOR_BLUE}0) Main menu${COLOR_DEFAULT}"
        [[ ! -f $ENV_TARGET ]] && echo -e "1) Create from sample (Sample > Tmp)"
        [[ -f $ENV_TARGET ]] && echo -e "2) Modify from env file (Env > Tmp)"
        [[ -f $ENV_TARGET ]] && echo -e "3) Delete env file (Env file)"
        [[ -f $ENV_MAKEFILE ]] && echo -e "4) Modify temporary file (Tmp > Tmp)"
        [[ -f $ENV_MAKEFILE ]] && echo -e "5) Delete temporary file (Tmp file)"
        [[ -f $ENV_MAKEFILE ]] && echo -e "6) Save in env file (Tmp > Env)"

        read -n1 -e -p "Please choose a number: [0-9] " choice

        case $choice in
        0) break ;;
        1) [[ ! -f $ENV_TARGET ]] && _configureEnvFile "sample" ;;
        2) [[ -f $ENV_TARGET ]] && _configureEnvFile "env" ;;
        3)
            echo -e "${COLOR_YELLOW}"
            _confirm "Do you confirm the deletion of the environment file ? this will delete all settings."
            if [ $? -eq 0 ]; then
                sudo rm $ENV_TARGET
            else
                echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
            fi
            echo -e "${COLOR_DEFAULT}"
            ;;
        4) [[ -f $ENV_MAKEFILE ]] && _configureEnvFile "made" ;;
        5)
            echo -e "${COLOR_YELLOW}"
            _confirm "Do you confirm the deletion of the temporary environment file ?"
            if [ $? -eq 0 ]; then
                sudo rm $ENV_MAKEFILE
            else
                echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
            fi
            echo -e "${COLOR_DEFAULT}"
            ;;
        6)
            echo -e "${COLOR_YELLOW}"
            _confirm "Do you confirm that you want to save the new settings? This will overwrite the old ones definitively."
            if [ $? -eq 0 ]; then
                cat $ENV_MAKEFILE | sudo tee $ENV_TARGET >/dev/null
                sudo rm $ENV_MAKEFILE && sudo touch $ENV_NEWFILE
                _fixEnvPermissionsAndClean
            else
                echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
            fi
            echo -e "${COLOR_DEFAULT}"
            ;;
        *) ;;
        esac

    done
}

thirdPartyMenu() {
    while true; do
        headerPart
        mailserver=$?

        echo -e "${COLOR_CYAN}"
        echo -e " --------------- THIRD PARTY MENU --------------- ${COLOR_DEFAULT}"

        echo -e "${COLOR_BLUE}0) Main menu${COLOR_DEFAULT}"
        echo -e "1) use certbot-generated certificates (letsencrypt) to update ssl certificates"
        echo -e "2) backup volumes now"
        echo -e "9) deletes all docker images (Be careful, this command deletes other docker images)"

        read -n1 -e -p "Please choose a number: [0-9] " choice

        case $choice in
        0) break ;;
        1) _thirdPartyMenuCertbotLe ;;
        2) _thirdPartyMenuBackup && sleep 3 ;;
        9) sudo docker system prune -a --volumes ;;
        esac
    done
}

managementToolsMenu() {
    while true; do
        headerPart
        mailserver=$?

        echo -e "${COLOR_CYAN}"
        echo -e " --------------- MANAGEMENT TOOLS --------------- ${COLOR_DEFAULT}"

        echo -e "${COLOR_BLUE}0) Main menu${COLOR_DEFAULT}"
        echo -e "1) POSTFIX"
        echo -e "2) FAIL2BAN"
        echo -e "3) RECIPIENTS"

        read -n1 -e -p "Please choose a number: [0-9] " choice

        case $choice in
        0) break ;;
        1) _managementToolPostfix ;;
        2) _managementToolFail2ban ;;
        3) _managementRecipients ;;

        esac
    done
}

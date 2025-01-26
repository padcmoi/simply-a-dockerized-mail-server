#!/bin/bash

# source ./docker-build/scripts/services.sh

# _configureEnvFile ("env" | "made" | "sample" | "menu")
_configureEnvFile() {

    # Memo, todo
    # hash password with openssl available on all distrib
    # echo -n "password" | openssl dgst -sha512

    case "${1}" in
    env)
        sudo cat $ENV_TARGET | sudo tee $ENV_TMPFILE >/dev/null
        _updateTmpWithSampleFile
        ;;
    made)
        sudo cat $ENV_MAKEFILE | sudo tee $ENV_TMPFILE >/dev/null
        _updateTmpWithSampleFile
        ;;
    sample)
        sudo cat $ENV_SAMPLE | sudo tee $ENV_TMPFILE >/dev/null
        _updateTmpWithSampleFile
        ;;
    menu)
        sudo cat $ENV_MENU_TARGET | sudo tee $ENV_TMPFILE >/dev/null
        ;;
    *)
        echo "error unknow instruction for _configureEnvFile: ${1}"
        exit 1
        ;;
    esac

    previousKey="" # set a previousKey (see utils/description function)

    for key in $(cat $ENV_TMPFILE | grep -E '^[^#]*=' | sed 's/=\(.*\)//'); do
        value=$(grep "^$key=" $ENV_TMPFILE | cut -d '=' -f2-)
        local type=$(_findTypeValue "${value}")
        value=$(_escapeDoubleQuote "${value}")

        skipNextValue=false
        newValue=

        _displayCurrentDescription "${ENV_TMPFILE}" "${previousKey}" "${key}" 1 1

        checkInDescription=$(_displayCurrentDescription "${ENV_TMPFILE}" "${previousKey}" "${key}" 0 0)

        case $type in
        string)

            # Rule Yes or No
            if $(_checkWordInText "$checkInDescription" "{{{rule:YES_OR_NO}}}"); then
                while true; do
                    skipNextValue=true

                    echo -e "please press Y (for yes) or N (for no) or D for default value"
                    read -p "$key: (currently to $value) [Y/N/D] " -n1 -r
                    reply=$REPLY

                    if [[ $reply =~ ^[Yy]$ ]]; then
                        value=yes
                        break
                    elif [[ $reply =~ ^[Nn]$ ]]; then
                        value=no
                        break
                    elif [[ $reply =~ ^[Dd]$ ]]; then
                        echo -e "Default value kept to: ${value}"
                        break
                    fi

                    _displayCurrentDescription "${ENV_TMPFILE}" "${previousKey}" "${key}" 1 1
                    echo -e "Please make a choice between the listed keys below"
                done
            fi

            # Folder with create rule
            if $(_checkWordInText "$checkInDescription" "{{{rule:FOLDER_CREATE}}}"); then
                while true; do
                    echo -e "Please provide a folder where the current user ($(whoami)) has permissions"

                    read -e -p "$key: " -i "${value}" newValue

                    value=$newValue

                    if [ -w "$(dirname "$newValue")" ]; then
                        echo -e "This folder seems valid: $newValue"
                        [[ -d $newValue ]] && echo "NOTE: The folder isn't empty" #TODO fix this rule doesnt check correctly
                        [[ ! -d $newValue ]] && echo "NOTE: The folder doesnt exist and will be created"
                        echo -e ""
                        _confirm "Do you want to use this folder?"
                        if [ $? -eq 0 ]; then
                            echo -e ""
                            [[ ! -d $newValue ]] && sudo mkdir -p "${newValue}"
                            break
                        fi
                    fi

                    _displayCurrentDescription "${ENV_TMPFILE}" "${previousKey}" "${key}" 1 1
                    [[ ! -w "$(dirname "$newValue")" ]] && echo -e "${COLOR_BLUE}This folder isnt valid or doesnt have permissions: $newValue${COLOR_DEFAULT}"

                done

                skipNextValue=true
            fi

            # Define a valid password rule
            if $(_checkWordInText "$checkInDescription" "{{{rule:PASSWORD}}}"); then

                passwordLength=20

                while true; do

                    [[ $passwordLength -lt $MIN_PASSWORD_LENGTH ]] && passwordLength=$MIN_PASSWORD_LENGTH

                    while true; do
                        PASSWORD_GEN=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c $passwordLength)

                        _checkPassword $MIN_PASSWORD_LENGTH "${PASSWORD_GEN}" true
                        if [ $? -eq 0 ]; then
                            break
                        fi
                    done

                    echo -e ""
                    echo -e "It seems this should contain a password, may I suggest this one: (${passwordLength} chars)"
                    echo -e "${COLOR_CYAN}${PASSWORD_GEN}${COLOR_DEFAULT}"
                    echo -e ""

                    [[ "${1}" == "env" ]] && echo -e "${COLOR_BLUE}0) I'd like to keep my old password${COLOR_DEFAULT}"
                    echo -e "1) I'll choose for myself"
                    echo -e "2) Ok, I'd like another"
                    echo -e "3) Ok, I choose this one"
                    echo -e "4) I'd like a stronger password"
                    echo -e "5) I'd like a weaker password"

                    [[ "${1}" == "env" ]] && read -n1 -e -p "Please choose a number: [0-5] " choice
                    [[ ! "${1}" == "env" ]] && read -n1 -e -p "Please choose a number: [1-5] " choice

                    case $choice in
                    0)
                        if [ "${1}" == "env" ]; then
                            skipNextValue=true
                            break
                        fi
                        ;;
                    1)
                        value=
                        break
                        ;;
                    3)
                        value=$PASSWORD_GEN
                        skipNextValue=true
                        break
                        ;;
                    4)
                        passwordLength=$((passwordLength + 1))
                        ;;
                    5)
                        passwordLength=$((passwordLength - 1))
                        ;;
                    esac

                    _displayCurrentDescription "${ENV_TMPFILE}" "${previousKey}" "${key}" 1 1
                done
            fi

            if [ $skipNextValue == false ]; then
                # Check string value
                while true; do
                    if [[ "${key}" == *"PASSWORD"* ]] || [[ "${key}" == *"password"* ]]; then
                        read -e -p "$key: " -i "${newValue}" newValue
                        _checkPassword $MIN_PASSWORD_LENGTH "${newValue}"
                        [[ $? -eq 0 ]] && break
                    else
                        read -e -p "$key: " -i "${value}" newValue
                        break
                    fi
                done
            fi
            ;;
        bool)
            while true; do
                read -e -p "$key: [true/false] " -i "${value}" newValue
                [[ $newValue == true ]] && break
                [[ $newValue == false ]] && break
            done
            ;;
        number)
            while true; do
                read -e -p "$key: [0-n] " -i "${value}" newValue
                [[ $newValue =~ ^-?[0-9]+$ ]] && break
            done
            ;;

        esac

        [[ $skipNextValue == true ]] && _setValue "${ENV_TMPFILE}" "${key}" "${type}" "${value}"
        [[ $skipNextValue == false ]] && _setValue "${ENV_TMPFILE}" "${key}" "${type}" "${newValue}"

        previousKey="${key}" # set a previousKey (see utils/description function)

    done

    echo -e "saving file ..."

    case "${1}" in
    env | made | sample) sleep 1 && cat $ENV_TMPFILE | sudo tee $ENV_MAKEFILE >/dev/null ;;
    menu) sleep 1 && cat $ENV_TMPFILE | sudo tee $ENV_MENU_TARGET >/dev/null ;;
    esac

    echo -e "saved ..."

    sleep 1 && sudo rm $ENV_TMPFILE

    return 0
}

_updateTmpWithSampleFile() {
    cat $ENV_SAMPLE | sudo tee $ENV_TMPFILE2 >/dev/null

    for key in $(cat $ENV_TMPFILE | grep -E '^[^#]*=' | sed 's/=\(.*\)//'); do
        value=$(grep "^$key=" $ENV_TMPFILE | cut -d '=' -f2-)
        local type=$(_findTypeValue "${value}")
        value=$(_escapeDoubleQuote "${value}")

        _setValue "${ENV_TMPFILE2}" "${key}" "${type}" "${value}"
    done

    cat $ENV_TMPFILE2 | sudo tee $ENV_TMPFILE >/dev/null
    sudo rm $ENV_TMPFILE2
}

_thirdPartyMenuCertbotLe() {
    sudo chmod +x update-letsencrypt-certs.sh
    CMD=
    domain=
    [[ -f $ENV_CERTBOT_INFO ]] && source $ENV_CERTBOT_INFO && domain=$LASTDOMAIN
    while true; do

        headerPart
        mailserver=$?

        _checkLetsencryptProcessRunning
        processRunning=$?

        [[ $domain ]] && _checkLetsencryptDir "${domain}"

        while true; do
            _checkLetsencryptDir "${domain}"
            domainValid=$?
            if [ $domainValid -eq 0 ]; then
                echo "LASTDOMAIN=${domain}" | sudo tee $ENV_CERTBOT_INFO >/dev/null
                break
            elif [ -f $ENV_CERTBOT_INFO ]; then
                source $ENV_CERTBOT_INFO
                domain=$LASTDOMAIN
                sudo rm $ENV_CERTBOT_INFO
            else
                domain=
                echo "LASTDOMAIN=" | sudo tee $ENV_CERTBOT_INFO >/dev/null
                break
            fi
        done

        echo -e "${COLOR_DEFAULT}"
        echo -e "Select domain: ${domain}"

        _helloContainer
        mailserver=$?

        if [[ ! -z $CMD ]]; then
            echo -e "${COLOR_YELLOW}"
            echo -e $CMD
        fi

        echo -e "${COLOR_CYAN}"
        echo -e "- CERTBOT-GENERATED CERTIFICATES MENU -"
        echo -e "${COLOR_DEFAULT}"

        echo -e "${COLOR_BLUE}0) Main menu${COLOR_DEFAULT}"
        if [ $domainValid -eq 0 ]; then
            [[ $processRunning -eq 1 ]] && echo -e "1) Start script"
            [[ $processRunning -eq 0 ]] && echo -e "1) Stop script"
        fi
        [[ ! -z $CMD ]] && echo -e "${COLOR_YELLOW}2) Clear the List of domains served by certbot${COLOR_DEFAULT}"
        [[ -z $CMD ]] && echo -e "2) List of domains served by certbot"
        [[ $processRunning -eq 1 ]] && echo -e "3) Enter a domain served by the certbot daemon"

        read -n1 -e -p "Please choose a number: [0-9] " choice

        case $choice in
        0) break ;;
        1)
            if [ $domainValid -eq 0 ]; then
                [[ $processRunning -eq 1 ]] && sudo nohup ./update-letsencrypt-certs.sh "${domain}" &
                [[ $processRunning -eq 0 ]] && sudo ps ax | grep 'inotifywait -m -e modify /etc/letsencrypt/live' | grep -v grep | awk '{print $1}' | sudo xargs -r kill
                sleep 1
            fi
            ;;
        2)
            if [ -z $CMD ]; then
                CMD="List of domains served by certbot: $(_listValidDomains)"
            else
                CMD=
            fi
            ;;
        3)
            if [ $processRunning -eq 1 ]; then
                _CMD="$(_listValidDomains)"
                echo -e "${COLOR_YELLOW}"
                echo -e "List of domains served by certbot: "
                echo -e $_CMD
                echo -e "${COLOR_DEFAULT}"
                read -e -p "Domain FQDN " -i "${domain}" domain
                _checkLetsencryptDir "${domain}" 1
                sleep $(($? + 1))
            fi
            ;;
        esac
    done
}

_thirdPartyMenuBackup() {
    if sudo test -f $ENV_TARGET; then

        _confirm "Do you want to backup now? "
        if [ $? -eq 0 ]; then
            _helloContainer
            mailserver=$?

            if [ $mailserver -eq 0 ]; then
                clear
                _helloContainer 1
                echo -e "${COLOR_DEFAULT}"
                echo -e "It is recommended to switch off the server during backup,"
                echo -e "NOTE the server will be automatically restarted after backup"
                echo -e "${COLOR_DEFAULT}"
                _confirm "Do you agree to turn it off? "
                if [ $? -eq 0 ]; then
                    sudo docker compose down && sleep 1 && _backup
                    sudo docker compose up -d && sleep 1
                else
                    echo -e "${COLOR_DEFAULT}"
                    echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
                    echo -e "${COLOR_DEFAULT}"
                fi
            else
                _backup
            fi

        fi

    else
        echo -e "${COLOR_RED}"
        echo "Error, No configured environment"
        echo -e "${COLOR_DEFAULT}"
    fi

    _confirm "Press any key to continue" 1
}

_backup() {
    sudo cat $ENV_TARGET | grep 'DOCKER_VOLUMES=' | sudo tee $ENV_TMPFILE >/dev/null
    source $ENV_TMPFILE
    sudo rm $ENV_TMPFILE

    if sudo test -d $DOCKER_VOLUMES; then
        date=$(date '+%Y-%m-%d %H:%M:%S')
        value=$(date '+%Y_%m_%d_%H_%M_%S')

        filename="backup-mailserver-$value.tar.gz"

        sudo tar -zvcf $MENU_BACKUP_FOLDER/$filename $DOCKER_VOLUMES

        local size=$(sudo ls -l $MENU_BACKUP_FOLDER/$filename | cut -d " " -f5)

        echo "Complete ! Saved in $MENU_BACKUP_FOLDER/$filename (size: $(_convertToMegabytes $size))"
    else
        echo -e "${COLOR_RED}"
        echo "Error, this volume doesnt exist."
        echo -e "${COLOR_DEFAULT}"
        sleep 3
    fi
}

_leaveMenu() {
    echo "Goodbye !" && sleep 1 && clear
}

_startStopContainer() {
    if [[ ! -f $ENV_NEWFILE ]] && [[ -f $ENV_TARGET ]]; then
        if [[ -z $(sudo docker ps --format '{{.Names}}' | grep 'simply-mailserver') ]]; then
            _confirm "Do you really want to start the container ?"
            [[ $? -eq 0 ]] && sudo docker compose up -d && sleep 3
        else
            _confirm "Do you really want to stop the container ?"
            [[ $? -eq 0 ]] && sudo docker compose down && sleep 3
        fi
    fi
}

_logsContainer() {
    clear
    while true; do
        sudo docker compose logs
        read -n1 -e -p "-- PRESS ENTER TO REFRESH -- OR -- X TO LEAVE --" choice2
        [[ $choice2 =~ ^[Xx]$ ]] && break
    done

}

_buildContainer() {
    echo -e "${COLOR_YELLOW}"
    _confirm "This will delete the old docker image and rebuild the new one, would you like to confirm ?"
    if [ $? -eq 0 ]; then
        sudo docker compose down
        images=$(sudo docker images '*simply-mailserver' -q)
        if [ -n "$images" ]; then
            sudo docker rmi $images
        else
            echo "No images to remove"
        fi

        sudo docker compose build --no-cache

        sudo rm $ENV_NEWFILE
        sleep 1
    else
        echo -e "${COLOR_CYAN}Action cancelled" && sleep 1
    fi
    echo -e "${COLOR_DEFAULT}"
}

_updateMailserver() {
    sudo git pull
    code=$?
    if [ $code -eq 0 ]; then
        echo "After an update request, the menu should reload."
        _confirm "Press any key to continue" 1
        echo -e ""
        _leaveMenu
    else
        echo "No update has been made, git exit code ${code}" && exit
    fi
}

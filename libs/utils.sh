#!/bin/bash

_fixEnvPermissionsAndClean() {
    [[ -f $ENV_TARGET ]] && sudo chmod o-rwx $ENV_TARGET
    [[ -f $ENV_SAMPLE ]] && sudo chmod o+r $ENV_SAMPLE
    [[ -f $ENV_MAKEFILE ]] && sudo chmod o+rw $ENV_MAKEFILE
    [[ -f $ENV_CERTBOT_INFO ]] && sudo chmod o+rw $ENV_CERTBOT_INFO
    [[ -f $ENV_NEWFILE ]] && sudo chmod o+rw $ENV_NEWFILE
    if [ $1 ]; then
        # provide with an argument = delete these files
        [[ -f $ENV_TMPFILE ]] && sudo rm $ENV_TMPFILE
        [[ -f $ENV_TMPFILE2 ]] && sudo rm $ENV_TMPFILE2
    fi
}

_uppercase() {
    echo "$1" | tr '[:lower:]' '[:upper:]'
}

_messageOk() {
    echo -e "${1}: 🟢"
}

_messageFail() {
    echo -e "${1}: 🔴"
}

_helloContainer() {
    if [[ -z $(sudo docker ps --format '{{.Names}}' | grep 'simply-mailserver') ]]; then
        [[ $1 -eq 1 ]] && _messageFail "MAILSERVER STATUS"
        [[ $1 -eq 2 ]] && echo 1
        return 1
    else
        [[ $1 -eq 1 ]] && _messageOk "MAILSERVER STATUS"
        [[ $1 -eq 2 ]] && echo 0
        return 0
    fi
}

# _confirm "Do you confirm ?"
_confirm() {
    local message="${1}"
    local answer=

    [[ ! $2 ]] && local answer="[y/N] "
    read -p "${message} ${answer}" -n1 -r

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        return 0
    else
        return 1
    fi
}

# _checkPassword $minLength "${password}" $mute
_checkPassword() {
    local minLength=$1
    local password="${2}"
    local passwordLength=${#password}
    local mute=$3

    if [ "${passwordLength}" -lt $minLength ]; then
        [[ ! $mute ]] && echo -e "${COLOR_RED}${minLength} characters minimum. (currently ${passwordLength})${COLOR_DEFAULT}"
        return 1
    fi

    if ! [[ "$password" =~ [A-Z] ]]; then
        [[ ! $mute ]] && echo -e "${COLOR_RED}Password must include at least one uppercase letter${COLOR_DEFAULT}"
        return 1
    fi

    if ! [[ "$password" =~ [a-z] ]]; then
        [[ ! $mute ]] && echo -e "${COLOR_RED}Password must include at least one lowercase letter${COLOR_DEFAULT}"
        return 1
    fi

    if ! [[ "$password" =~ [0-9] ]]; then
        [[ ! $mute ]] && echo -e "${COLOR_RED}Password must include at least one number${COLOR_DEFAULT}"
        return 1
    fi

    return 0
}

_readAboveUntil() {
    local file=$1
    local start_word=$2
    local end_word=$3
    awk "/$end_word/{exit} {print}" "$file" | tac | awk "/$start_word/{exit} {print}" | tac
}

_removeTripleCurlyBracesWords() {
    local text="$1"
    echo "$text" | sed -e 's/{{{rule:[^}]*}}}//g'
}

_checkWordInText() {
    local text=$1
    local word=$2
    if echo "$text" | grep -q "$word"; then
        return 0
    else
        return 1
    fi
}

_displayCurrentDescription() {
    local file=$1
    local previousKey=$2
    local currentKey=$3
    local withClear=$4
    local removeTripleCurlyBracesWords=$5
    [[ $withClear ]] && [[ $4 -eq 1 ]] && clear
    description=$(_readAboveUntil "${file}" "${previousKey}=" "${currentKey}=" | sed "s/# /-/g" | sed "s/#/-/g" | sed "s/-//g")
    [[ $removeTripleCurlyBracesWords ]] && [[ $5 -eq 1 ]] && description="$(_removeTripleCurlyBracesWords "${description}")"
    echo -e "${COLOR_YELLOW}${description}${COLOR_DEFAULT}"
}

_escapeSed() {
    echo "$1" | sed -e 's/[]\/$*.^|[]/\\&/g'
}

_escapeDoubleQuote() {
    echo "$1" | sed -e 's/^"//;s/"$//'
}

_escapeInnerDoubleQuotes() {
    echo "$1" | sed 's/"/\\"/g'
}

_findTypeValue() {
    if [ "${1}" = true ] || [ "${1}" = false ]; then
        echo bool
    elif [[ "${1}" =~ ^-?[0-9]+$ ]]; then
        echo number
    else
        echo string
    fi
}

# _setValue "${FILE}" "${KEY}" "${TYPE}" "${VALUE}"
_setValue() {
    [[ ! $1 ]] && return 1
    [[ ! $2 ]] && return 2
    [[ ! $3 ]] && return 3

    local FILE="${1}"
    local KEY="${2}"
    local TYPE="${3}"
    local VALUE="${4}"

    case $TYPE in
    string)
        VALUE=$(_escapeInnerDoubleQuotes "${VALUE}")
        VALUE=$(_escapeSed "${VALUE}")
        sudo sed -i "s/^\($KEY=\).*/\1\"${VALUE}\"/" $FILE
        ;;
    bool)
        case $VALUE in
        true) sudo sed -i "s/^\($KEY=\).*/\1true/" $FILE ;;
        *) sudo sed -i "s/^\($KEY=\).*/\1false/" $FILE ;;
        esac
        ;;
    number)
        [[ $VALUE =~ ^-?[0-9]+$ ]] && sudo sed -i "s/^\($KEY=\).*/\1$VALUE/" $FILE
        ! [[ $VALUE =~ ^-?[0-9]+$ ]] && return 2
        ;;
    *)
        echo "Type not allowed (string, bool, number)"
        ;;
    esac
}

_checkDependencies() {
    # docker
    [[ ! -z $(which docker) ]]
    if [ $? -eq 1 ]; then
        echo -e "${COLOR_YELLOW}docker missing dependency"
        echo -e "Check doc https://docs.docker.com/engine/install/ubuntu/"
        echo -e "${COLOR_DEFAULT}"
    fi

    # git clone, git pull
    [[ ! -z $(which git) ]]
    if [ $? -eq 1 ]; then
        echo -e "${COLOR_YELLOW}git missing dependency"
        echo -e "can be installed with: sudo apt install git"
        echo -e "${COLOR_DEFAULT}"
    fi

    # updateCertSSL
    [[ ! -z $(which inotifywait) ]]
    if [ $? -eq 1 ]; then
        echo -e "${COLOR_YELLOW}inotifywait missing dependency"
        echo -e "can be installed with: sudo apt install inotify-tools"
        echo -e "${COLOR_DEFAULT}"
    fi
}

_checkLetsencryptProcessRunning() {
    if pgrep -f "update-letsencrypt-certs.sh" >/dev/null; then
        [[ $1 ]] && _messageOk "CERBOT AUTO-UPDATES SSL CERTIFICATES"
        return 0
    else
        [[ $1 ]] && _messageFail "CERBOT AUTO-UPDATES SSL CERTIFICATES"
        return 1
    fi
}

_checkLetsencryptDir() {
    local domain=$1
    if sudo test -d "/etc/letsencrypt/live/$domain" && sudo test -f "/etc/letsencrypt/live/$domain/fullchain.pem" && sudo test -f "/etc/letsencrypt/live/$domain/privkey.pem"; then
        [[ $2 ]] && echo -e "${COLOR_BLUE}The domain ${domain} seems valid and contains the required SSL certificates${COLOR_DEFAULT}"
        return 0
    else
        [[ $2 ]] && echo -e "${COLOR_RED}The domain ${domain} doesnt seem to be valid or doesnt contain the required SSL certificates${COLOR_DEFAULT}"
        return 1
    fi
}

_listValidDomains() {
    for domain in $(sudo ls /etc/letsencrypt/live 2>/dev/null); do
        if sudo test -d "/etc/letsencrypt/live/$domain" && sudo test -f "/etc/letsencrypt/live/$domain/fullchain.pem" && sudo test -f "/etc/letsencrypt/live/$domain/privkey.pem"; then
            echo "$domain"
        fi
    done
}

_convertToMegabytes() {
    local bytes=$1
    local megabytes=$(echo "scale=2; $bytes / 1024 / 1024" | bc)
    echo "$megabytes MB"
}

_countBackupFiles() {
    local count=$(ls $MENU_BACKUP_FOLDER/*.tar* 2>/dev/null | wc -l)
    echo $count
}

# _compareDates "2025-01-22" "2025-01-16" 7 = OK with 0
_compareDates() {
    local date1=$1
    local date2=$2
    local compare=$3
    local diff_days=$((($(date -d "$date1" +%s) - $(date -d "$date2" +%s)) / 86400))

    if [ "$diff_days" -le $compare ]; then
        return 0
    else
        return 1
    fi
}

_findMostRecentBackupDate() {
    [ ! -d $MENU_BACKUP_FOLDER ] && echo "this folder ($MENU_BACKUP_FOLDER) doesnt exist !" && exit

    local folder=$MENU_BACKUP_FOLDER

    ls $folder/*.tar* >/dev/null 2>&1
    if [ ! $? -eq 0 ]; then
        [[ $1 ]] && echo "2020-01-01"
        return 1
    fi

    if [ ! -d $folder ]; then
        [[ $1 ]] && echo "2020-01-02"
        return 2
    fi

    local recent_file=$(sudo ls -t "$folder"/*.tar* | head -n 1)
    if [ -z $recent_file ]; then
        [[ $1 ]] && echo "2020-01-03"
        return 3
    fi

    local recent_date=$(stat -c %y "$recent_file" | cut -d ' ' -f 1)
    [[ $1 ]] && echo "$recent_date"
    return 0
}

_checkLatestBackup() {
    local days=$1
    local todayDate=$(date +%Y-%m-%d)
    local fileDate=$(_findMostRecentBackupDate 1)

    _compareDates "$todayDate" "$fileDate" $days

    if [ $? -eq 0 ]; then
        [[ $2 ]] && echo "✅ <= $days days"
        return 0
    else
        [[ $2 ]] && echo "🚫 > $days days"
        return 1
    fi
}

_dockerExec() {
    sudo docker exec -it simply-mailserver bash -c "${1}"
}

_isValidIP() {
    local ip_port=$1
    local ip=$(echo $ip_port | cut -d':' -f1)
    local port=$(echo $ip_port | cut -d':' -f2)

    if [[ $ip =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
        IFS='.' read -r -a octets <<<"$ip"
        for octet in "${octets[@]}"; do
            if ((octet < 0 || octet > 255)); then
                [[ $2 ]] && echo "Invalid IP address"
                return 1
            fi
        done
    else
        [[ $2 ]] && echo "Invalid IP address"
        return 1
    fi

    if [[ $port =~ ^[0-9]+$ ]] && ((port >= 1 && port <= 65535)); then
        [[ $2 ]] && echo "Valid IP address and port"
        return 0
    else
        [[ $2 ]] && echo "Invalid port"
        return 1
    fi
}

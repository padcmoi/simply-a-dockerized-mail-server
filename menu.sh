#!/bin/bash

sudo chmod -R +r ./libs

source ./libs/env.sh
source ./libs/utils.sh
source ./libs/actions.sh
source ./libs/menus.sh
source ./libs/management_tools.sh

[[ ! -f $ENV_MENU_TARGET ]] && sudo cp -f $ENV_MENU_SAMPLE $ENV_MENU_TARGET

if [ ! -f $ENV_SAMPLE ]; then
    echo -e "${COLOR_RED}Error, the .env.sample file doesnt exist${COLOR_DEFAULT}"
    exit 1
fi

# Fix/clean permissions issue
_fixEnvPermissionsAndClean 1

mainMenu

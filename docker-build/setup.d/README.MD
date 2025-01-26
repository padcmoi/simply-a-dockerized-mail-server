# Lifecycle behavior in a specific numerical sequence

- build
- save-volume
- retrieve-volume
- container
- run


```
NB
All scripts in setup.d are executed in the order of numbers 01 to 99. Please dont go beyond 99, in which case add in the script 99-system.sh

Concerning save-volume and retrieve-volume hooks
This project uses volumes that mount folders belonging to daemons. When the image is built, the volumes arent yet mounted and when the container is executed, the volumes will overwrite the daemon's folders destined to become volumes.
```

## build
Is the 1st execution, which is performed in the Dockerfile using this line `RUN /docker-build/docker-setup.sh build`.
It allows you to build the image that will be used later in the container or each time the container is started, and saves time by avoiding repeating the same steps.


## save-volume

*This hook will be executed in order of script number once all build hooks have been completed*.

This hook is the last step in the build process and should enable the folders intended to become volumes to be copied as temporary folders.


## retrieve-volume

*This hook will be executed in order of script number once all build hooks have been completed*.

This hook is the first step when executing the container, and its purpose is to retrieve the folders and include them in the volumes **IF THESE FOLDERS ARE EMPTY (add condition)**.


## container

This hook is designed to configure permissions and other settings, and to ensure that databases are updated.


## run

In this last step, we execute the daemons in number order

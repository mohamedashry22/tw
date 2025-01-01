#!/bin/bash

# Define paths
APPS_FOLDER="/var/www/apps"
BACKEND_FOLDER="/var/www/apps/backend"
REVERSE_PROXY_FOLDER="reverse-proxy"

# Full paths
APPS_REVERSE_PROXY_PATH="$APPS_FOLDER/$REVERSE_PROXY_FOLDER"
BACKEND_REVERSE_PROXY_PATH="$BACKEND_FOLDER/$REVERSE_PROXY_FOLDER"

# Remove the reverse-proxy folder in apps if it exists
if [ -d "$APPS_REVERSE_PROXY_PATH" ]; then
    echo "Removing existing $APPS_REVERSE_PROXY_PATH..."
    rm -rf "$APPS_REVERSE_PROXY_PATH"
    echo "Removed $APPS_REVERSE_PROXY_PATH."
else
    echo "No existing $APPS_REVERSE_PROXY_PATH to remove."
fi

# Copy the reverse-proxy folder from backend to apps
if [ -d "$BACKEND_REVERSE_PROXY_PATH" ]; then
    echo "Copying $BACKEND_REVERSE_PROXY_PATH to $APPS_FOLDER..."
    cp -r "$BACKEND_REVERSE_PROXY_PATH" "$APPS_FOLDER/"
    echo "Copied $BACKEND_REVERSE_PROXY_PATH to $APPS_FOLDER."
else
    echo "Error: $BACKEND_REVERSE_PROXY_PATH does not exist. Aborting."
    exit 1
fi

echo "Operation completed successfully."
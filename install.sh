#!/bin/bash

# Dev-Analytics Installer Script

set -e

echo "====================================="
echo "  Dev-Analytics Telemetry Installer  "
echo "====================================="
echo ""

# 1. Dependency Checks
command -v curl >/dev/null 2>&1 || { echo >&2 "Error: 'curl' is required but it's not installed. Aborting."; exit 1; }
command -v jq >/dev/null 2>&1 || { echo >&2 "Error: 'jq' is required but it's not installed. Aborting. (Try: sudo apt install jq / brew install jq)"; exit 1; }
command -v git >/dev/null 2>&1 || { echo >&2 "Error: 'git' is required but it's not installed. Aborting."; exit 1; }

# 2. Setup Configuration Details
CONFIG_DIR="$HOME/.dev-analytics"
CONFIG_FILE="$CONFIG_DIR/config.env"
API_URL="https://dev-analytics-nq8j.onrender.com/ingest/commits"

mkdir -p "$CONFIG_DIR"

if [ -f "$CONFIG_FILE" ]; then
    echo "Existing configuration found."
    source "$CONFIG_FILE"
    echo "Current Username: $DEV_USERNAME"
else
    echo "No existing configuration found. Let's set it up!"
    echo ""
    read -p "Masukkan GitHub Username kamu: " DEV_USERNAME
    
    if [ -z "$DEV_USERNAME" ]; then
        echo "Error: Username cannot be empty."
        exit 1
    fi

    # Generate a random 6-character hex PIN "Auto-PIN"
    DEV_PIN=$(cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 6 | head -n 1)

    echo "DEV_USERNAME=\"$DEV_USERNAME\"" > "$CONFIG_FILE"
    echo "DEV_PIN=\"$DEV_PIN\"" >> "$CONFIG_FILE"
    echo "API_URL=\"$API_URL\"" >> "$CONFIG_FILE"
    
    # Secure the file so only user can read PIN
    chmod 600 "$CONFIG_FILE"
    
    echo ""
    echo "Setup successful!"
    echo "Auto-PIN generated and saved securely to $CONFIG_FILE"
fi

# 3. Setup Collector Script
COLLECT_SCRIPT_URL="https://raw.githubusercontent.com/Vuxyn/dev-analytics/main/collector/collect.sh" # Point to the raw GH url later
COLLECT_SCRIPT_PATH="$CONFIG_DIR/collect.sh"

echo "Downloading the latest collector script..."
if [ -f "collector/collect.sh" ]; then
    # Local dev: use local copy
    cp collector/collect.sh "$COLLECT_SCRIPT_PATH"
else
    # Production: download from GitHub
    curl -fsSL "$COLLECT_SCRIPT_URL" -o "$COLLECT_SCRIPT_PATH" || {
        echo "Error: Failed to download collect.sh from GitHub."
        exit 1
    }
fi

chmod +x "$COLLECT_SCRIPT_PATH"

# 4. Prompt for tracking directories
echo ""
echo "====================================="
echo "We need to know which directories contain your Git repositories."
echo "For example: /home/user/projects"
read -p "Masukkan path direktori untuk ditrack: " TARGET_DIR

if [ ! -d "$TARGET_DIR" ]; then
    echo "Warning: Directory $TARGET_DIR does not exist yet."
fi

# Save the target directory to config
# Let's handle multiple directories in the future, for now just replace
sed -i '/TARGET_DIR/d' "$CONFIG_FILE" || true
echo "TARGET_DIR=\"$TARGET_DIR\"" >> "$CONFIG_FILE"

# 5. Setup Cronjob (Hourly)
CRON_JOB="0 * * * * $COLLECT_SCRIPT_PATH >> $CONFIG_DIR/cron.log 2>&1"
(crontab -l 2>/dev/null | grep -v "$COLLECT_SCRIPT_PATH"; echo "$CRON_JOB") | crontab -

echo ""
echo "======================================"
echo "Running initial sync (full history)..."
echo "======================================"
SYNC_DAYS=all "$COLLECT_SCRIPT_PATH"

echo ""
echo "All Done!"
echo "Hourly sync has been set up via cron."
echo "You can check logs at: $CONFIG_DIR/cron.log"
echo "Manual sync anytime: $COLLECT_SCRIPT_PATH"

echo "You can manually trigger a sync right now by running: $COLLECT_SCRIPT_PATH"

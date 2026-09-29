#!/bin/sh
set -eu
: "${API_URL:?API_URL must be set at container startup}"
config_path="${CONFIG_PATH:-/usr/share/nginx/html/config.js}"
# JSON serialization handles quotes, backslashes, newlines and Unicode safely.
config_json=$(jq -acn --arg apiUrl "$API_URL" '{apiUrl: $apiUrl}')
printf 'window.__APP_CONFIG__ = %s;\n' "$config_json" > "$config_path"
exec "$@"

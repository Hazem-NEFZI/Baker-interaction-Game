#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
 echo "Installez Node.js >=18 depuis https://nodejs.org/" >&2
 exit 1
fi
node server.js

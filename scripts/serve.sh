#!/bin/sh
# Serve the site locally (Practice needs http, not file://). Usage: scripts/serve.sh [port]
cd "$(dirname "$0")/.." && exec python3 -m http.server "${1:-8000}"

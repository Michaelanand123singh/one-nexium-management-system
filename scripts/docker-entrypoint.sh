#!/bin/sh
set -e
echo "Starting Nexium OS..."
echo ""
echo "  Open in browser:  http://localhost:8080"
echo "  Do NOT use:       http://0.0.0.0:8080  (invalid in browsers)"
echo ""
exec node server.js

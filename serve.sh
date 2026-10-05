#!/usr/bin/env bash
# Serve the Deutsch Deck app locally, then open http://localhost:8777
cd "$(dirname "$0")"
PORT=8777
echo "Deutsch Deck running at http://localhost:$PORT  (press Ctrl+C to stop)"
python3 -m http.server "$PORT"

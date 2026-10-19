#!/bin/sh
# make sure the dev server is running on port 5199 (started fully detached so it outlives this command)
cd "$(dirname "$0")/../.."
if ! curl -s -o /dev/null http://127.0.0.1:5199/; then
  setsid nohup npx vite --host 127.0.0.1 --port 5199 > /tmp/vite-dev.log 2>&1 < /dev/null &
  for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:5199/ && break; sleep 1; done
fi
curl -s -o /dev/null http://127.0.0.1:5199/ && echo "dev server up" || { echo "dev server did not start"; tail -5 /tmp/vite-dev.log; exit 1; }

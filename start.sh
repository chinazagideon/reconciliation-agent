#!/bin/bash

# Start the database
docker start resolution-pg  

# Start agent sidecar in the background
(cd services/agent && uvicorn app.main:app --reload) &

# Start core in the background
(cd services/core && npm run dev) &

# Start web in the background
(cd services/web && npm run dev) &

# Keep the script running so you can see the logs/manage processes
wait

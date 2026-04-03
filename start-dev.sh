#!/bin/bash
export PATH="/Users/kristina/.nvm/versions/node/v24.14.0/bin:$PATH"
export NEXT_TURBOPACK=0
cd "$(dirname "$0")"
exec node node_modules/.bin/next dev --port 3001

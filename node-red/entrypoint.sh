#!/bin/bash

# Navigate to the Node-RED user directory
cd /data

# Install the TDengine Node-RED plugin if it's not already installed
if [ ! -d "node_modules/node-red-node-tdengine" ]; then
    echo "Installing @tdengine/websocket..."
    npm install @tdengine/websocket
    echo "Installing node-red-node-tdengine..."
    npm install node-red-node-tdengine

    echo "node-red-node-tdengine installed."
else
    echo "node-red-node-tdengine already present."
fi

# Execute the original Node-RED startup command
exec node-red  --userDir /data "$@"
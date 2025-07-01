# Use the official Node-RED base image
FROM nodered/node-red:latest

# Set the working directory inside the container
WORKDIR /usr/src/node-red

# Install the TDengine Node-RED plugin
# Node-RED stores user data (including installed nodes) in the /data directory.
# The `npm install` command should be run in the Node-RED user directory.
# --unsafe-perm is often needed for Node.js modules with native dependencies.
RUN npm install --prefix /data @tdengine/websocket
RUN npm install --prefix /data node-red-node-tdengine

# You can also copy a pre-configured flows.json and settings.js if desired
# COPY flows.json /data/flows.json
# COPY settings.js /data/settings.js

# Expose the Node-RED port (default is 1880)
EXPOSE 1880

# The base image already has the CMD to start Node-RED, so no need to specify it again
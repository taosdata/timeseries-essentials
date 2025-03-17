# Use the official Node.js 22 image as the base image
FROM node:22

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Command to run the application
CMD ["npm", "start"]
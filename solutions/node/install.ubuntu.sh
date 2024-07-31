#!/bin/bash

# Update package list
sudo apt update

# Install Node.js and npm
sudo apt install -y nodejs npm

# Navigate to the 'latest' directory
cd latest

# Install npm packages
sudo npm install

# Run the Node.js application
sudo node index.js
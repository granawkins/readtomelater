#!/bin/bash

# Install dependencies
bun install

# Ensure audio directory exists
mkdir -p audio

# Start server with PM2
pm2 start ecosystem.prod.config.cjs

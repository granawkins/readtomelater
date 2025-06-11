#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Install dependencies
bun run format
bun run lint
# bun run test

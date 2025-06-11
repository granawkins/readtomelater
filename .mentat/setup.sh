#!/bin/bash

# Install Bun
curl -fsSL https://bun.sh/install | bash

# Add Bun to PATH for current session and future sessions
export PATH="$HOME/.bun/bin:$PATH"
source ~/.bashrc

# Install dependencies
bun install

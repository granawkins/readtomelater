#!/bin/bash

# Ensure Bun is in PATH
export PATH="$HOME/.bun/bin:$PATH"

# Format code with Prettier
bun run format

# Lint code with ESLint (with auto-fix)
bunx eslint . --fix

# Run tests (since there's no GitHub CI)
bun run test

#!/bin/bash

# Format code with Prettier
bun run format

# Lint and fix issues with ESLint
bun run lint --fix

# Run tests (since there's no GitHub CI)
bun run test

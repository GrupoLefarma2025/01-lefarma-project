#!/bin/bash
# Auto-commit hook - runs asynchronously after writes
# Commits changes to git if in a git repository

# Check if in git repo
if [ ! -d ".git" ]; then
    exit 0
fi

# Check if there are changes
if git diff --quiet HEAD; then
    exit 0
fi

# Stage and commit
git add -A
git commit -m "Auto-commit: $(date '+%Y-%m-%d %H:%M:%S')"

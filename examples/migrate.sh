#!/usr/bin/env bash
# Example: migrate all pages from Notion into HelpNest

set -e
source .env

# List your Notion databases first
npx helpnest-notion list-databases --notion-key "$NOTION_API_KEY"

# Dry run — preview what will be migrated
npx helpnest-notion migrate \
  --notion-key "$NOTION_API_KEY" \
  --helpnest-url "$HELPNEST_URL" \
  --helpnest-key "$HELPNEST_API_KEY" \
  --workspace "$HELPNEST_WORKSPACE" \
  --dry-run

# Full migration — migrate a specific database
# npx helpnest-notion migrate \
#   --notion-key "$NOTION_API_KEY" \
#   --helpnest-url "$HELPNEST_URL" \
#   --helpnest-key "$HELPNEST_API_KEY" \
#   --workspace "$HELPNEST_WORKSPACE" \
#   --database "your-notion-database-id" \
#   --state ./notion-migration-state.json

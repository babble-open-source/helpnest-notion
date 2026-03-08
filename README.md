# helpnest-notion

Migrate your Notion pages and databases into [HelpNest](https://github.com/babble-open-source/helpnest) — the open-source customer help center.

Converts Notion databases → HelpNest Collections and Notion pages → HelpNest Articles. Supports incremental/resumable migrations via a local state file.

## Installation

```bash
npm install -g helpnest-notion
# or run directly
npx helpnest-notion <command>
```

## Prerequisites

1. **Notion integration token** — Create one at [notion.so/my-integrations](https://www.notion.so/my-integrations), then share the relevant pages/databases with your integration.
2. **HelpNest API key** — Generate one from your HelpNest dashboard under Settings → API Keys.

## Setup

```bash
cp .env.example .env
# Edit .env with your credentials
```

## Commands

### `list-databases`

List all Notion databases your integration can access:

```bash
npx helpnest-notion list-databases --notion-key secret_xxx
```

Use the database IDs from this output with the `--database` flag.

### `migrate`

Migrate Notion content into HelpNest:

```bash
# Migrate a specific database
npx helpnest-notion migrate \
  --notion-key secret_xxx \
  --helpnest-url https://help.yourcompany.com \
  --helpnest-key hn_live_xxx \
  --workspace your-workspace-slug \
  --database your-notion-database-id

# Migrate all accessible pages
npx helpnest-notion migrate \
  --notion-key secret_xxx \
  --helpnest-url https://help.yourcompany.com \
  --helpnest-key hn_live_xxx \
  --workspace your-workspace-slug

# Dry run — preview without writing
npx helpnest-notion migrate ... --dry-run

# Resumable — saves progress to a state file
npx helpnest-notion migrate ... --state ./migration-state.json
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--notion-key` | Notion integration token (or `NOTION_API_KEY` env var) |
| `--helpnest-url` | Your HelpNest base URL |
| `--helpnest-key` | HelpNest API key |
| `--workspace` | HelpNest workspace slug |
| `--database <id>` | Migrate a specific Notion database (omit for all pages) |
| `--dry-run` | Preview without creating anything |
| `--state <file>` | State file for resumable migrations (default: `./notion-migration-state.json`) |
| `--collections-only` | Create collections only, skip article content |

## How it works

1. **Collections** — Each Notion database becomes a HelpNest Collection. The database title and any emoji icon are preserved.
2. **Articles** — Each Notion page becomes a HelpNest Article. Content is converted from Notion blocks to Markdown using [`notion-to-md`](https://github.com/souvikinator/notion-to-md).
3. **State file** — A JSON file tracks which Notion items have been migrated. Re-running the command skips already-migrated items, making it safe to resume interrupted migrations.

## What gets migrated

| Notion | HelpNest |
|--------|----------|
| Database | Collection |
| Page | Article |
| Page title | Article title |
| Page content (blocks → Markdown) | Article body |
| Page emoji icon | Collection emoji |
| First 160 chars of content | Article excerpt |

## What doesn't migrate

- Notion sub-pages nested inside pages (only database-backed pages are migrated)
- Notion properties beyond the title (e.g., tags, status, custom fields)
- Inline databases or synced blocks
- File/media attachments (converted to placeholder links)

## Contributing

PRs welcome! See [CONTRIBUTING.md](https://github.com/babble-open-source/helpnest/blob/main/CONTRIBUTING.md).

## License

MIT © HelpNest Contributors

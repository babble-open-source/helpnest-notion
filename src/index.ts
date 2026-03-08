#!/usr/bin/env node
import { program } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import fs from 'node:fs'
import type { MigrationResult, MigrationState } from './types.js'
import { NotionClient } from './notion.js'
import { HelpNestClient } from './helpnest.js'
import { transformCollection, transformArticle } from './transform.js'

program
  .name('helpnest-notion')
  .description('Migrate Notion pages and databases to HelpNest')
  .version('0.1.0')

program
  .command('migrate')
  .description('Migrate a Notion database (or all pages) into HelpNest')
  .requiredOption('--notion-key <key>', 'Notion integration token', process.env.NOTION_API_KEY)
  .requiredOption('--helpnest-url <url>', 'HelpNest base URL', process.env.HELPNEST_URL)
  .requiredOption('--helpnest-key <key>', 'HelpNest API key', process.env.HELPNEST_API_KEY)
  .requiredOption('--workspace <slug>', 'HelpNest workspace slug', process.env.HELPNEST_WORKSPACE)
  .option('--database <id>', 'Migrate a specific Notion database ID (omit to migrate all pages)')
  .option('--dry-run', 'Preview what would be migrated without writing to HelpNest')
  .option('--state <file>', 'Path to state file for incremental/resumable migrations', './notion-migration-state.json')
  .option('--collections-only', 'Only create collections, skip article content')
  .action(async (opts) => {
    const {
      notionKey,
      helpnestUrl,
      helpnestKey,
      workspace,
      database: databaseId,
      dryRun,
      state: stateFile,
      collectionsOnly,
    } = opts

    const notion = new NotionClient(notionKey)
    const helpnest = new HelpNestClient({ baseUrl: helpnestUrl, apiKey: helpnestKey, workspace })

    // Load existing state
    let state: MigrationState = { collectionMap: {}, articleMap: {}, lastRunAt: '' }
    if (stateFile && fs.existsSync(stateFile)) {
      try {
        state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')) as MigrationState
        console.log(chalk.dim(`Resuming from state: ${stateFile} (last run: ${state.lastRunAt})`))
      } catch {
        console.warn(chalk.yellow('⚠️  Could not parse state file — starting fresh'))
      }
    }

    const result: MigrationResult = {
      collectionsCreated: 0,
      articlesCreated: 0,
      articlesSkipped: 0,
      errors: [],
    }

    // ── Step 1: Fetch pages ──────────────────────────────────────────────────
    let spinner = ora('Fetching Notion pages…').start()
    let pages

    try {
      pages = databaseId
        ? await notion.getPagesInDatabase(databaseId)
        : await notion.getAllPages()
      spinner.succeed(`Found ${pages.length} page(s)`)
    } catch (err) {
      spinner.fail('Failed to fetch Notion pages')
      console.error(chalk.red((err as Error).message))
      process.exit(1)
    }

    if (pages.length === 0) {
      console.log(chalk.yellow('No pages found. Make sure your integration has access to the pages.'))
      process.exit(0)
    }

    // ── Step 2: Determine collection grouping ───────────────────────────────
    // Group pages by their parent database (if migrating all pages)
    // or treat the single database as one collection.
    const collectionGroups = new Map<string | null, typeof pages>()

    if (databaseId) {
      collectionGroups.set(databaseId, pages)
    } else {
      for (const page of pages) {
        const key = page.parentDatabaseId ?? null
        if (!collectionGroups.has(key)) collectionGroups.set(key, [])
        collectionGroups.get(key)!.push(page)
      }
    }

    // ── Step 3: Create collections ──────────────────────────────────────────
    console.log('')
    spinner = ora('Creating collections in HelpNest…').start()

    let databases: Awaited<ReturnType<typeof notion.listDatabases>> = []
    if (!databaseId) {
      databases = await notion.listDatabases()
    }

    for (const [groupKey] of collectionGroups) {
      if (!groupKey) continue // skip orphan pages (no parent DB) — will be uncategorised
      if (state.collectionMap[groupKey]) continue // already migrated

      // Find the database title
      const dbMeta = databases.find((d) => d.id === groupKey)
      const fakeNotionPage = {
        id: groupKey,
        title: dbMeta?.title ?? 'Imported from Notion',
        icon: null,
        url: '',
        parentDatabaseId: null,
        parentPageId: null,
        lastEditedTime: new Date().toISOString(),
        createdTime: new Date().toISOString(),
        archived: false,
      }
      const collection = transformCollection(fakeNotionPage)

      if (dryRun) {
        console.log(chalk.dim(`  [dry-run] Would create collection: "${collection.title}"`))
      } else {
        try {
          const res = await helpnest.createCollection(collection)
          state.collectionMap[groupKey] = res.id
          result.collectionsCreated++
        } catch (err) {
          spinner.fail(`Failed to create collection for database ${groupKey}`)
          result.errors.push({ title: fakeNotionPage.title, reason: (err as Error).message })
        }
      }
    }

    spinner.succeed(`Collections ready (${result.collectionsCreated} created)`)

    if (collectionsOnly) {
      printSummary(result, dryRun)
      saveState(state, stateFile)
      process.exit(0)
    }

    // ── Step 4: Migrate articles ─────────────────────────────────────────────
    console.log('')
    let i = 0

    for (const page of pages) {
      i++
      const label = `[${i}/${pages.length}] ${page.title}`

      if (state.articleMap[page.id]) {
        console.log(chalk.dim(`  ↷ Skipping (already migrated): ${label}`))
        result.articlesSkipped++
        continue
      }

      spinner = ora(`  Fetching: ${label}`).start()
      let markdown = ''

      try {
        markdown = await notion.getPageMarkdown(page.id)
      } catch (err) {
        spinner.warn(`  Could not fetch content for: ${label}`)
        result.errors.push({ title: page.title, reason: (err as Error).message })
        continue
      }

      const collectionId = page.parentDatabaseId
        ? state.collectionMap[page.parentDatabaseId]
        : undefined

      const article = transformArticle(page, markdown)

      if (dryRun) {
        spinner.info(chalk.dim(`  [dry-run] Would create article: "${article.title}" (${markdown.length} chars)`))
        result.articlesCreated++
        continue
      }

      try {
        const res = await helpnest.createArticle({ ...article, collectionId })
        state.articleMap[page.id] = res.id
        result.articlesCreated++
        spinner.succeed(`  ✓ ${label}`)
      } catch (err) {
        spinner.fail(`  ✗ ${label}`)
        result.errors.push({ title: page.title, reason: (err as Error).message })
      }
    }

    // ── Done ────────────────────────────────────────────────────────────────
    saveState(state, stateFile)
    printSummary(result, dryRun)
  })

program
  .command('list-databases')
  .description('List all Notion databases the integration has access to')
  .requiredOption('--notion-key <key>', 'Notion integration token', process.env.NOTION_API_KEY)
  .action(async (opts) => {
    const notion = new NotionClient(opts.notionKey)
    const spinner = ora('Fetching databases…').start()

    try {
      const databases = await notion.listDatabases()
      spinner.stop()
      if (databases.length === 0) {
        console.log(chalk.yellow('No databases found. Make sure your integration is added to the relevant pages.'))
        return
      }

      console.log('')
      console.log(chalk.bold('Accessible Notion databases:'))
      for (const db of databases) {
        console.log(`  ${chalk.cyan(db.id)}  ${db.title}`)
      }
      console.log('')
      console.log(chalk.dim('Use --database <id> to migrate a specific database.'))
    } catch (err) {
      spinner.fail('Failed to list databases')
      console.error(chalk.red((err as Error).message))
      process.exit(1)
    }
  })

function saveState(state: MigrationState, stateFile: string | undefined) {
  if (!stateFile) return
  state.lastRunAt = new Date().toISOString()
  try {
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2))
  } catch {
    console.warn(chalk.yellow(`⚠️  Could not save state to ${stateFile}`))
  }
}

function printSummary(result: MigrationResult, dryRun?: boolean) {
  const prefix = dryRun ? chalk.cyan('[dry-run] ') : ''
  console.log('')
  console.log(chalk.bold(`${prefix}Migration complete`))
  console.log(`  Collections created : ${chalk.green(result.collectionsCreated)}`)
  console.log(`  Articles created    : ${chalk.green(result.articlesCreated)}`)
  console.log(`  Articles skipped    : ${chalk.dim(result.articlesSkipped)}`)

  if (result.errors.length > 0) {
    console.log(`  Errors              : ${chalk.red(result.errors.length)}`)
    for (const e of result.errors) {
      console.log(chalk.red(`    • ${e.title}: ${e.reason}`))
    }
  }
}

program.parse()

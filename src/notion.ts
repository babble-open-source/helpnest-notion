import { Client, isFullPage, isFullDatabase } from '@notionhq/client'
import type { PageObjectResponse, DatabaseObjectResponse } from '@notionhq/client/build/src/api-endpoints.js'
import { NotionToMarkdown } from 'notion-to-md'
import type { NotionDatabase, NotionPage } from './types.js'

export class NotionClient {
  private client: Client
  private n2m: NotionToMarkdown

  constructor(apiKey: string) {
    this.client = new Client({ auth: apiKey })
    this.n2m = new NotionToMarkdown({ notionClient: this.client })
  }

  async listDatabases(): Promise<NotionDatabase[]> {
    const results: NotionDatabase[] = []
    let cursor: string | undefined

    do {
      const res = await this.client.search({
        filter: { value: 'database', property: 'object' },
        start_cursor: cursor,
        page_size: 100,
      })

      for (const item of res.results) {
        if (!isFullDatabase(item)) continue
        const db = item as DatabaseObjectResponse
        const title = db.title.map((t) => t.plain_text).join('') || 'Untitled'
        results.push({ id: db.id, title, url: db.url })
      }

      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
    } while (cursor)

    return results
  }

  async getPagesInDatabase(databaseId: string): Promise<NotionPage[]> {
    const results: NotionPage[] = []
    let cursor: string | undefined

    do {
      const res = await this.client.databases.query({
        database_id: databaseId,
        start_cursor: cursor,
        page_size: 100,
        filter: { property: 'object', formula: { string: { is_not_empty: true } } },
      })

      for (const item of res.results) {
        if (!isFullPage(item)) continue
        const page = this.parsePageObject(item as PageObjectResponse)
        if (!page.archived) results.push(page)
      }

      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
    } while (cursor)

    return results
  }

  async getAllPages(): Promise<NotionPage[]> {
    const results: NotionPage[] = []
    let cursor: string | undefined

    do {
      const res = await this.client.search({
        filter: { value: 'page', property: 'object' },
        start_cursor: cursor,
        page_size: 100,
      })

      for (const item of res.results) {
        if (!isFullPage(item)) continue
        const page = this.parsePageObject(item as PageObjectResponse)
        if (!page.archived) results.push(page)
      }

      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
    } while (cursor)

    return results
  }

  async getPageMarkdown(pageId: string): Promise<string> {
    const mdBlocks = await this.n2m.pageToMarkdown(pageId)
    return this.n2m.toMarkdownString(mdBlocks).parent
  }

  private parsePageObject(page: PageObjectResponse): NotionPage {
    // Title can be in 'title', 'Name', or 'Page' property
    let title = 'Untitled'
    for (const [, prop] of Object.entries(page.properties)) {
      if (prop.type === 'title' && prop.title.length > 0) {
        title = prop.title.map((t) => t.plain_text).join('')
        break
      }
    }

    // Icon
    let icon: string | null = null
    if (page.icon?.type === 'emoji') {
      icon = page.icon.emoji
    }

    // Parent
    let parentDatabaseId: string | null = null
    let parentPageId: string | null = null
    if (page.parent.type === 'database_id') {
      parentDatabaseId = page.parent.database_id
    } else if (page.parent.type === 'page_id') {
      parentPageId = page.parent.page_id
    }

    return {
      id: page.id,
      title,
      url: page.url,
      parentDatabaseId,
      parentPageId,
      lastEditedTime: page.last_edited_time,
      createdTime: page.created_time,
      archived: page.archived,
      icon,
    }
  }
}

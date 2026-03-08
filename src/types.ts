export interface NotionDatabase {
  id: string
  title: string
  url: string
}

export interface NotionPage {
  id: string
  title: string
  url: string
  parentDatabaseId: string | null
  parentPageId: string | null
  lastEditedTime: string
  createdTime: string
  archived: boolean
  icon: string | null // emoji or external URL
}

export interface NotionBlock {
  id: string
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface HelpNestCollection {
  title: string
  description: string
  emoji: string | null
  slug: string
}

export interface HelpNestArticle {
  title: string
  content: string // Markdown
  excerpt: string
  slug: string
  collectionId?: string
}

export interface MigrationResult {
  collectionsCreated: number
  articlesCreated: number
  articlesSkipped: number
  errors: Array<{ title: string; reason: string }>
}

export interface MigrationState {
  collectionMap: Record<string, string> // notion page/db id → helpnest collection id
  articleMap: Record<string, string>    // notion page id → helpnest article id
  lastRunAt: string
}

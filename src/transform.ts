import type { NotionPage, HelpNestCollection, HelpNestArticle } from './types.js'

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function extractExcerpt(markdown: string): string {
  // Strip markdown syntax and grab first ~160 chars
  const plain = markdown
    .replace(/^#{1,6}\s+.+$/gm, '') // headings
    .replace(/!\[.*?\]\(.*?\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/[`*_~>|]/g, '') // inline formatting
    .replace(/\n{2,}/g, ' ')
    .trim()

  return plain.slice(0, 160).replace(/\s+\S*$/, '…')
}

export function transformCollection(page: NotionPage): HelpNestCollection {
  return {
    title: page.title,
    description: `Imported from Notion`,
    emoji: page.icon,
    slug: slugify(page.title),
  }
}

export function transformArticle(page: NotionPage, markdown: string): HelpNestArticle {
  return {
    title: page.title,
    content: markdown,
    excerpt: extractExcerpt(markdown),
    slug: slugify(page.title),
  }
}

import type { HelpNestCollection, HelpNestArticle } from './types.js'

export class HelpNestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'HelpNestError'
  }
}

export class HelpNestClient {
  private baseUrl: string
  private apiKey: string
  private workspace: string

  constructor(opts: { baseUrl: string; apiKey: string; workspace: string }) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '')
    this.apiKey = opts.apiKey
    this.workspace = opts.workspace
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'x-workspace': this.workspace,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new HelpNestError(`HelpNest API error: ${text}`, res.status)
    }

    return res.json() as Promise<T>
  }

  async createCollection(data: HelpNestCollection): Promise<{ id: string }> {
    return this.request('POST', '/api/collections', data)
  }

  async createArticle(data: HelpNestArticle & { status?: string }): Promise<{ id: string }> {
    return this.request('POST', '/api/articles', { ...data, status: data.status ?? 'PUBLISHED' })
  }
}

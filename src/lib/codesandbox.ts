const CS_API = 'https://codesandbox.io/api/v1'

const LANG_EXT: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
  react: 'tsx',
}

/**
 * Extracts a CodeSandbox sandbox ID from a URL.
 * Supports the /s/, /p/sandbox/, and /embed/ URL formats.
 * Returns null for any non-CodeSandbox URL or empty string.
 */
export function parseSandboxId(url: string): string | null {
  if (!url) return null
  const patterns = [
    /codesandbox\.io\/s\/([^/?#\s]+)/,
    /codesandbox\.io\/p\/sandbox\/([^/?#\s]+)/,
    /codesandbox\.io\/embed\/([^/?#\s]+)/,
  ]
  for (const re of patterns) {
    const match = url.match(re)
    if (match) return match[1]
  }
  return null
}

/**
 * Returns the CodeSandbox embed URL for a given sandbox ID.
 */
export function sandboxEmbedUrl(sandboxId: string): string {
  return `https://codesandbox.io/embed/${sandboxId}?fontsize=14&hidenavigation=0&theme=dark`
}

/**
 * Returns the direct open URL for a given sandbox ID.
 */
export function sandboxOpenUrl(sandboxId: string): string {
  return `https://codesandbox.io/s/${sandboxId}`
}

/**
 * Creates a new CodeSandbox sandbox with the given starter code and spec.
 *
 * Uses the `/define?json=1` endpoint which is the stable public API for
 * creating sandboxes programmatically.
 *
 * @returns The sandbox ID and the current timestamp as `updatedAt`.
 */
export async function createSandbox(
  token: string,
  opts: { title: string; starterCode: string; spec: string; language: string },
): Promise<{ id: string; updatedAt: string }> {
  const ext = LANG_EXT[opts.language] ?? 'ts'
  const res = await fetch(`${CS_API}/sandboxes/define?json=1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      files: {
        [`index.${ext}`]: { content: opts.starterCode },
        'README.md': { content: `# ${opts.title}\n\n${opts.spec}` },
      },
    }),
  })

  if (!res.ok) throw new Error(`CodeSandbox API error: ${res.status}`)

  const data = (await res.json()) as Record<string, unknown>
  const id = (data.sandbox_id ?? data.id) as string | undefined
  if (!id) throw new Error('CodeSandbox returned no sandbox ID')

  return { id, updatedAt: new Date().toISOString() }
}

/**
 * Fetches metadata for an existing sandbox.
 *
 * Returns `null` when the sandbox is not found or the request fails,
 * rather than throwing — callers can treat a missing sandbox gracefully.
 */
export async function fetchSandboxMeta(
  token: string,
  sandboxId: string,
): Promise<{ updatedAt: string } | null> {
  try {
    const res = await fetch(`${CS_API}/sandboxes/${sandboxId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) return null

    const data = (await res.json()) as Record<string, unknown>
    const sandboxData = data.sandbox as Record<string, unknown> | undefined

    const updatedAt =
      (data.updated_at as string | undefined) ??
      (data.updatedAt as string | undefined) ??
      (sandboxData?.updated_at as string | undefined) ??
      null

    return updatedAt ? { updatedAt } : null
  } catch {
    return null
  }
}

import type { AiKataCandidate } from '@/lib/ai/types'

const CS_API = 'https://api.codesandbox.io/api/v1'

const LANG_EXT: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
  react: 'tsx',
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
 * Extracts a CodeSandbox sandbox ID from a URL.
 * Re-exported from the migration module which is the canonical implementation.
 */
export { parseSandboxIdFromUrl } from '@/db/migration'

/**
 * Creates a new CodeSandbox sandbox from an AI-generated kata candidate.
 *
 * Sends starter code and a README (title + steps bullet list) to the
 * CodeSandbox API. The file extension is derived from the candidate's language.
 *
 * @returns The sandbox ID string.
 */
export async function createSandbox(params: {
  candidate: AiKataCandidate
  csToken: string
}): Promise<string> {
  const { candidate, csToken } = params
  const ext = LANG_EXT[candidate.language ?? 'typescript']
  const readmeContent = `# ${candidate.title}\n\n${candidate.steps.map((step) => `- ${step}`).join('\n')}`

  const res = await fetch(`${CS_API}/sandboxes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${csToken}`,
    },
    body: JSON.stringify({
      files: {
        [`index.${ext}`]: { content: candidate.starterCode },
        'README.md': { content: readmeContent },
      },
    }),
  })

  if (!res.ok) throw new Error(`CodeSandbox API error: ${res.status}`)

  const data = (await res.json()) as Record<string, unknown>
  const id = (data.sandbox_id ?? data.id) as string | undefined
  if (!id) throw new Error('CodeSandbox returned no sandbox ID')

  return id
}

/**
 * Fetches metadata for an existing sandbox.
 *
 * @returns An object with the sandbox ID and its last-updated timestamp.
 * @throws If the request fails or the response cannot be parsed.
 */
export async function fetchSandboxMetadata(params: {
  sandboxId: string
  csToken: string
}): Promise<{ sandboxId: string; updatedAt: string }> {
  const { sandboxId, csToken } = params

  const res = await fetch(`${CS_API}/sandboxes/${sandboxId}`, {
    headers: { Authorization: `Bearer ${csToken}` },
  })

  if (!res.ok) throw new Error(`CodeSandbox API error: ${res.status}`)

  const data = (await res.json()) as Record<string, unknown>
  const sandboxData = data.sandbox as Record<string, unknown> | undefined

  const updatedAt =
    (data.updated_at as string | undefined) ??
    (data.updatedAt as string | undefined) ??
    (sandboxData?.updated_at as string | undefined) ??
    null

  if (!updatedAt) throw new Error('CodeSandbox returned no updatedAt timestamp')

  return { sandboxId, updatedAt }
}

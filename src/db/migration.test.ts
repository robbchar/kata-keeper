import { describe, it, expect } from 'vitest'
import { mapLegacyKata, parseSandboxIdFromUrl } from './migration'

describe('parseSandboxIdFromUrl', () => {
  it('parses /s/ URLs', () => {
    expect(parseSandboxIdFromUrl('https://codesandbox.io/s/abc123')).toBe('abc123')
  })

  it('parses /p/sandbox/ URLs', () => {
    expect(parseSandboxIdFromUrl('https://codesandbox.io/p/sandbox/my-sandbox-xyz')).toBe('my-sandbox-xyz')
  })

  it('returns null for non-CS URLs', () => {
    expect(parseSandboxIdFromUrl('https://github.com/user/repo')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseSandboxIdFromUrl('')).toBeNull()
  })
})

describe('mapLegacyKata', () => {
  const base = {
    id: 'kata-1',
    title: 'Build a hook',
    languages: ['typescript' as const],
    tags: ['hooks'],
    status: 'backlog' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  }

  it('maps title, languages, tags, notes, createdAt', () => {
    const result = mapLegacyKata({ ...base, notes: 'my notes' })
    expect(result.title).toBe('Build a hook')
    expect(result.languages).toEqual(['typescript'])
    expect(result.tags).toEqual(['hooks'])
    expect(result.notes).toBe('my notes')
    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('parses sandboxId from a CodeSandbox link', () => {
    const result = mapLegacyKata({ ...base, link: 'https://codesandbox.io/s/abc123' })
    expect(result.sandboxId).toBe('abc123')
  })

  it('drops non-CS links', () => {
    const result = mapLegacyKata({ ...base, link: 'https://github.com/foo/bar' })
    expect(result.sandboxId).toBeUndefined()
  })

  it('filters languages to the bounded set', () => {
    const result = mapLegacyKata({ ...base, languages: ['python' as any, 'typescript'] })
    expect(result.languages).toEqual(['typescript'])
  })

  it('defaults to typescript when no valid language survives', () => {
    const result = mapLegacyKata({ ...base, languages: ['python' as any] })
    expect(result.languages).toEqual(['typescript'])
  })
})

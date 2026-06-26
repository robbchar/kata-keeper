export type Id = string

export type Language = 'javascript' | 'typescript' | 'react'

export interface Kata {
  id: Id
  title: string
  languages: Language[]
  tags: string[]
  sandboxId?: string
  sandboxUpdatedAt?: string
  notes?: string
  createdAt: string
}
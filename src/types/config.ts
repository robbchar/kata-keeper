export interface UserConfig {
  aiProvider: 'openai' | 'anthropic'
  aiApiKey: string
  csToken: string
  csGitHubConnected: boolean
  tags: string[]
}

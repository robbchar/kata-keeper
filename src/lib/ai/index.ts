import type { UserConfig } from '@/types/config'
import type { AiProvider } from './types'
import { OpenAIProvider } from './openai'
import { AnthropicProvider } from './anthropic'

export type { AiProvider, AiKataCandidate, GenerateKataParams, CostEstimate } from './types'
export { estimateMinutes } from './prompt'

export function createAiProvider(
  config: Pick<UserConfig, 'aiProvider' | 'aiApiKey'>,
): AiProvider {
  if (config.aiProvider === 'anthropic') {
    return new AnthropicProvider(config.aiApiKey)
  }
  return new OpenAIProvider(config.aiApiKey)
}

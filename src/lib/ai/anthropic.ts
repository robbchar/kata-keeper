import type { AiProvider, AiKataCandidate, GenerateKataParams, CostEstimate } from './types'
import { buildSystemPrompt, buildUserPrompt } from './prompt'

// claude-sonnet-4-6 pricing per token — verify at https://www.anthropic.com/api if stale
const PRICE_PER_INPUT_TOKEN = 0.003 / 1_000
const PRICE_PER_OUTPUT_TOKEN = 0.015 / 1_000

const JSON_INSTRUCTION = ' Return ONLY valid JSON — no markdown fencing.'
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

type AnthropicMessage = {
  content: Array<{ type: string; text?: string }>
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export class AnthropicProvider implements AiProvider {
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generateKata(params: GenerateKataParams): Promise<AiKataCandidate> {
    const systemPrompt = buildSystemPrompt() + JSON_INSTRUCTION

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        // Required for browser-side direct calls to the Anthropic API
        'anthropic-dangerous-direct-browser-calls': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: buildUserPrompt(params) }],
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Anthropic request failed (${response.status}): ${body}`)
    }

    const data = (await response.json()) as AnthropicMessage
    const raw = data.content[0]?.type === 'text' ? (data.content[0].text ?? '{}') : '{}'
    return JSON.parse(raw) as AiKataCandidate
  }

  estimateCost(candidate: AiKataCandidate, params: GenerateKataParams): CostEstimate {
    // Rough token estimate: characters / 4 (standard approximation)
    const systemPrompt = buildSystemPrompt() + JSON_INSTRUCTION
    const inputText = systemPrompt + '\n' + buildUserPrompt(params)
    const outputText = JSON.stringify(candidate)

    const inputTokens = Math.ceil(inputText.length / 4)
    const outputTokens = Math.ceil(outputText.length / 4)

    return {
      inputTokens,
      outputTokens,
      totalUSD: inputTokens * PRICE_PER_INPUT_TOKEN + outputTokens * PRICE_PER_OUTPUT_TOKEN,
    }
  }
}

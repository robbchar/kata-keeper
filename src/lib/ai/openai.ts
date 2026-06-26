import type { AiProvider, AiKataCandidate, GenerateKataParams, CostEstimate } from './types'
import { buildSystemPrompt, buildUserPrompt } from './prompt'

// gpt-4o-mini pricing per token — verify at https://openai.com/api/pricing if stale
const PRICE_PER_INPUT_TOKEN = 0.00015 / 1_000
const PRICE_PER_OUTPUT_TOKEN = 0.0006 / 1_000

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

const JSON_SCHEMA = {
  name: 'kata',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      steps: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
      starterCode: { type: 'string' },
    },
    required: ['title', 'summary', 'steps', 'starterCode'],
  },
} as const

type OpenAIChatResponse = {
  choices: Array<{
    message: { content: string | null }
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
  }
}

export class OpenAIProvider implements AiProvider {
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generateKata(params: GenerateKataParams): Promise<AiKataCandidate> {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_schema', json_schema: JSON_SCHEMA },
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(params) },
        ],
        temperature: 0.5,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`OpenAI request failed (${response.status}): ${body}`)
    }

    const data = (await response.json()) as OpenAIChatResponse
    const raw = data.choices[0]?.message?.content ?? '{}'
    return JSON.parse(raw) as AiKataCandidate
  }

  estimateCost(candidate: AiKataCandidate, params: GenerateKataParams): CostEstimate {
    // Rough token estimate: characters / 4 (standard approximation)
    const inputText = buildSystemPrompt() + '\n' + buildUserPrompt(params)
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

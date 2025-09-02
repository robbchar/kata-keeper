import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions, logger } from 'firebase-functions/v2';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import OpenAI from 'openai';

function extractStatus(e: unknown): number | undefined {
  if (typeof e === 'object' && e !== null) {
    const o = e as { status?: unknown; response?: { status?: unknown } };
    if (typeof o.status === 'number') return o.status;
    if (o.response && typeof o.response.status === 'number') return o.response.status;
  }
  return undefined;
}

function extractMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

setGlobalOptions({ region: 'us-west1', maxInstances: 5 });
if (getApps().length === 0) {
  initializeApp();
}

/** ====== Budget config (adjust if you like) ====== */
const BUDGET_USD = 0.5; // monthly cap
// gpt-4o-mini standard rates (USD per token). Update here if pricing changes.
const PRICE_IN = 0.6 / 1_000_000; // $0.60 / 1M input tokens
const PRICE_OUT = 2.4 / 1_000_000; // $2.40 / 1M output tokens
// Worst-case single-call cost guard to avoid overshoot (very conservative)
const MAX_CALL_COST_USD = 0.005; // ~0.5¢

type Language =
  | 'javascript'
  | 'typescript'
  | 'react'
  | 'vue'
  | 'angular'
  | 'node'
  | 'css'
  | 'html'
  | 'python'
  | 'go'
  | 'other';

type UiDifficulty = 'warmup' | 'easy' | 'medium' | 'hard';
type UiLength = 'Snack' | 'Standard' | 'DeepDive';

type GenerateInput = {
  influence?: string;
  language?: Language;
  difficulty?: UiDifficulty;
  length?: UiLength;
};

type AiKataCandidate = {
  title: string;
  summary: string;
  description: string;
  steps: string[];
  tags: string[];
  starterCode: string;
  tests: string;
  solution: string;
  hints: string[];
  acceptanceCriteria: string[];
};

function monthKey(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`; // e.g., "2025-09"
}

export const previewKata = onCall({ secrets: ['OPENAI_API_KEY'] }, async (req) => {
  try {
    if (!req.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in to generate kata previews.');
    }
    logger.info('previewKata:start', {
      uid: req.auth?.uid,
      meta: req.data
        ? {
            hasInfluence: !!req.data.influence,
            language: req.data.language,
            difficulty: req.data.difficulty,
            length: req.data.length,
          }
        : null,
    });

    const db = getFirestore();
    const ym = monthKey();
    const usageRef = db.doc(`usage/previewKata-${ym}`);
    const usageSnap = await usageRef.get();
    const spentSoFar = (usageSnap.exists ? usageSnap.data()?.costUSD : 0) ?? 0;

    // Hard stop if we’re at/over budget
    if (spentSoFar >= BUDGET_USD) {
      throw new HttpsError(
        'resource-exhausted',
        `Monthly preview budget reached ($${spentSoFar.toFixed(2)} / $${BUDGET_USD.toFixed(2)}).`,
      );
    }
    // Soft guard to avoid going over by a worst-case single call
    if (spentSoFar + MAX_CALL_COST_USD > BUDGET_USD) {
      throw new HttpsError(
        'resource-exhausted',
        `Monthly preview budget nearly reached ($${spentSoFar.toFixed(2)} / $${BUDGET_USD.toFixed(2)}). Try again next month.`,
      );
    }

    const {
      influence = '',
      language = 'typescript',
      difficulty = 'medium',
      length = 'Standard',
    } = (req.data || {}) as GenerateInput;

    const estMinutes = length === 'Snack' ? 15 : length === 'DeepDive' ? 75 : 35;

    const promptDifficulty =
      difficulty === 'warmup'
        ? 'Beginner'
        : difficulty === 'easy'
          ? 'Beginner'
          : difficulty === 'medium'
            ? 'Intermediate'
            : 'Advanced';

    const languageInstruction =
      language === 'react'
        ? 'React (TSX)'
        : language === 'vue'
          ? 'Vue 3 (Composition API, TypeScript)'
          : language === 'angular'
            ? 'Angular (TypeScript)'
            : language === 'node'
              ? 'Node.js (TypeScript)'
              : language === 'css'
                ? 'CSS (with minimal HTML scaffold if needed)'
                : language === 'html'
                  ? 'HTML + CSS (+ tiny JS if needed)'
                  : language === 'javascript'
                    ? 'JavaScript'
                    : language === 'typescript'
                      ? 'TypeScript'
                      : language === 'python'
                        ? 'Python'
                        : language === 'go'
                          ? 'Go'
                          : 'JavaScript';

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const jsonSchema = {
      name: 'kata',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', maxLength: 60 },
          summary: { type: 'string' },
          description: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 7 },
          starterCode: { type: 'string' },
          tests: { type: 'string' },
          solution: { type: 'string' },
          hints: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
          acceptanceCriteria: {
            type: 'array',
            items: { type: 'string' },
            minItems: 3,
            maxItems: 8,
          },
        },
        required: [
          'title',
          'summary',
          'description',
          'steps',
          'tags',
          'starterCode',
          'tests',
          'solution',
          'hints',
          'acceptanceCriteria',
        ],
      },
    };

    const sys = [
      'You generate concise, runnable coding katas.',
      `Respect difficulty=${promptDifficulty}, target time=${estMinutes} min.`,
      'Keep code minimal; avoid heavy deps. Title ≤ 8 words.',
    ].join(' ');

    const user = [
      influence ? `Influence/focus: ${influence}` : '',
      `All code/tests in ${languageInstruction}.`,
      'Return ONLY the JSON matching the schema.',
    ]
      .filter(Boolean)
      .join('\n');

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_schema', json_schema: jsonSchema },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      temperature: 0.5,
      max_tokens: 1500,
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const candidate = JSON.parse(raw) as AiKataCandidate;

    // ===== Usage accounting (exact, based on OpenAI usage) =====
    const inTokens = completion.usage?.prompt_tokens ?? 0;
    const outTokens = completion.usage?.completion_tokens ?? 0;
    const thisCallUSD = inTokens * PRICE_IN + outTokens * PRICE_OUT;

    await usageRef.set(
      {
        ym,
        calls: FieldValue.increment(1),
        tokensIn: FieldValue.increment(inTokens),
        tokensOut: FieldValue.increment(outTokens),
        costUSD: FieldValue.increment(thisCallUSD),
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );

    const spentAfter = spentSoFar + thisCallUSD;

    logger.info('previewKata:ok', { uid: req.auth?.uid, estMinutes });
    return {
      candidate,
      meta: {
        language,
        difficulty,
        length,
        estMinutes,
        usage: {
          month: ym,
          spentUSD: Number(spentAfter.toFixed(4)),
          budgetUSD: BUDGET_USD,
          thisCallUSD: Number(thisCallUSD.toFixed(4)),
          tokens: { in: inTokens, out: outTokens },
        },
      },
    };
  } catch (err: unknown) {
    console.error('previewKata error:', err);
    logger.error('previewKata:error', {
      uid: req.auth?.uid,
      message: err instanceof Error ? err.message : String(err),
    });

    // Preserve previously thrown Firebase errors
    if (err instanceof HttpsError) throw err;

    const msg = extractMessage(err);
    const status = extractStatus(err);

    // Quota/billing exhaustion (distinct from rate limiting)
    if (/exceeded your current quota/i.test(msg)) {
      throw new HttpsError(
        'resource-exhausted',
        'OpenAI API quota/budget exceeded for this API key. Add billing/credits and try again.',
      );
    }

    // Generic 429 rate limit
    if (status === 429) {
      throw new HttpsError('unavailable', 'OpenAI rate limit hit. Please retry in a moment.');
    }

    throw new HttpsError('internal', msg || 'Unknown error');
  }
});

import type { Kata, Language, Difficulty } from '@/types';
import { db } from '@/db';

type UiDifficulty = 'warmup' | 'easy' | 'medium' | 'hard';

export type AiKataCandidate = {
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

function toDifficulty(d: UiDifficulty | undefined): Difficulty | undefined {
  return d as Difficulty | undefined;
}

function toLanguageArray(lang: Language | undefined): Language[] {
  return lang ? [lang] : ['typescript'];
}

function codeFence(lang: Language, code: string) {
  const map: Record<Language, string> = {
    typescript: 'ts',
    javascript: 'js',
    react: 'tsx',
    angular: 'ts',
    vue: 'js',
    node: 'ts',
    css: 'css',
    html: 'html',
    python: 'py',
    go: 'go',
    other: 'txt',
  };
  const fence = map[lang] ?? 'txt';
  return `\`\`\`${fence}\n${code || '// add code'}\n\`\`\``;
}

function mdSection(h: string, body: string) {
  return `## ${h}\n\n${body || ''}`;
}
function mdList(h: string, items: string[]) {
  return `## ${h}\n\n${(items || []).map((i) => `- ${i}`).join('\n')}`;
}

function buildRequirementsMarkdown(c: AiKataCandidate, lang: Language) {
  return [
    mdSection('Summary', c.summary),
    mdSection('Description', c.description),
    mdList('Steps', c.steps),
    mdList('Acceptance Criteria', c.acceptanceCriteria),
    mdList('Hints', c.hints),
    mdSection('Starter Code', codeFence(lang, c.starterCode)),
    mdSection('Tests', codeFence(lang, c.tests)),
    mdSection('Solution', codeFence(lang, c.solution)),
  ].join('\n\n');
}

export async function saveAiPreviewLocal(
  candidate: AiKataCandidate,
  opts: { language?: Language; difficulty?: UiDifficulty },
): Promise<Kata> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const language = opts.language ?? 'typescript';

  const kata: Kata = {
    id,
    title: candidate.title,
    description: candidate.summary || candidate.description?.slice(0, 160),
    requirements: buildRequirementsMarkdown(candidate, language),
    languages: toLanguageArray(language),
    tags: (candidate.tags || []).map((t) => t.toLowerCase()),
    link: undefined,
    notes: undefined,
    status: 'backlog',
    difficulty: toDifficulty(opts.difficulty),
    createdAt: now,
    updatedAt: now,
    lastWorkedAt: undefined,
  };

  await db.katas.put(kata); // uses your existing Dexie table
  return kata;
}

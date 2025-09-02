import type { Kata, Language, Difficulty } from '@/types';

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

const normalizeTags = (tags: string[]) =>
  [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12);

export function mapPreviewToKata(
  c: AiKataCandidate,
  language: Language,
  difficulty?: Difficulty | 'warmup' | 'easy' | 'medium' | 'hard',
): Omit<Kata, 'id'> {
  const now = new Date().toISOString();

  const reqMd = [
    c.description && `### Description\n${c.description}`,
    c.acceptanceCriteria?.length &&
      `### Acceptance Criteria\n- ${c.acceptanceCriteria.join('\n- ')}`,
    c.hints?.length && `### Hints\n- ${c.hints.join('\n- ')}`,
    c.starterCode && `### Starter Code\n\`\`\`\n${c.starterCode}\n\`\`\``,
    c.tests && `### Tests (suggested)\n\`\`\`\n${c.tests}\n\`\`\``,
    c.solution && `### Solution (reference)\n\`\`\`\n${c.solution}\n\`\`\``,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    title: c.title,
    description: c.summary || c.description,
    requirements: reqMd,
    languages: [language],
    tags: normalizeTags(c.tags),
    status: 'backlog',
    difficulty: difficulty as Difficulty | undefined,
    createdAt: now,
    updatedAt: now,
  };
}

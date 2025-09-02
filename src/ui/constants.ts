export const LANGS = [
  'javascript',
  'typescript',
  'react',
  'vue',
  'angular',
  'node',
  'css',
  'html',
  'python',
  'go',
  'other',
] as const;

export const DIFFS = ['warmup', 'easy', 'medium', 'hard'] as const;

export const LENGTHS = ['Snack', 'Standard', 'DeepDive'] as const;

export type Length = (typeof LENGTHS)[number];

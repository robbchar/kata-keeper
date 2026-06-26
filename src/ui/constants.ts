export const LANGS = ['javascript', 'typescript', 'react'] as const;

export const DIFFS = ['easy', 'medium', 'hard'] as const;

export const LENGTHS = ['Snack', 'Standard', 'DeepDive'] as const;

export type Length = (typeof LENGTHS)[number];

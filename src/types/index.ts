export type Id = string;
export type Language =
  | "javascript"
  | "typescript"
  | "react"
  | "vue"
  | "angular"
  | "node"
  | "css"
  | "html"
  | "python"
  | "go"
  | "other";

export type Status = "backlog" | "in-progress" | "done" | "abandoned";
export type Difficulty = "warmup" | "easy" | "medium" | "hard";

export interface Kata {
  id: Id;
  title: string;
  description?: string; // short blurb (plain or markdown later)
  requirements?: string; // long text/markdown later
  languages: Language[];
  tags: string[]; // freeform, lowercased
  link?: string; // CodeSandbox/GitHub URL
  notes?: string; // running notes
  status: Status;
  difficulty?: Difficulty;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  lastWorkedAt?: string; // ISO
}
import { nowISO, uuid } from "../db";
import type { Kata } from "../types";

// optional
export const SEED: Kata[] = [
  {
    id: uuid(),
    title: "Accessible Async Autocomplete",
    description: "Combobox with async search, debounce, abort, and a11y.",
    requirements: "Keyboard: Up/Down/Enter/Escape. Cancel in-flight. Cache by query.",
    languages: ["react", "typescript"],
    tags: ["a11y", "async", "debounce", "abort", "components"],
    link: "",
    notes: "",
    status: "backlog",
    difficulty: "medium",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
  {
    id: uuid(),
    title: "Filterable List with Highlight",
    description: "Filter + highlight matches with keyboard selection.",
    requirements: "300ms debounce; listbox/option roles; Enter selects.",
    languages: ["react", "typescript"],
    tags: ["a11y", "filter", "highlight"],
    link: "",
    notes: "",
    status: "backlog",
    difficulty: "easy",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
];
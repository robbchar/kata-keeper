import Dexie, { type Table } from "dexie";
import type { Kata, Id, Language, Status, Difficulty } from "../types";

class KataDB extends Dexie {
  katas!: Table<Kata, Id>;
  constructor() {
    super("kata-keeper");
    this.version(1).stores({
      // primary key id; indexes for common queries
      katas: "id, title, status, difficulty, *languages, *tags, createdAt, updatedAt, lastWorkedAt",
    });
  }
}
const db = new KataDB();

/***** Small repo helpers *****/
export const KataRepo = {
  list: () => db.katas.orderBy("updatedAt").reverse().toArray(),
  get: (id: Id) => db.katas.get(id),
  upsert: (k: Kata) => db.katas.put(k),
  update: (id: Id, patch: Partial<Kata>) => db.katas.update(id, patch),
  remove: (id: Id) => db.katas.delete(id),
  bulkAdd: (items: Kata[]) => db.katas.bulkPut(items),
};

/***** Utilities *****/
export const LANGUAGES: Language[] = [
  "javascript",
  "typescript",
  "react",
  "vue",
  "angular",
  "node",
  "css",
  "html",
  "python",
  "go",
  "other",
];
export const STATUSES: Status[] = ["backlog", "in-progress", "done", "abandoned"];
export const DIFFICULTIES: Difficulty[] = ["warmup", "easy", "medium", "hard"];

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function nowISO(): string { return new Date().toISOString(); }

export function classNames(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatRelative(iso?: string) {
  if (!iso) return "—";
  const dt = new Date(iso);
  const diff = Date.now() - dt.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d ago`;
  return dt.toLocaleDateString();
}

export async function tryEnablePersistentStorage(): Promise<boolean> {
  // Ask the browser not to evict our data under pressure
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const persisted = await navigator.storage?.persisted?.();
  if (persisted) return true;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return (await navigator.storage?.persist?.()) ?? false;
}
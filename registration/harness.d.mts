export interface Backend {
  get(params: Record<string, string>): Record<string, unknown>;
  post(body: unknown): Record<string, unknown>;
  rawPost(text: string): Record<string, unknown>;
  stats: { locks: number; unlocks: number; formulaCells: number };
  rows(): string[][];
  sheet(): { textColumns: Set<number>; frozen: number; rtl: boolean } | null;
  props: Map<string, string>;
}
export function createBackend(opts?: { adminKey?: string | null }): Backend;

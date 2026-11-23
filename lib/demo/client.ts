// Public showcase transport: local synthetic data only, never a Supabase connection.
import type { SupabaseClient } from "@supabase/supabase-js";
type Row = Record<string, unknown>;
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const artist = id(1),
  manager = id(2),
  org = id(3),
  artistRow = id(4);
const now = () => new Date().toISOString();
const today = new Date().toISOString().slice(0, 10);
const userId = () =>
  typeof window !== "undefined" && window.location.pathname.startsWith("/label")
    ? manager
    : artist;
const tables: Record<string, Row[]> = {
  profiles: [
    {
      id: artist,
      artist_name: "KIRA",
      full_name: "Кира",
      email: "artist@example.invalid",
      role: "artist",
      telegram: "",
      monthly_listeners: 24500,
    },
    {
      id: manager,
      full_name: "Александр · UNIT",
      email: "label@example.invalid",
      role: "label",
    },
  ],
  organizations: [{ id: org, name: "UNIT Records" }],
  memberships: [
    {
      id: id(5),
      org_id: org,
      user_id: manager,
      role: "label_admin",
      organizations: { name: "UNIT Records" },
    },
  ],
  artists: [
    {
      id: artistRow,
      org_id: org,
      user_id: artist,
      stage_name: "KIRA",
      status: "active",
      terms: { royalty_pct: 70, term_months: 24, exclusive: false },
      created_at: now(),
    },
  ],
  tasks: [
    "Подготовить тизер нового сингла",
    "Согласовать обложку",
    "Опубликовать короткое видео",
  ].map((title, i) => ({
    id: id(10 + i),
    org_id: org,
    artist_id: artistRow,
    title,
    description: "Демонстрационная задача от менеджера",
    due_date: today,
    status: "todo",
    release_id: null,
    created_by: manager,
    created_at: now(),
    completed_at: null,
  })),
  releases: [
    {
      id: id(20),
      org_id: org,
      artist_id: artistRow,
      owner_id: artist,
      title: "Новый свет",
      status: "upcoming",
      planned_date: "2026-12-18",
      release_date: "2026-12-18",
      strategy: "Выпуск сингла, короткие видео и питчинг",
      moderation_status: "pending",
      moderation_checks: {},
      is_explicit: false,
      moderation_comment: null,
      cover_path: null,
      created_at: now(),
    },
  ],
  budget_requests: [
    {
      id: id(30),
      org_id: org,
      artist_id: artistRow,
      owner_id: artist,
      category: "promo",
      purpose: "Съёмка промо-видео",
      amount: 15000,
      comment: "Вертикальный ролик к синглу",
      status: "pending",
      created_at: now(),
      needed_by: "2026-12-10",
    },
  ],
  artist_stream_stats: [
    {
      artist_id: artistRow,
      org_id: org,
      streams: 128500,
      listeners: 24500,
      updated_at: now(),
    },
  ],
  messages: [
    {
      id: id(40),
      org_id: org,
      artist_id: artistRow,
      sender_id: manager,
      from_side: "label",
      body: "Привет! Давайте согласуем материалы к новому релизу.",
      attachment: null,
      created_at: now(),
    },
  ],
  assets: [],
  promo_reports: [],
  artist_invites: [],
  team_invites: [],
  royalty_reports: [],
  promo_campaigns: [],
  stream_history: [],
};
const files = new Map<string, string>();
class Query
  implements PromiseLike<{ data: unknown; error: null; count: number }>
{
  private filters: ((r: Row) => boolean)[] = [];
  private action = "select";
  private values: Row[] = [];
  private one = false;
  private max = 10000;
  private offset = 0;
  private orders: { key: string; asc: boolean }[] = [];
  constructor(private table: string) {}
  select() {
    return this;
  }
  eq(k: string, v: unknown) {
    this.filters.push((r) => r[k] === v);
    return this;
  }
  neq(k: string, v: unknown) {
    this.filters.push((r) => r[k] !== v);
    return this;
  }
  is(k: string, v: unknown) {
    this.filters.push((r) => (r[k] ?? null) === v);
    return this;
  }
  in(k: string, v: unknown[]) {
    this.filters.push((r) => v.includes(r[k]));
    return this;
  }
  not(k: string, op: string, v: unknown) {
    this.filters.push((r) => (op === "is" ? (r[k] ?? null) !== v : r[k] !== v));
    return this;
  }
  gte(k: string, v: string) {
    this.filters.push((r) => String(r[k]) >= v);
    return this;
  }
  lte(k: string, v: string) {
    this.filters.push((r) => String(r[k]) <= v);
    return this;
  }
  gt(k: string, v: string) {
    this.filters.push((r) => String(r[k]) > v);
    return this;
  }
  lt(k: string, v: string) {
    this.filters.push((r) => String(r[k]) < v);
    return this;
  }
  order(key: string, opts?: { ascending?: boolean }) {
    this.orders.push({ key, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  range(a: number, b: number) {
    this.offset = a;
    this.max = b - a + 1;
    return this;
  }
  single() {
    this.one = true;
    return this;
  }
  maybeSingle() {
    this.one = true;
    return this;
  }
  insert(v: Row | Row[]) {
    this.action = "insert";
    this.values = Array.isArray(v) ? v : [v];
    return this;
  }
  update(v: Row) {
    this.action = "update";
    this.values = [v];
    return this;
  }
  upsert(v: Row | Row[]) {
    this.insert(v);
    this.action = "upsert";
    return this;
  }
  delete() {
    this.action = "delete";
    return this;
  }
  async then<
    TResult1 = { data: unknown; error: null; count: number },
    TResult2 = never,
  >(
    yes?:
      | ((value: {
          data: unknown;
          error: null;
          count: number;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    no?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const all = tables[this.table] ?? (tables[this.table] = []);
      let rows = all.filter((r) => this.filters.every((f) => f(r)));
      if (this.action === "upsert") {
        rows = this.values.map((v) => {
          const existing = all.find((r) =>
            v.id
              ? r.id === v.id
              : v.artist_id
                ? r.artist_id === v.artist_id
                : r.user_id === v.user_id && r.org_id === v.org_id,
          );
          if (existing) {
            Object.assign(existing, v, { updated_at: now() });
            return existing;
          }
          const fresh = { id: crypto.randomUUID(), created_at: now(), ...v };
          all.push(fresh);
          return fresh;
        });
      }
      if (this.action === "insert") {
        rows = this.values.map((v) => ({
          id: crypto.randomUUID(),
          created_at: now(),
          owner_id: userId(),
          sender_id: userId(),
          status: this.table === "tasks" ? "todo" : "pending",
          ...v,
        }));
        all.push(...rows);
      }
      if (this.action === "update")
        rows.forEach((r) => Object.assign(r, this.values[0]));
      if (this.action === "delete")
        tables[this.table] = all.filter((r) => !rows.includes(r));
      for (const order of [...this.orders].reverse())
        rows.sort(
          (a, b) =>
            String(a[order.key] ?? "").localeCompare(
              String(b[order.key] ?? ""),
            ) * (order.asc ? 1 : -1),
        );
      const count = rows.length;
      rows = rows.slice(this.offset, this.offset + this.max);
      const value = {
        data: this.one ? (rows[0] ?? null) : rows,
        error: null,
        count,
      };
      return yes ? await yes(value) : (value as TResult1);
    } catch (e) {
      if (no) return no(e);
      throw e;
    }
  }
}
const user = () => ({
  id: userId(),
  email:
    userId() === artist ? "artist@example.invalid" : "label@example.invalid",
  user_metadata: {},
  app_metadata: {},
});
const session = () => ({
  user: user(),
  access_token: "public-demo-not-a-real-token",
  refresh_token: "",
  token_type: "bearer",
  expires_in: 3600,
});
export const publicDemoClient = {
  from: (table: string) => new Query(table),
  auth: {
    getUser: async () => ({ data: { user: user() }, error: null }),
    getSession: async () => ({ data: { session: session() }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
    updateUser: async () => ({ data: { user: user() }, error: null }),
  },
  storage: {
    from: () => ({
      upload: async (path: string, file: File) => {
        const old = files.get(path);
        if (old) URL.revokeObjectURL(old);
        files.set(path, URL.createObjectURL(file));
        return { data: { path }, error: null };
      },
      remove: async (paths: string[]) => {
        for (const p of paths) {
          const url = files.get(p);
          if (url) URL.revokeObjectURL(url);
          files.delete(p);
        }
        return { data: [], error: null };
      },
      createSignedUrl: async (path: string) => ({
        data: { signedUrl: files.get(path) ?? "" },
        error: null,
      }),
    }),
  },
  rpc: async () => ({
    data: null,
    error: {
      message: "В ознакомительном режиме эта серверная операция недоступна.",
    },
  }),
} as unknown as SupabaseClient;

"use client";

import { getSupabase } from "./client";
import {
  BUCKET,
  buildStoragePath,
  getSignedUrl,
  uploadAsset,
  deleteAsset,
  type Asset,
} from "./uploads";

// Демо = аудио-ассет без привязки к релизу (release_id is null).

const GRADIENTS = [
  "linear-gradient(135deg,#E23A34,#8b1e1a)",
  "linear-gradient(135deg,#415A77,#17161A)",
  "linear-gradient(135deg,#8A5A16,#3a2606)",
  "linear-gradient(135deg,#1F9D6B,#0d3d2a)",
  "linear-gradient(135deg,#6E4AA6,#241640)",
  "linear-gradient(135deg,#4e6a8a,#17161A)",
];

/** Стабильный градиент по id — чтобы обложка-заглушка не «прыгала». */
export function gradientForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export interface Demo {
  id: string;
  title: string;
  src: string; // подписанная ссылка на аудио
  gradient: string; // запасная обложка, если картинки нет
  image: string | null; // подписанная ссылка на обложку
}

/** Строка assets с полями демо (миграция 20260729145554). */
type DemoRow = Asset & { cover_path: string | null; sort_order: number | null };

export async function listDemos(): Promise<Demo[]> {
  const { data, error } = await getSupabase()
    .from("assets")
    .select("*")
    .eq("kind", "audio")
    .is("release_id", null)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as DemoRow[];
  // Подпись делаем терпимой к сбоям: битый объект в хранилище
  // не должен скрывать весь список демо.
  const sign = async (path: string | null) => {
    if (!path) return null;
    try {
      return await getSignedUrl(path);
    } catch {
      return null;
    }
  };

  return Promise.all(
    rows.map(async (a) => ({
      id: a.id,
      title: a.title ?? "Демо",
      src: (await sign(a.storage_path)) ?? "",
      gradient: gradientForId(a.id),
      image: await sign(a.cover_path),
    }))
  );
}

export async function addDemo(file: File, onProgress?: (p: number) => void): Promise<void> {
  const asset = await uploadAsset({ file, kind: "audio", onProgress });

  // Новое демо встаёт наверх списка.
  const supabase = getSupabase();
  const { data } = await supabase
    .from("assets")
    .select("sort_order")
    .eq("kind", "audio")
    .is("release_id", null)
    .not("sort_order", "is", null)
    .order("sort_order", { ascending: true })
    .limit(1);

  const top = (data as { sort_order: number }[] | null)?.[0]?.sort_order;
  await supabase
    .from("assets")
    .update({ sort_order: typeof top === "number" ? top - 1 : 0 })
    .eq("id", asset.id);
}

export async function removeDemo(id: string): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("assets").select("*").eq("id", id).single();
  if (error) throw error;

  const row = data as DemoRow;
  // Обложку убираем отдельно — deleteAsset про неё не знает.
  if (row.cover_path) {
    await supabase.storage.from(BUCKET).remove([row.cover_path]);
  }
  await deleteAsset(row);
}

/** Загрузить или заменить обложку демо. */
export async function setDemoCover(id: string, file: File): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Нужно войти в аккаунт");

  const { data: row, error: e1 } = await supabase
    .from("assets")
    .select("cover_path")
    .eq("id", id)
    .single();
  if (e1) throw e1;
  const oldPath = (row as { cover_path: string | null }).cover_path;

  const newPath = buildStoragePath(user.id, "photo", file.name);
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(newPath, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) throw upErr;

  const { error: updErr } = await supabase
    .from("assets")
    .update({ cover_path: newPath })
    .eq("id", id);
  if (updErr) {
    await supabase.storage.from(BUCKET).remove([newPath]);
    throw updErr;
  }

  if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
}

/** Поменять демо местами с соседом: dir -1 — выше, 1 — ниже. */
export async function moveDemo(id: string, dir: -1 | 1): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("assets")
    .select("id, sort_order")
    .eq("kind", "audio")
    .is("release_id", null)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as { id: string; sort_order: number | null }[];
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;

  // Позиции могли не проставиться (например, строка создана в обход addDemo) —
  // нормализуем по текущему порядку, иначе меняться будет нечему.
  const needsNormalize = rows.some((r) => typeof r.sort_order !== "number");
  const positions = rows.map((r, idx) => (needsNormalize ? idx : (r.sort_order as number)));

  await Promise.all([
    supabase.from("assets").update({ sort_order: positions[j] }).eq("id", rows[i].id),
    supabase.from("assets").update({ sort_order: positions[i] }).eq("id", rows[j].id),
  ]);

  if (needsNormalize) {
    await Promise.all(
      rows.map((r, idx) =>
        idx === i || idx === j
          ? Promise.resolve()
          : supabase.from("assets").update({ sort_order: positions[idx] }).eq("id", r.id)
      )
    );
  }
}

export async function renameDemo(id: string, title: string): Promise<void> {
  const { error } = await getSupabase()
    .from("assets")
    .update({ title: title.trim() || "Демо" })
    .eq("id", id);
  if (error) throw error;
}

/** Заменить аудиофайл демо, сохранив его строку. */
export async function replaceDemoAudio(id: string, file: File): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Нужно войти в аккаунт");

  const { data: row, error: e1 } = await supabase
    .from("assets")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (e1) throw e1;
  const oldPath = (row as { storage_path: string }).storage_path;

  const newPath = buildStoragePath(user.id, "audio", file.name);
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(newPath, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) throw upErr;

  const { error: updErr } = await supabase
    .from("assets")
    .update({ storage_path: newPath, mime_type: file.type || null, size_bytes: file.size })
    .eq("id", id);
  if (updErr) {
    await supabase.storage.from(BUCKET).remove([newPath]);
    throw updErr;
  }

  await supabase.storage.from(BUCKET).remove([oldPath]);
}

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
  gradient: string;
  image: string | null; // зарезервировано; сейчас всегда null
}

export async function listDemos(): Promise<Demo[]> {
  const { data, error } = await getSupabase()
    .from("assets")
    .select("*")
    .eq("kind", "audio")
    .is("release_id", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as Asset[];
  // Подпись делаем терпимой к сбоям: битый объект в хранилище
  // не должен скрывать весь список демо.
  return Promise.all(
    rows.map(async (a) => {
      let src = "";
      try {
        src = await getSignedUrl(a.storage_path);
      } catch {
        /* файл недоступен — карточка останется без воспроизведения */
      }
      return {
        id: a.id,
        title: a.title ?? "Демо",
        src,
        gradient: gradientForId(a.id),
        image: null,
      };
    })
  );
}

export async function addDemo(file: File, onProgress?: (p: number) => void): Promise<void> {
  await uploadAsset({ file, kind: "audio", onProgress });
}

export async function removeDemo(id: string): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("assets")
    .select("id, storage_path")
    .eq("id", id)
    .single();
  if (error) throw error;
  await deleteAsset(data as Asset);
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

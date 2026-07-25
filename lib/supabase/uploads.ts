"use client";

import * as tus from "tus-js-client";
import { getSupabase, getSupabaseUrl } from "./client";

export type AssetKind = "audio" | "photo" | "document";

export const BUCKET = "artist-files";

/** Supabase требует ровно 6 МБ на чанк для resumable-загрузок. */
const RESUMABLE_CHUNK_SIZE = 6 * 1024 * 1024;

export interface Asset {
  id: string;
  owner_id: string;
  kind: AssetKind;
  title: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

/** Приводит имя файла к безопасному для ключа хранилища виду. */
export function sanitizeFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";

  const safeBase =
    base
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "file";

  return `${safeBase}${ext.replace(/[^\w.]/g, "")}`;
}

/** Путь всегда начинается с id пользователя — это проверяет RLS storage.objects. */
export function buildStoragePath(userId: string, kind: AssetKind, filename: string): string {
  return `${userId}/${kind}/${Date.now()}-${sanitizeFilename(filename)}`;
}

async function requireUser() {
  const supabase = getSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Нужно войти в аккаунт");
  return user;
}

/**
 * Возобновляемая загрузка (TUS) — для тяжёлых аудиофайлов.
 * Прерванная загрузка продолжится с места обрыва.
 */
function uploadResumable(
  file: File,
  objectName: string,
  accessToken: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${getSupabaseUrl()}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: RESUMABLE_CHUNK_SIZE,
      metadata: {
        bucketName: BUCKET,
        objectName,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      onError: (err) => reject(err),
      onProgress: (sent, total) => {
        if (total > 0) onProgress?.(Math.round((sent / total) * 100));
      },
      onSuccess: () => resolve(),
    });

    // Если такая загрузка уже начиналась — продолжаем её, а не начинаем заново.
    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(reject);
  });
}

export interface UploadAssetArgs {
  file: File;
  kind: AssetKind;
  title?: string;
  onProgress?: (percent: number) => void;
}

/**
 * Кладёт файл в приватный бакет и регистрирует метаданные в public.assets.
 * Аудио идёт через TUS, лёгкие файлы — обычной загрузкой.
 */
export async function uploadAsset({
  file,
  kind,
  title,
  onProgress,
}: UploadAssetArgs): Promise<Asset> {
  const supabase = getSupabase();
  const user = await requireUser();
  const storagePath = buildStoragePath(user.id, kind, file.name);

  if (kind === "audio") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Сессия истекла, войдите заново");

    onProgress?.(0);
    await uploadResumable(file, storagePath, session.access_token, onProgress);
  } else {
    onProgress?.(0);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
    if (uploadError) throw uploadError;
    onProgress?.(100);
  }

  const { data, error } = await supabase
    .from("assets")
    .insert({
      owner_id: user.id,
      kind,
      title: title?.trim() || file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
    })
    .select()
    .single();

  if (error) {
    // Метаданные не записались — не оставляем осиротевший объект в хранилище.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw error;
  }

  return data as Asset;
}

/** Список загрузок текущего пользователя (RLS сам ограничит выборку). */
export async function listAssets(): Promise<Asset[]> {
  const { data, error } = await getSupabase()
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Asset[];
}

/** Бакет приватный — отдаём временную подписанную ссылку. */
export async function getSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await getSupabase()
    .storage.from(BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAsset(asset: Asset): Promise<void> {
  const supabase = getSupabase();

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([asset.storage_path]);
  if (storageError) throw storageError;

  const { error } = await supabase.from("assets").delete().eq("id", asset.id);
  if (error) throw error;
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

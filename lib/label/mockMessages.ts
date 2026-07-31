"use client";

/**
 * ВРЕМЕННО: переписка мокается в памяти клиента, реальной таблицы
 * сообщений в Supabase пока нет. Нужна отдельная миграция (например,
 * messages: org_id, artist_id, sender, text, created_at) плюс realtime
 * или polling, прежде чем это станет настоящей перепиской.
 */

export interface Message {
  id: string;
  from: "label" | "artist";
  text: string;
  createdAt: string; // ISO
}

const threads = new Map<string, Message[]>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeMessages(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getThread(artistId: string): Message[] {
  return threads.get(artistId) ?? [];
}

let seq = 0;
function nextId() {
  seq += 1;
  return `m${Date.now()}_${seq}`;
}

export function sendMessage(artistId: string, from: Message["from"], text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  const list = threads.get(artistId) ?? [];
  // Новый массив, а не push на месте: useSyncExternalStore определяет
  // изменения по ссылке, мутация в месте не даст компонентам перерендериться.
  threads.set(artistId, [...list, { id: nextId(), from, text: trimmed, createdAt: new Date().toISOString() }]);
  notify();
}

/** Затравка переписки, чтобы демо не выглядело пустым при первом заходе. */
export function seedThreadIfEmpty(artistId: string, stageName: string): void {
  if (threads.has(artistId)) return;
  threads.set(artistId, [
    {
      id: nextId(),
      from: "label",
      text: `Привет, ${stageName}! Здесь будем на связи по релизам и задачам.`,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    },
  ]);
}

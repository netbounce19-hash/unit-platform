"use client";

import { getSupabase } from "./client";

/**
 * Переписка артиста с менеджером. Одна ветка на артиста, обе стороны
 * пишут в неё — раньше у каждой стороны был свой Map в памяти вкладки,
 * и они не видели друг друга.
 *
 * Живого сокета нет: страница подтягивает ветку при открытии и потом
 * опрашивает раз в несколько секунд. Для переписки такого темпа хватает,
 * и это честнее, чем показывать «онлайн» поверх статичных данных.
 */

export type MessageSide = "artist" | "label";

/** Прикреплённая к реплике сущность — задача, файл или заявка. */
export interface MessageAttachment {
  type: "task" | "file" | "budget";
  title: string;
  meta?: string;
}

export interface Message {
  id: string;
  org_id: string;
  artist_id: string;
  sender_id: string;
  from_side: MessageSide;
  body: string;
  attachment: MessageAttachment | null;
  created_at: string;
}

/** Интервал опроса ветки, мс. */
export const POLL_MS = 6000;

export async function fetchThread(artistId: string): Promise<Message[]> {
  const { data, error } = await getSupabase()
    .from("messages")
    .select("*")
    .eq("artist_id", artistId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

/**
 * Отправляет реплику. sender_id проставляет БД из auth.uid(), а политика
 * не даёт написать от чужой стороны — поэтому side здесь можно доверять
 * только настолько, насколько его подтверждает RLS.
 */
export async function postMessage(args: {
  orgId: string;
  artistId: string;
  side: MessageSide;
  body: string;
  attachment?: MessageAttachment | null;
}): Promise<Message> {
  const text = args.body.trim();
  if (!text && !args.attachment) throw new Error("Пустое сообщение");

  const { data, error } = await getSupabase()
    .from("messages")
    .insert({
      org_id: args.orgId,
      artist_id: args.artistId,
      from_side: args.side,
      body: text,
      attachment: args.attachment ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Message;
}

/** Последние реплики по каждому артисту — для списка чатов у менеджера. */
export async function fetchOrgPreviews(orgId: string): Promise<Map<string, Message>> {
  const { data, error } = await getSupabase()
    .from("messages")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const last = new Map<string, Message>();
  for (const m of (data ?? []) as Message[]) {
    if (!last.has(m.artist_id)) last.set(m.artist_id, m);
  }
  return last;
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

"use client";

export interface MessageAttachment {
  type: "task" | "file" | "budget";
  title: string;
  meta?: string;
}

export interface Message {
  id: string;
  from: "label" | "artist";
  text: string;
  createdAt: string; // ISO
  attachment?: MessageAttachment;
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

const EMPTY_THREAD: Message[] = [];

export function getThread(artistId: string): Message[] {
  return threads.get(artistId) ?? EMPTY_THREAD;
}

let seq = 0;
function nextId() {
  seq += 1;
  return `m${Date.now()}_${seq}`;
}

export function sendMessage(
  artistId: string,
  from: Message["from"],
  text: string,
  attachment?: MessageAttachment
): void {
  const trimmed = text.trim();
  if (!trimmed && !attachment) return;
  const list = threads.get(artistId) ?? [];
  threads.set(artistId, [
    ...list,
    {
      id: nextId(),
      from,
      text: trimmed,
      createdAt: new Date().toISOString(),
      attachment,
    },
  ]);
  notify();
}

/** Затравка реалистичной переписки с артистами */
export function seedThreadIfEmpty(artistId: string, stageName: string): void {
  if (threads.has(artistId)) return;

  const now = Date.now();
  const h = (hoursAgo: number) => new Date(now - 1000 * 60 * 60 * hoursAgo).toISOString();

  let initialMessages: Message[] = [];

  if (stageName.toLowerCase().includes("kxde") || artistId === "a1") {
    initialMessages = [
      {
        id: nextId(),
        from: "artist",
        text: "Привет! Свели трек 'Midnight Protocol', загрузил финальный микс в материалы.",
        createdAt: h(12),
        attachment: {
          type: "file",
          title: "midnight_protocol_master_v2.wav",
          meta: "24.3 МБ · Аудио мастер",
        },
      },
      {
        id: nextId(),
        from: "label",
        text: "Отлично! Проверили на студии, звучит плотно. Одобрили бюджет на промо-кампанию.",
        createdAt: h(6),
        attachment: {
          type: "budget",
          title: "Бюджет на промо: ₽80,000",
          meta: "Одобрено лейблом · Q3 Таргет",
        },
      },
      {
        id: nextId(),
        from: "label",
        text: "Поставили задачу на съемку сниппета для Shorts. Срок — до пятницы.",
        createdAt: h(2),
        attachment: {
          type: "task",
          title: "Записать 2 промо-ролика для TikTok",
          meta: "Дедлайн: 11 августа",
        },
      },
    ];
  } else if (stageName.toLowerCase().includes("nova") || artistId === "a2") {
    initialMessages = [
      {
        id: nextId(),
        from: "artist",
        text: "Привет! Обложка для релиза готова, скинул дизайнеру на утверждение.",
        createdAt: h(24),
      },
      {
        id: nextId(),
        from: "label",
        text: "Супер, ждём исходники в раздел материалов до 8 августа.",
        createdAt: h(8),
      },
    ];
  } else if (stageName.toLowerCase().includes("zephyr") || artistId === "a3") {
    initialMessages = [
      {
        id: nextId(),
        from: "label",
        text: "Привет, Zephyr! Трек 'Thermal' залетел в плейлисты, стримы выросли на 18%.",
        createdAt: h(18),
      },
      {
        id: nextId(),
        from: "artist",
        text: "Ого, круто! Готовим второй сингл, скоро пришлю демо.",
        createdAt: h(5),
      },
    ];
  } else {
    initialMessages = [
      {
        id: nextId(),
        from: "label",
        text: `Привет, ${stageName}! Здесь мы на связи по релизам, материалам и бюджетным заявкам.`,
        createdAt: h(24),
      },
    ];
  }

  threads.set(artistId, initialMessages);
}

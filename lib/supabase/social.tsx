"use client";

import type { Provider } from "@supabase/supabase-js";
import { getSupabase } from "./client";
import type { AccountRole } from "@/components/auth/AuthPanel";

export type SocialProvider = "yandex" | "telegram";

/**
 * Важно: в Supabase Auth НЕТ встроенных провайдеров yandex и telegram
 * (см. тип Provider в @supabase/auth-js — там их нет).
 *
 * Yandex  — можно подключить как custom OIDC-провайдер: в дашборде заводится
 *           провайдер, сюда прокидывается его слаг через NEXT_PUBLIC_YANDEX_PROVIDER
 *           (значение вида "custom:yandex").
 * Telegram — OAuth не использует вовсе. Telegram Login Widget отдаёт подписанные
 *           данные, их надо проверить на сервере по HMAC с токеном бота и выпустить
 *           сессию — это Edge Function с service_role. В клиенте это невозможно
 *           сделать безопасно, поэтому здесь только заглушка.
 */
const YANDEX_PROVIDER = process.env.NEXT_PUBLIC_YANDEX_PROVIDER;
const TELEGRAM_BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT;

function YandexIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.3 21V3H10.6c-3 0-5.4 2-5.4 5.6 0 2.6 1.1 4.2 3.1 5.4L5 21h2.6l3.1-6.6-1-.6C7.9 12.8 7.1 11.6 7.1 8.7c0-2.3 1.3-3.7 3.4-3.7h.9V21h1.9z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.9 4.3 18.9 19c-.2 1-.8 1.2-1.7.8l-4.6-3.4-2.2 2.1c-.2.2-.5.5-1 .5l.3-4.6 8.4-7.6c.4-.3-.1-.5-.6-.2L7.2 13 2.7 11.6c-1-.3-1-1 .2-1.4l17.6-6.8c.8-.3 1.6.2 1.4 1z" />
    </svg>
  );
}

export const SOCIAL_PROVIDERS: {
  key: SocialProvider;
  label: string;
  brand: string;
  icon: React.ReactNode;
}[] = [
  { key: "yandex", label: "Яндекс", brand: "#FC3F1D", icon: <YandexIcon /> },
  { key: "telegram", label: "Telegram", brand: "#2AABEE", icon: <TelegramIcon /> },
];

/**
 * Роль запоминаем до редиректа: после возврата из OAuth её нужно записать
 * в профиль, потому что в metadata провайдера её нет.
 */
export function stashPendingRole(role: AccountRole) {
  try {
    sessionStorage.setItem("unit.pending_role", role);
  } catch {
    /* приватный режим — не критично */
  }
}

export function takePendingRole(): AccountRole | null {
  try {
    const v = sessionStorage.getItem("unit.pending_role");
    if (v) sessionStorage.removeItem("unit.pending_role");
    return v === "artist" || v === "label" ? v : null;
  } catch {
    return null;
  }
}

export async function startSocialAuth(provider: SocialProvider, role: AccountRole) {
  stashPendingRole(role);

  if (provider === "yandex") {
    if (!YANDEX_PROVIDER) {
      throw new Error(
        "Вход через Яндекс ещё не подключён. Нужно завести Yandex как custom OIDC-провайдер " +
          "в Supabase и указать его слаг в NEXT_PUBLIC_YANDEX_PROVIDER."
      );
    }

    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: YANDEX_PROVIDER as Provider,
      options: { redirectTo: `${window.location.origin}/account` },
    });
    if (error) throw error;
    return;
  }

  // telegram
  if (!TELEGRAM_BOT) {
    throw new Error(
      "Вход через Telegram ещё не подключён. Telegram работает не по OAuth: виджет отдаёт " +
        "подписанные данные, их нужно проверить по HMAC в Edge Function и там же выпустить сессию."
    );
  }

  throw new Error(
    "Бот указан, но Edge Function для проверки подписи Telegram пока не развёрнута."
  );
}

/**
 * Публичный адрес приложения для ссылок, которые уходят наружу:
 * приглашения артистам и в команду, страница «Прислать демо», письма
 * подтверждения почты и сброса пароля.
 *
 * Брать window.location.origin нельзя: у проекта на Vercel есть и командный
 * адрес вида <project>-<team>.vercel.app, закрытый входом Vercel. Сотрудник
 * работает на нём, а артист по такой ссылке упирается в экран авторизации
 * Vercel. Поэтому ссылки наружу всегда строятся от публичного адреса.
 *
 * Адрес берётся из NEXT_PUBLIC_SITE_URL (задайте его в Vercel, когда
 * подключите свой домен); на локальной разработке — текущий origin.
 */
const FALLBACK_SITE_URL = "https://unit-platform.vercel.app";

const isLocal = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);

export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined" && isLocal(window.location.origin)) return window.location.origin;
  return FALLBACK_SITE_URL;
}

/** Абсолютная ссылка на страницу приложения: siteUrl(`/invite/${token}`). */
export function siteUrl(path: string): string {
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Письмо с готовым текстом — приложение само почту не отправляет. */
export function mailtoLink(args: { to?: string; subject: string; body: string }): string {
  const params = new URLSearchParams({ subject: args.subject, body: args.body });
  return `mailto:${encodeURIComponent(args.to ?? "")}?${params.toString().replace(/\+/g, "%20")}`;
}

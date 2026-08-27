"use client";

import { useState } from "react";
import { Loader2, Mic2, Building2, Check, Info } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { getSupabase } from "@/lib/supabase/client";
import { SOCIAL_PROVIDERS, startSocialAuth, type SocialProvider } from "@/lib/supabase/social";

type Mode = "signin" | "signup" | "reset";
export type AccountRole = "artist" | "label";

const ROLES: { key: AccountRole; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    key: "artist",
    label: "Артист",
    hint: "Релизы, демо и задачи",
    icon: <Mic2 className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  },
  {
    key: "label",
    label: "Лейбл",
    hint: "Ростер артистов и бюджеты",
    icon: <Building2 className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  },
];

const inputCls =
  "w-full text-[14px] rounded-[10px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]";
const labelCls = "block text-[13px] font-medium text-[#6E6D73] mb-[7px]";

export default function AuthPanel() {
  const [mode, setMode] = useState<Mode>("signup");
  const [role, setRole] = useState<AccountRole>("artist");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [telegram, setTelegram] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isSignup = mode === "signup";
  const isReset = mode === "reset";
  const isArtist = role === "artist";

  const canSubmit =
    email.trim().length > 3 &&
    (isReset || password.length >= 6) &&
    (!isSignup || displayName.trim().length > 0) &&
    !busy;

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setDone(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const supabase = getSupabase();

      if (isReset) {
        // Письмо со ссылкой на страницу установки нового пароля.
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setDone(true);
      } else if (isSignup) {
        // Метаданные читает триггер handle_new_user() и раскладывает по profiles.
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              role,
              full_name: displayName.trim(),
              artist_name: isArtist ? displayName.trim() : null,
              label_name: isArtist ? null : displayName.trim(),
              telegram: telegram.trim().replace(/^@/, "") || null,
            },
          },
        });
        if (error) throw error;
        setDone(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  };

  const onSocial = async (provider: SocialProvider) => {
    setError(null);
    setNotice(null);
    try {
      await startSocialAuth(provider, role);
    } catch (err) {
      // Провайдер ещё не подключён на бэкенде — говорим об этом прямо.
      setNotice(err instanceof Error ? err.message : "Провайдер недоступен");
    }
  };

  if (done) {
    return (
      <Card className="w-full max-w-[420px]">
        <CardContent className="text-center py-2">
          <span className="w-11 h-11 rounded-full bg-[#E9F6EF] text-[#166B49] flex items-center justify-center mx-auto mb-3">
            <Check className="w-5 h-5" strokeWidth={2.5} />
          </span>
          <CardTitle>{isReset ? "Письмо отправлено" : "Аккаунт создан"}</CardTitle>
          <CardDescription className="mt-1">
            {isReset
              ? `Проверьте почту ${email} — там ссылка для установки нового пароля.`
              : "Если в проекте включено подтверждение почты — проверьте письмо на " + email + "."}
          </CardDescription>
          {isReset && (
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="mt-4 text-[13px] font-medium text-[#17161A] hover:opacity-80 transition"
            >
              Вернуться ко входу
            </button>
          )}
        </CardContent>
      </Card>
    );
  }

  const title = isSignup ? "Создать аккаунт" : isReset ? "Восстановить пароль" : "Вход в UNIT";
  const desc = isSignup
    ? "Выберите, кем вы работаете на платформе"
    : isReset
    ? "Пришлём ссылку для сброса на вашу почту"
    : "Рады видеть снова";
  const submitLabel = isSignup ? "Зарегистрироваться" : isReset ? "Отправить ссылку" : "Войти";

  return (
    <Card className="w-full max-w-[420px]">
      <CardHeader>
        <CardTitle className="text-[18px]">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Кто вы — только при регистрации */}
        {isSignup && (
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => {
              const active = role === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRole(r.key)}
                  aria-pressed={active}
                  className={`text-left rounded-[12px] border px-3 py-[11px] transition ${
                    active
                      ? "border-[#17161A] bg-[#F0EEEA]"
                      : "border-[#E5E3DE] bg-white hover:border-[#D2D0CB]"
                  }`}
                >
                  <span
                    className={`flex items-center gap-2 text-[14px] font-medium ${
                      active ? "text-[#17161A]" : "text-[#17161A]"
                    }`}
                  >
                    {r.icon}
                    {r.label}
                  </span>
                  <span className="block text-[11px] text-[#A6A5AB] mt-[3px]">{r.hint}</span>
                </button>
              );
            })}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {isSignup && (
            <label className="block">
              <span className={labelCls}>
                {isArtist ? "Имя артиста" : "Название лейбла"}
              </span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={isArtist ? "KXDE" : "UNIT Records"}
                className={inputCls}
              />
            </label>
          )}

          <label className="block">
            <span className={labelCls}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className={inputCls}
            />
          </label>

          {isSignup && (
            <label className="block">
              <span className={labelCls}>
                Telegram <span className="font-normal text-[#A6A5AB]">— необязательно</span>
              </span>
              <input
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="@username"
                className={inputCls}
              />
              <span className="block text-[11px] text-[#A6A5AB] mt-[5px]">
                Пригодится для уведомлений о задачах и релизах
              </span>
            </label>
          )}

          {!isReset && (
            <label className="block">
              <div className="flex items-center justify-between mb-[7px]">
                <span className="text-[13px] font-medium text-[#6E6D73]">Пароль</span>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => switchMode("reset")}
                    className="text-[12px] font-medium text-[#17161A] hover:opacity-80 transition"
                  >
                    Забыли пароль?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignup ? "new-password" : "current-password"}
                placeholder={isSignup ? "Минимум 6 символов" : "Ваш пароль"}
                className={inputCls}
              />
            </label>
          )}

          {error && (
            <div className="text-[13px] text-[#17161A] bg-[#F0EEEA] border-[0.5px] border-[#D2D0CB] rounded-[12px] px-3 py-[9px]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#17161A] text-white font-medium text-[14px] px-[18px] py-[11px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />}
            {busy ? "Секунду…" : submitLabel}
          </button>
        </form>

        {/* Соцпровайдеры — не в режиме сброса */}
        {!isReset && (
          <>
            <div className="flex items-center gap-3 pt-1">
              <span className="h-px flex-1 bg-[#ECEAE5]" />
              <span className="text-[12px] text-[#A6A5AB]">или</span>
              <span className="h-px flex-1 bg-[#ECEAE5]" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SOCIAL_PROVIDERS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => onSocial(p.key)}
                  className="inline-flex items-center justify-center gap-2 text-[13.5px] font-medium rounded-full border border-[#E5E3DE] bg-white px-3 py-[10px] hover:border-[#D2D0CB] hover:bg-[#FAFAF9] transition"
                >
                  <span style={{ color: p.brand }}>{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}

        {notice && (
          <div className="flex items-start gap-2 text-[12px] text-[#8A5A16] bg-[#FBF1DE] border-[0.5px] border-[#F0E2BF] rounded-[12px] px-3 py-[9px]">
            <Info className="w-[14px] h-[14px] shrink-0 mt-[1px]" strokeWidth={2} />
            <span className="leading-[1.45]">{notice}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-center">
        {isReset ? (
          <span className="text-[13px] text-[#6E6D73]">
            Вспомнили пароль?{" "}
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="font-medium text-[#17161A] hover:opacity-80 transition"
            >
              Войти
            </button>
          </span>
        ) : (
          <span className="text-[13px] text-[#6E6D73]">
            {isSignup ? "Уже есть аккаунт?" : "Ещё нет аккаунта?"}{" "}
            <button
              type="button"
              onClick={() => switchMode(isSignup ? "signin" : "signup")}
              className="font-medium text-[#17161A] hover:opacity-80 transition"
            >
              {isSignup ? "Войти" : "Зарегистрироваться"}
            </button>
          </span>
        )}
      </CardFooter>
    </Card>
  );
}

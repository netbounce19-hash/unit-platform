"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2, UserPlus, ArrowLeft } from "lucide-react";
import { ArtistIcon, LabelIcon } from "@/components/ui/icons";
import { getSupabase } from "@/lib/supabase/client";

type Role = "artist" | "label";

/**
 * Быстрый вход тестовыми аккаунтами — только в `next dev` и только если
 * данные заданы в локальном .env.local. NODE_ENV подставляется при сборке,
 * поэтому в продакшн-бандл ни ветка, ни значения не попадают. Паролей в
 * коде нет: репозиторий публичный.
 */
const DEV_ACCOUNTS: Partial<Record<Role, { email: string; password: string }>> =
  process.env.NODE_ENV === "development"
    ? {
        ...(process.env.NEXT_PUBLIC_ARTIST_DEV_EMAIL && process.env.NEXT_PUBLIC_ARTIST_DEV_PASSWORD
          ? {
              artist: {
                email: process.env.NEXT_PUBLIC_ARTIST_DEV_EMAIL,
                password: process.env.NEXT_PUBLIC_ARTIST_DEV_PASSWORD,
              },
            }
          : {}),
        ...(process.env.NEXT_PUBLIC_LABEL_DEV_EMAIL && process.env.NEXT_PUBLIC_LABEL_DEV_PASSWORD
          ? {
              label: {
                email: process.env.NEXT_PUBLIC_LABEL_DEV_EMAIL,
                password: process.env.NEXT_PUBLIC_LABEL_DEV_PASSWORD,
              },
            }
          : {}),
      }
    : {};

const HOME: Record<Role, string> = { artist: "/dashboard", label: "/label/roster" };

const inputCls =
  "w-full text-[14px] rounded-[12px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]";

export default function Home() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Письмо подтверждения ведёт сюда (Site URL) и приносит сессию в адресе.
  // Если человек регистрировался по приглашению — отправляем его принять его.
  useEffect(() => {
    const sb = getSupabase();
    const route = (token: unknown) => {
      if (typeof token === "string" && token) router.replace(`/invite/${token}`);
    };
    sb.auth.getSession().then(({ data }) => route(data.session?.user.user_metadata?.pending_invite_token));
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_e, next) => route(next?.user.user_metadata?.pending_invite_token));
    return () => subscription.unsubscribe();
  }, [router]);

  const signIn = async (r: Role, creds: { email: string; password: string }) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const sb = getSupabase();
    await sb.auth.signOut();
    const { data: authData, error: authErr } = await sb.auth.signInWithPassword(creds);
    if (authErr) {
      setError(
        authErr.message === "Invalid login credentials"
          ? "Неверная почта или пароль"
          : authErr.message === "Email not confirmed"
            ? "Почта не подтверждена — откройте ссылку из письма"
            : authErr.message
      );
      setBusy(false);
      return;
    }
    const pendingInvite = authData.user?.user_metadata?.pending_invite_token;
    router.push(typeof pendingInvite === "string" && pendingInvite ? `/invite/${pendingInvite}` : HOME[r]);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role || busy || !email.trim() || !password) return;
    signIn(role, { email: email.trim(), password });
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      setError("Введите почту — пришлём на неё ссылку для сброса");
      return;
    }
    setError(null);
    const { error: resetErr } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetErr) setError(resetErr.message);
    else setNotice(`Ссылка для сброса пароля отправлена на ${email.trim()}`);
  };

  const dev = role ? DEV_ACCOUNTS[role] : undefined;

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center px-5 py-12 bg-[#FAFAF9] overflow-hidden select-none">
      {/* ── Текстурный минималистичный конструктивистский фон ── */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <Image
          src="/landing-bg.jpg"
          alt="Constructivist Music Minimal Background"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-40 mix-blend-multiply transition-opacity duration-1000"
        />
        <div className="absolute inset-0 bg-radial from-transparent via-[#FAFAF9]/40 to-[#FAFAF9]/85" />
        <div className="absolute inset-0 bg-linear-to-b from-[#FAFAF9]/20 via-transparent to-[#FAFAF9]/80" />
      </div>

      {/* ── Основной контент ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[560px] flex flex-col items-center text-center"
      >
        <h1 className="font-bold tracking-[0.12em] text-[36px] sm:text-[42px] text-[#17161A] mb-2 leading-tight">
          UNIT
        </h1>

        {/* Слоган */}
        <p className="text-[15px] sm:text-[16px] text-[#17161A] font-medium max-w-[480px] leading-snug mb-4">
          Артист и лейбл работают на равных: релизы, промо, бюджеты и аналитика — прозрачно для обеих сторон
        </p>

        {/* Описание возможностей через точки */}
        <div className="inline-flex flex-wrap items-center justify-center text-[12px] text-[#6E6D73] bg-white/90 backdrop-blur-xs px-4 py-1.5 rounded-[12px] sm:rounded-full border-[0.5px] border-[#ECEAE5] shadow-2xs mb-8 gap-y-1">
          <span>Релизы и отгрузка</span>
          <span className="mx-1.5 text-[#A6A5AB]">·</span>
          <span>Согласование бюджетов</span>
          <span className="mx-1.5 text-[#A6A5AB]">·</span>
          <span>Промо и задачи</span>
          <span className="mx-1.5 text-[#A6A5AB]">·</span>
          <span>Аналитика стримов</span>
        </div>

        {/* ── Выбор кабинета, затем форма входа ── */}
        {role === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-[440px]">
          {/* Кнопка входа: Артист */}
          <button
            onClick={() => setRole("artist")}
            className="group relative bg-white/95 backdrop-blur-md border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 hover:border-[#17161A] hover:shadow-md transition-all text-center disabled:opacity-50 cursor-pointer active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-full bg-[#FAFAF9] border-[0.5px] border-[#ECEAE5] group-hover:border-[#17161A] group-hover:bg-[#17161A] group-hover:text-white transition-all mx-auto flex items-center justify-center mb-3">
              <ArtistIcon className="w-5 h-5 text-[#6E6D73] group-hover:text-white transition-colors" strokeWidth={1.75} />
            </div>
            <div className="text-[15px] font-semibold text-[#17161A] transition">
              Артист
            </div>
            <div className="text-[12px] text-[#6E6D73] mt-0.5">
              Кабинет артиста
            </div>
          </button>

          {/* Кнопка входа: Лейбл */}
          <button
            onClick={() => setRole("label")}
            className="group relative bg-white/95 backdrop-blur-md border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 hover:border-[#17161A] hover:shadow-md transition-all text-center disabled:opacity-50 cursor-pointer active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-full bg-[#FAFAF9] border-[0.5px] border-[#ECEAE5] group-hover:border-[#17161A] group-hover:bg-[#17161A] group-hover:text-white transition-all mx-auto flex items-center justify-center mb-3">
              <LabelIcon className="w-5 h-5 text-[#6E6D73] group-hover:text-white transition-colors" strokeWidth={1.75} />
            </div>
            <div className="text-[15px] font-semibold text-[#17161A] transition">
              Лейбл
            </div>
            <div className="text-[12px] text-[#6E6D73] mt-0.5">
              Кабинет лейбла
            </div>
          </button>
        </div>

        ) : (
          <form
            onSubmit={submit}
            className="w-full max-w-[380px] bg-white/95 backdrop-blur-md border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 text-left select-text"
          >
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setRole(null);
                  setError(null);
                  setNotice(null);
                }}
                aria-label="Назад к выбору кабинета"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] hover:text-[#17161A] transition -ml-1"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
              </button>
              <div className="text-[16px] font-semibold text-[#17161A]">
                {role === "artist" ? "Вход для артиста" : "Вход для лейбла"}
              </div>
            </div>

            <label className="block mb-3">
              <span className="block text-[12.5px] font-medium text-[#6E6D73] mb-[6px]">Почта</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                className={inputCls}
              />
            </label>

            <label className="block">
              <span className="flex items-center justify-between mb-[6px]">
                <span className="text-[12.5px] font-medium text-[#6E6D73]">Пароль</span>
                <button
                  type="button"
                  onClick={resetPassword}
                  className="text-[12px] font-medium text-[#17161A] hover:text-[#6E6D73] transition"
                >
                  Забыли пароль?
                </button>
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className={inputCls}
              />
            </label>

            {error && (
              <div className="mt-3 text-[13px] text-[#17161A] bg-[#F0EEEA] border-[0.5px] border-[#D2D0CB] rounded-[12px] px-3 py-[9px]">
                {error}
              </div>
            )}
            {notice && (
              <div className="mt-3 text-[13px] text-[#166B49] bg-[#E9F6EF] rounded-[12px] px-3 py-[9px]">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !email.trim() || !password}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 bg-[#17161A] text-white font-medium text-[14px] px-[18px] py-[10px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />}
              Войти
            </button>

            {dev && (
              <button
                type="button"
                onClick={() => signIn(role, dev)}
                disabled={busy}
                className="w-full mt-2 text-[12.5px] font-medium text-[#6E6D73] hover:text-[#17161A] px-[14px] py-[8px] rounded-full transition"
              >
                Тестовый аккаунт (только локально)
              </button>
            )}
          </form>
        )}

        {/* Кнопка регистрации */}
        <div className="mt-8 text-center">
          <div className="text-[12.5px] text-[#6E6D73] mb-2 font-medium">Нет аккаунта?</div>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-white border border-[#E5E3DE] hover:border-[#17161A] text-[#17161A] font-medium text-[13.5px] px-[18px] py-[9px] rounded-full transition shadow-2xs"
          >
            <UserPlus className="w-4 h-4 text-[#6E6D73]" strokeWidth={1.75} />
            <span>Создать аккаунт</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

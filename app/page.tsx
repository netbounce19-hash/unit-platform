"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2, UserPlus, Disc, ArrowRight, Sparkles } from "lucide-react";
import { ArtistIcon, LabelIcon } from "@/components/ui/icons";
import { getSupabase } from "@/lib/supabase/client";

/**
 * ВРЕМЕННО: dev-переключатель кабинетов.
 * Две кнопки — «Артист» и «Лейбл». Каждая логинит нужным тестовым
 * аккаунтом из env и уводит в соответствующий кабинет.
 * Когда фронт утвердят — вернём сюда настоящий вход (AuthGate + AuthPanel).
 */

const LABEL_EMAIL = process.env.NEXT_PUBLIC_LABEL_DEV_EMAIL || "unit-qa2-1784972128733@mailinator.com";
const LABEL_PASSWORD = process.env.NEXT_PUBLIC_LABEL_DEV_PASSWORD || "qa-passw0rd-456";
const ARTIST_EMAIL = process.env.NEXT_PUBLIC_ARTIST_DEV_EMAIL || "unit-artist-qa-1785487830683@mailinator.com";
const ARTIST_PASSWORD = process.env.NEXT_PUBLIC_ARTIST_DEV_PASSWORD || "qa-artist-passw0rd-789";

export default function Home() {
  const router = useRouter();
  const [busy, setBusy] = useState<"artist" | "label" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enter = async (role: "artist" | "label") => {
    const email = role === "label" ? LABEL_EMAIL : ARTIST_EMAIL;
    const password = role === "label" ? LABEL_PASSWORD : ARTIST_PASSWORD;

    if (!email || !password) {
      setError(
        `Переменные NEXT_PUBLIC_${role === "label" ? "LABEL" : "ARTIST"}_DEV_EMAIL/PASSWORD не заданы в .env.local`
      );
      return;
    }

    setBusy(role);
    setError(null);

    const sb = getSupabase();

    // Сначала разлогиниваемся, чтобы не было конфликта сессий
    await sb.auth.signOut();

    const { error: authErr } = await sb.auth.signInWithPassword({ email, password });
    if (authErr) {
      setError(authErr.message);
      setBusy(null);
      return;
    }

    router.push(role === "label" ? "/label/roster" : "/dashboard");
  };

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
          className="object-cover object-center opacity-45 mix-blend-multiply transition-opacity duration-1000"
        />
        {/* Мягкие градиенты для идеальной читаемости интерфейса */}
        <div className="absolute inset-0 bg-radial from-transparent via-[#FAFAF9]/30 to-[#FAFAF9]/80" />
        <div className="absolute inset-0 bg-linear-to-b from-[#FAFAF9]/20 via-transparent to-[#FAFAF9]/70" />
      </div>

      {/* ── Основной контент ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[560px] flex flex-col items-center text-center"
      >
        <h1 className="font-semibold tracking-[0.14em] text-[34px] sm:text-[40px] text-[#17161A] mb-2 leading-tight">
          UNIT
        </h1>

        {/* Ёмкий слоган с акцентом на эффективность и прозрачность */}
        <p className="text-[14.5px] sm:text-[15.5px] text-[#17161A] font-medium max-w-[480px] leading-snug mb-4">
          Единая платформа для эффективного и прозрачного взаимодействия артистов и лейблов
        </p>

        {/* Описание возможностей через точки */}
        <div className="inline-flex flex-wrap items-center justify-center text-[12px] text-[#6E6D73] bg-white/85 backdrop-blur-xs px-3.5 py-1.5 rounded-full border-[0.5px] border-[#ECEAE5] shadow-2xs mb-8 gap-y-1">
          <span>Управление релизами</span>
          <span className="mx-1.5 text-[#A6A5AB]">·</span>
          <span>Согласование бюджетов</span>
          <span className="mx-1.5 text-[#A6A5AB]">·</span>
          <span>Менеджер задач</span>
          <span className="mx-1.5 text-[#A6A5AB]">·</span>
          <span>Аналитика стримов</span>
        </div>

        {/* ── Карточки выбора роли (Артист / Лейбл) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-[440px]">
          {/* Кнопка входа: Артист */}
          <button
            onClick={() => enter("artist")}
            disabled={busy !== null}
            className="group relative bg-white/90 backdrop-blur-md border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 hover:border-[#17161A] hover:bg-white hover:shadow-md transition-all text-center disabled:opacity-50 cursor-pointer active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-full bg-[#FAFAF9] border-[0.5px] border-[#ECEAE5] group-hover:border-[#17161A] group-hover:bg-[#17161A] group-hover:text-white transition-all mx-auto flex items-center justify-center mb-3">
              {busy === "artist" ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#17161A] group-hover:text-white" strokeWidth={2} />
              ) : (
                <ArtistIcon className="w-5 h-5 text-[#6E6D73] group-hover:text-white transition-colors" strokeWidth={1.75} />
              )}
            </div>
            <div className="text-[15px] font-semibold text-[#17161A] transition">
              Артист
            </div>
            <div className="text-[12px] text-[#6E6D73] mt-1">
              Кабинет артиста
            </div>
          </button>

          {/* Кнопка входа: Лейбл */}
          <button
            onClick={() => enter("label")}
            disabled={busy !== null}
            className="group relative bg-white/90 backdrop-blur-md border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 hover:border-[#17161A] hover:bg-white hover:shadow-md transition-all text-center disabled:opacity-50 cursor-pointer active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-full bg-[#FAFAF9] border-[0.5px] border-[#ECEAE5] group-hover:border-[#17161A] group-hover:bg-[#17161A] group-hover:text-white transition-all mx-auto flex items-center justify-center mb-3">
              {busy === "label" ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#17161A] group-hover:text-white" strokeWidth={2} />
              ) : (
                <LabelIcon className="w-5 h-5 text-[#6E6D73] group-hover:text-white transition-colors" strokeWidth={1.75} />
              )}
            </div>
            <div className="text-[15px] font-semibold text-[#17161A] transition">
              Лейбл
            </div>
            <div className="text-[12px] text-[#6E6D73] mt-1">
              Кабинет лейбла
            </div>
          </button>
        </div>

        {error && (
          <div className="mt-5 w-full max-w-[440px] text-[13px] text-[#17161A] bg-white/95 backdrop-blur-md border-[0.5px] border-[#E23A34]/30 rounded-[12px] px-3 py-[9px] shadow-xs">
            {error}
          </div>
        )}

        {/* Кнопка регистрации */}
        <div className="mt-8 text-center">
          <div className="text-[12.5px] text-[#6E6D73] mb-2.5 font-medium">Нет аккаунта?</div>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-md border border-[#E5E3DE] text-[#17161A] font-medium text-[13.5px] px-[18px] py-[9px] rounded-full hover:border-[#D2D0CB] hover:bg-white transition shadow-2xs"
          >
            <UserPlus className="w-4 h-4 text-[#6E6D73]" strokeWidth={1.75} />
            <span>Создать аккаунт</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

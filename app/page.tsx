"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Music, Building2 } from "lucide-react";
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
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10 bg-[#FAFAF9]">
      <div className="font-semibold tracking-[0.16em] text-[20px] mb-2">UNIT</div>
      <p className="text-[13px] text-[#A6A5AB] mb-8">DEV MODE · выберите кабинет для тестирования</p>

      <div className="flex gap-4">
        <button
          onClick={() => enter("artist")}
          disabled={busy !== null}
          className="group w-[200px] bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 hover:border-[#E23A34] hover:shadow-lg transition text-center disabled:opacity-50"
        >
          {busy === "artist" ? (
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#E23A34]" strokeWidth={2} />
          ) : (
            <Music className="w-8 h-8 mx-auto text-[#6E6D73] group-hover:text-[#E23A34] transition" strokeWidth={1.5} />
          )}
          <div className="text-[15px] font-semibold mt-3 group-hover:text-[#E23A34] transition">Артист</div>
          <div className="text-[12px] text-[#A6A5AB] mt-1">Кабинет артиста</div>
        </button>

        <button
          onClick={() => enter("label")}
          disabled={busy !== null}
          className="group w-[200px] bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 hover:border-[#E23A34] hover:shadow-lg transition text-center disabled:opacity-50"
        >
          {busy === "label" ? (
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#E23A34]" strokeWidth={2} />
          ) : (
            <Building2 className="w-8 h-8 mx-auto text-[#6E6D73] group-hover:text-[#E23A34] transition" strokeWidth={1.5} />
          )}
          <div className="text-[15px] font-semibold mt-3 group-hover:text-[#E23A34] transition">Лейбл</div>
          <div className="text-[12px] text-[#A6A5AB] mt-1">Кабинет лейбла</div>
        </button>
      </div>

      {error && (
        <div className="mt-5 max-w-[420px] text-[13px] text-[#A62018] bg-[#FDEDEB] border-[0.5px] border-[#F3C9C6] rounded-[10px] px-3 py-[9px]">
          {error}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FolderOpen, ChevronDown, ArrowRight, Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import AssetManager from "@/components/artist/AssetManager";

/**
 * Файлы артиста на дашборде: аудио, фото и документы.
 * Секция сворачиваемая — контент подгружается только когда её открыли.
 */
export default function ArtistFilesSection() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);

  // Подписываемся на сессию только после первого раскрытия
  useEffect(() => {
    if (!open || ready) return;

    let supabase;
    try {
      supabase = getSupabase();
    } catch {
      setConfigured(false);
      setReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, next) => setSession(next));

    return () => subscription.unsubscribe();
  }, [open, ready]);

  return (
    <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] px-[22px] pt-[18px] pb-[14px] mb-4">
      {/* Заголовок-переключатель */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 flex-1 min-w-0 -my-1 py-1 text-left"
        >
          <FolderOpen className="w-[17px] h-[17px] text-[#6E6D73] shrink-0" strokeWidth={1.75} />
          <div className="text-[16px] font-semibold tracking-[-0.01em] shrink-0">Файлы артиста</div>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-[#A6A5AB] shrink-0"
          >
            <ChevronDown className="w-[18px] h-[18px]" strokeWidth={2} />
          </motion.span>
        </button>

        {open && session && (
          <Link
            href="/account"
            className="inline-flex items-center gap-[5px] text-[13px] font-medium text-[#E23A34] hover:opacity-80 transition shrink-0"
          >
            Открыть целиком
            <ArrowRight className="w-[14px] h-[14px]" strokeWidth={2} />
          </Link>
        )}
      </div>

      {/* Тело */}
      <div className="grid" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="overflow-hidden min-h-0">
          <div className={`pt-3 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}>
            {!open ? null : !ready ? (
              <div className="py-8 flex items-center justify-center text-[#A6A5AB]">
                <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
              </div>
            ) : !configured ? (
              <div className="rounded-[12px] border-[0.5px] border-[#F3C9C6] bg-[#FDEDEB] px-4 py-[14px]">
                <div className="text-[14px] font-medium text-[#A62018]">Supabase не настроен</div>
                <p className="text-[12px] text-[#6E6D73] leading-[1.45] mt-1">
                  Задайте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.local
                </p>
              </div>
            ) : !session ? (
              <div className="rounded-[12px] border border-dashed border-[#D2D0CB] px-4 py-[18px] text-center">
                <p className="text-[13px] text-[#6E6D73] leading-[1.5] mb-3">
                  Здесь появятся ваши аудио, фото и документы.
                  <br />
                  Войдите в аккаунт, чтобы загружать файлы.
                </p>
                <Link
                  href="/account"
                  className="inline-flex items-center gap-[6px] bg-[#E23A34] text-white font-medium text-[14px] px-[18px] py-[10px] rounded-[10px] hover:brightness-95 transition"
                >
                  Войти или зарегистрироваться
                  <ArrowRight className="w-[15px] h-[15px]" strokeWidth={2} />
                </Link>
              </div>
            ) : (
              <AssetManager />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

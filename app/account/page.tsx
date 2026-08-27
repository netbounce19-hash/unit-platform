"use client";

import { useEffect, useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import BackHome from "@/components/ui/BackHome";
import AuthPanel from "@/components/auth/AuthPanel";
import AssetManager from "@/components/artist/AssetManager";

export default function AccountPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabase();
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "Supabase не настроен");
      setReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="max-w-[720px] mx-auto px-5 py-7">
      <div className="flex items-center justify-between">
        {/* Страница вне (artist)-каркаса — контрол ставим вручную.
            Без сессии вести в кабинет некуда, поэтому только с ней. */}
        {session ? <BackHome homeHref="/dashboard" roots={[]} /> : <span />}

        {session && (
          <button
            onClick={() => getSupabase().auth.signOut()}
            className="inline-flex items-center gap-[6px] text-[13px] font-medium text-[#6E6D73] hover:text-[#17161A] transition"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75} />
            Выйти
          </button>
        )}
      </div>

      <div className="mb-5">
        <div className="text-[12px] text-[#A6A5AB]">Аккаунт</div>
        <div className="text-[22px] font-semibold tracking-[-0.01em]">
          {session ? "Файлы артиста" : "Вход в кабинет"}
        </div>
        {session?.user.email && (
          <div className="text-[14px] text-[#6E6D73] mt-[3px]">{session.user.email}</div>
        )}
      </div>

      {configError ? (
        <div className="bg-white border-[0.5px] border-[#D2D0CB] rounded-[16px] p-[22px]">
          <div className="text-[15px] font-semibold text-[#17161A] mb-2">Supabase не настроен</div>
          <p className="text-[13px] text-[#6E6D73] leading-[1.5]">{configError}</p>
        </div>
      ) : !ready ? (
        <div className="py-10 flex items-center justify-center text-[#A6A5AB]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : session ? (
        <AssetManager />
      ) : (
        <div className="flex justify-center">
          <AuthPanel />
        </div>
      )}
    </div>
  );
}

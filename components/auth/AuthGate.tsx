"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import AuthPanel from "@/components/auth/AuthPanel";

/**
 * Пускает дальше только с активной сессией.
 * Пока сессии нет — показывает окно входа/регистрации.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
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
    } = supabase.auth.onAuthStateChange((_e, next) => setSession(next));

    return () => subscription.unsubscribe();
  }, []);

  if (configError) {
    return (
      <div className="max-w-[720px] mx-auto px-5 py-7">
        <div className="bg-white border-[0.5px] border-[#F3C9C6] rounded-[16px] p-[22px]">
          <div className="text-[15px] font-semibold text-[#A62018] mb-2">Supabase не настроен</div>
          <p className="text-[13px] text-[#6E6D73] leading-[1.5]">{configError}</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#A6A5AB]">
        <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
        <div className="font-semibold tracking-[0.16em] text-[17px] mb-6">UNIT</div>
        <AuthPanel />
      </div>
    );
  }

  return <>{children}</>;
}

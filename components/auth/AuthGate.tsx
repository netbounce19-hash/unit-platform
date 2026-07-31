"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Пускает дальше только с активной сессией.
 * Если сессии нет — отправляет на главную (dev-переключатель кабинетов).
 */
export default function AuthGate({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabase();
    } catch {
      setReady(true);
      return;
    }

    let cancelled = false;

    const resolve = (s: Session | null) => {
      if (cancelled) return;
      if (!s) {
        router.replace("/");
        return;
      }
      setSession(s);
      setReady(true);
    };

    supabase.auth.getSession().then(({ data }) => resolve(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, next) => {
      resolve(next);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#A6A5AB]">
        <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#A6A5AB]">
        <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
      </div>
    );
  }

  return <>{children}</>;
}

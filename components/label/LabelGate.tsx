"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { fetchMyOrg, type MyOrg } from "@/lib/supabase/label";

interface LabelContext {
  org: MyOrg;
  session: Session;
}

/**
 * Клиентский гейт кабинета лейбла: пускает дальше только сотрудника,
 * состоящего в organizations через memberships.
 * Если сессии нет — отправляет на главную (dev-переключатель).
 * Если сессия есть, но нет org — предлагает перейти в кабинет артиста.
 */
export default function LabelGate({ children }: { children: (ctx: LabelContext) => ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [org, setOrg] = useState<MyOrg | null>(null);
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

    const resolve = async (s: Session | null) => {
      if (cancelled) return;

      if (!s) {
        router.replace("/");
        return;
      }

      try {
        const found = await fetchMyOrg();
        if (cancelled) return;
        setSession(s);
        setOrg(found);
      } catch {
        if (!cancelled) setOrg(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    supabase.auth.getSession().then(({ data }) => resolve(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, next) => {
      setReady(false);
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

  // Залогинен, но не сотрудник лейбла — это артист, ему сюда нельзя.
  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="w-full max-w-[420px] bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] text-center">
          <div className="text-[16px] font-semibold tracking-[-0.01em]">Раздел для лейбла</div>
          <p className="text-[13px] text-[#6E6D73] mt-2 leading-[1.5]">
            Ваш аккаунт не привязан к лейблу. Если вы артист — вам в кабинет артиста.
          </p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => router.replace("/dashboard")}
              className="flex-1 bg-[#17161A] text-white font-medium text-[14px] px-[18px] py-[10px] rounded-full hover:bg-[#2A282E] transition"
            >
              В кабинет артиста
            </button>
            <button
              onClick={() => {
                getSupabase().auth.signOut();
                router.replace("/");
              }}
              className="flex-1 border border-[#E5E3DE] text-[#6E6D73] font-medium text-[14px] px-[18px] py-[10px] rounded-full hover:border-[#D2D0CB] transition"
            >
              Сменить аккаунт
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children({ org, session })}</>;
}

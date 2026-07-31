"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { fetchMyOrg, type MyOrg } from "@/lib/supabase/label";
import AuthPanel from "@/components/auth/AuthPanel";

interface LabelContext {
  org: MyOrg;
  session: Session;
}

/**
 * ВРЕМЕННО, на период разработки UI кабинета лейбла.
 * Если в .env.local заданы NEXT_PUBLIC_LABEL_DEV_EMAIL/PASSWORD — гейт сам
 * логинится этим аккаунтом и пропускает экран входа. Как только фронт
 * утверждён, просто удалите эти две строки из .env.local — код трогать
 * не нужно, всё вернётся к обычной форме входа.
 *
 * Ключи начинаются на NEXT_PUBLIC_, то есть уходят в браузерный бандл —
 * поэтому переменные должны стоять ТОЛЬКО в локальном .env.local
 * (он в .gitignore) и никогда — в Vercel/проде или в общем стейджинге.
 */
const DEV_EMAIL = process.env.NEXT_PUBLIC_LABEL_DEV_EMAIL;
const DEV_PASSWORD = process.env.NEXT_PUBLIC_LABEL_DEV_PASSWORD;
const DEV_AUTOLOGIN = Boolean(DEV_EMAIL && DEV_PASSWORD);

/**
 * Клиентский гейт кабинета лейбла: пускает дальше только сотрудника,
 * состоящего в organizations через memberships. Артиста уводит в его кабинет.
 *
 * Защита клиентская: сессия живёт в localStorage, поэтому middleware её
 * не видит. Настоящая серверная проверка — это данные, а не роут: RLS
 * не отдаст чужие строки, даже если открыть /label/* напрямую.
 */
export default function LabelGate({ children }: { children: (ctx: LabelContext) => ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [org, setOrg] = useState<MyOrg | null>(null);
  const [ready, setReady] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [devAuthError, setDevAuthError] = useState<string | null>(null);

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabase();
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "Supabase не настроен");
      setReady(true);
      return;
    }

    let cancelled = false;

    const resolve = async (s: Session | null) => {
      if (!s) {
        // Dev-автовход: тихо логинимся тестовым аккаунтом лейбла и продолжаем
        // как будто сессия пришла обычным путём.
        if (DEV_AUTOLOGIN) {
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: DEV_EMAIL!,
              password: DEV_PASSWORD!,
            });
            if (!error && data.session) {
              if (!cancelled) return resolve(data.session);
            } else if (!cancelled) {
              setDevAuthError(error?.message ?? "Не удалось войти dev-аккаунтом");
            }
          } catch (err) {
            if (!cancelled) {
              setDevAuthError(err instanceof Error ? err.message : "Не удалось войти dev-аккаунтом");
            }
          }
        }
        if (!cancelled) {
          setSession(null);
          setOrg(null);
          setReady(true);
        }
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
  }, []);

  const devBanner = DEV_AUTOLOGIN && (
    <div className="bg-[#17161A] text-white text-[12px] text-center py-[6px] px-4">
      DEV MODE · автовход {DEV_EMAIL} — уберите NEXT_PUBLIC_LABEL_DEV_EMAIL/PASSWORD из .env.local, чтобы вернуть обычный логин
    </div>
  );

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
      <div className="min-h-screen flex flex-col">
        {devBanner}
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
          <div className="font-semibold tracking-[0.16em] text-[17px] mb-6">UNIT</div>
          {devAuthError && (
            <div className="w-full max-w-[420px] text-[13px] text-[#A62018] bg-[#FDEDEB] border-[0.5px] border-[#F3C9C6] rounded-[10px] px-3 py-[9px] mb-4">
              Dev-автовход не сработал: {devAuthError}
            </div>
          )}
          <AuthPanel />
        </div>
      </div>
    );
  }

  // Залогинен, но не сотрудник лейбла — это артист, ему сюда нельзя.
  if (!org) {
    return (
      <div className="min-h-screen flex flex-col">
        {devBanner}
        <div className="flex-1 flex items-center justify-center px-5">
          <div className="w-full max-w-[420px] bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] text-center">
            <div className="text-[16px] font-semibold tracking-[-0.01em]">Раздел для лейбла</div>
            <p className="text-[13px] text-[#6E6D73] mt-2 leading-[1.5]">
              Ваш аккаунт не привязан к лейблу. Если вы артист — вам в кабинет артиста.
            </p>
            <button
              onClick={() => router.replace("/dashboard")}
              className="mt-4 w-full bg-[#E23A34] text-white font-medium text-[14px] px-[18px] py-[10px] rounded-[10px] hover:brightness-95 transition"
            >
              В кабинет артиста
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {devBanner}
      {children({ org, session })}
    </>
  );
}

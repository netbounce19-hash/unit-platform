"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Check } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { getSupabase } from "@/lib/supabase/client";

const inputCls =
  "w-full text-[14px] rounded-[10px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]";
const labelCls = "block text-[13px] font-medium text-[#6E6D73] mb-[7px]";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false); // есть recovery-сессия из ссылки
  const [configError, setConfigError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabase();
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "Supabase не настроен");
      setChecking(false);
      return;
    }

    // detectSessionInUrl уже обработал токен из ссылки — проверяем сессию.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setChecking(false);
    });

    // На случай, если событие придёт чуть позже разбора ссылки.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        setReady(true);
        setChecking(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const canSubmit = password.length >= 6 && password === confirm && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);
    try {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => router.replace("/dashboard"), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить пароль");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
      <div className="font-semibold tracking-[0.16em] text-[17px] mb-6">UNIT</div>

      {configError ? (
        <Card className="w-full max-w-[420px]">
          <CardContent className="py-2">
            <CardTitle className="text-[#17161A]">Supabase не настроен</CardTitle>
            <CardDescription className="mt-1">{configError}</CardDescription>
          </CardContent>
        </Card>
      ) : checking ? (
        <div className="text-[#A6A5AB]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : done ? (
        <Card className="w-full max-w-[420px]">
          <CardContent className="text-center py-2">
            <span className="w-11 h-11 rounded-full bg-[#E9F6EF] text-[#166B49] flex items-center justify-center mx-auto mb-3">
              <Check className="w-5 h-5" strokeWidth={2.5} />
            </span>
            <CardTitle>Пароль обновлён</CardTitle>
            <CardDescription className="mt-1">Открываем кабинет…</CardDescription>
          </CardContent>
        </Card>
      ) : !ready ? (
        <Card className="w-full max-w-[420px]">
          <CardHeader>
            <CardTitle className="text-[18px]">Ссылка недействительна</CardTitle>
            <CardDescription>
              Ссылка для сброса пароля устарела или уже использована. Запросите новую.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link
              href="/"
              className="text-[13px] font-medium text-[#17161A] hover:opacity-80 transition"
            >
              Вернуться ко входу
            </Link>
          </CardFooter>
        </Card>
      ) : (
        <Card className="w-full max-w-[420px]">
          <CardHeader>
            <CardTitle className="text-[18px]">Новый пароль</CardTitle>
            <CardDescription>Придумайте пароль для входа в кабинет</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className={labelCls}>Новый пароль</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Минимум 6 символов"
                  className={inputCls}
                />
              </label>

              <label className="block">
                <span className={labelCls}>Повторите пароль</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Ещё раз"
                  className={inputCls}
                />
                {confirm.length > 0 && password !== confirm && (
                  <span className="block text-[11px] text-[#17161A] mt-[5px]">
                    Пароли не совпадают
                  </span>
                )}
              </label>

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
                {busy ? "Секунду…" : "Сохранить пароль"}
              </button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

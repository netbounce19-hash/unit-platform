"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Music, Building2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";

type Role = "artist" | "label";

const inputCls =
  "w-full text-[14px] rounded-[12px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]";
const labelCls = "block text-[13px] font-medium text-[#6E6D73] mb-[7px]";

/**
 * Регистрация с выбором роли.
 *
 * Артист заводит только аккаунт: к лейблу его привязывает менеджер
 * приглашением, поэтому сразу после регистрации кабинет будет пустым.
 * Лейбл дополнительно создаёт организацию — это делает RPC create_label_org,
 * потому что напрямую вставить строку в organizations RLS не позволяет.
 */
export default function SignUpPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("artist");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmNeeded, setConfirmNeeded] = useState(false);

  const canSubmit = email.trim() && password.length >= 6 && name.trim() && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    const supabase = getSupabase();
    try {
      const { data, error: signErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data:
            role === "artist"
              ? { artist_name: name.trim(), full_name: name.trim() }
              : // Название кладём в метаданные: если почта требует
                // подтверждения, сессии сейчас нет и организацию не создать —
                // её заведёт LabelGate при первом входе
                { full_name: name.trim(), pending_label_name: name.trim() },
        },
      });
      if (signErr) throw signErr;

      // Почта требует подтверждения — сессии ещё нет, организацию не создать
      if (!data.session) {
        setConfirmNeeded(true);
        return;
      }

      if (role === "label") {
        const { error: rpcErr } = await supabase.rpc("create_label_org", {
          org_name: name.trim(),
        });
        if (rpcErr) throw rpcErr;
        router.push("/label/roster");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать аккаунт");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <div className="max-w-[460px] mx-auto px-5 py-7">
        <Link
          href="/"
          className="inline-flex items-center gap-[6px] text-[13px] font-medium text-[#6E6D73] hover:text-[#17161A] rounded-full px-[14px] py-[8px] -ml-[14px] hover:bg-[#F0EEEA] transition mb-3"
        >
          <ArrowLeft className="w-[15px] h-[15px]" strokeWidth={2} />
          Назад
        </Link>

        <div className="font-semibold tracking-[0.16em] text-[17px] mb-5">UNIT</div>
        <h1 className="text-[22px] font-medium tracking-[-0.01em]">Создать аккаунт</h1>
        <p className="text-[14px] text-[#6E6D73] mt-[3px] mb-5">
          Выберите, кем вы приходите в UNIT
        </p>

        {confirmNeeded ? (
          <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px]">
            <div className="text-[16px] font-semibold tracking-[-0.01em]">Подтвердите почту</div>
            <p className="text-[13.5px] text-[#6E6D73] leading-[1.5] mt-2">
              Мы отправили письмо на {email.trim()}. Откройте ссылку из него, потом возвращайтесь
              и войдите.
              {role === "label" &&
                " Лейбл будет создан при первом входе — название мы запомним."}
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center bg-[#17161A] text-white font-medium text-[14px] px-[18px] py-[10px] rounded-full hover:bg-[#2A282E] transition mt-4"
            >
              На главную
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] space-y-5">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "artist", label: "Артист", icon: Music },
                  { key: "label", label: "Лейбл", icon: Building2 },
                ] as const
              ).map((r) => {
                const Icon = r.icon;
                const active = role === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRole(r.key)}
                    className={`flex flex-col items-center gap-[6px] rounded-[12px] border px-3 py-[14px] transition ${
                      active
                        ? "border-[#17161A] bg-[#F0EEEA]"
                        : "border-[#E5E3DE] bg-white hover:border-[#D2D0CB]"
                    }`}
                  >
                    <Icon className="w-[20px] h-[20px] text-[#17161A]" strokeWidth={1.5} />
                    <span className="text-[13.5px] font-medium">{r.label}</span>
                  </button>
                );
              })}
            </div>

            <label className="block">
              <span className={labelCls}>
                {role === "artist" ? "Имя артиста" : "Название лейбла"}
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={role === "artist" ? "KXDE" : "UNIT Records"}
                className={inputCls}
              />
            </label>

            <label className="block">
              <span className={labelCls}>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className={inputCls}
              />
            </label>

            <label className="block">
              <span className={labelCls}>Пароль</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                className={inputCls}
              />
              {password.length > 0 && password.length < 6 && (
                <span className="block text-[12px] text-[#A6A5AB] mt-[5px]">
                  Пароль короче шести символов
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
              className="w-full inline-flex items-center justify-center gap-2 bg-[#17161A] text-white font-medium text-[14px] px-[18px] py-[10px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />}
              {role === "artist" ? "Создать аккаунт артиста" : "Создать лейбл"}
            </button>

            <p className="text-[12px] text-[#A6A5AB] leading-[1.45]">
              {role === "artist"
                ? "Кабинет будет пустым, пока лейбл не пришлёт приглашение: задачи, релизы и статистику ведёт менеджер."
                : "Вы станете администратором лейбла и сможете приглашать артистов в ростер."}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

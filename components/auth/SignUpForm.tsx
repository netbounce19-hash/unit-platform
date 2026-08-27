"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";

export default function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit =
    email.trim().length > 3 &&
    password.length >= 6 &&
    fullName.trim().length > 0 &&
    artistName.trim().length > 0 &&
    !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);

    try {
      // full_name и artist_name уходят в raw_user_meta_data —
      // оттуда их забирает триггер handle_new_user() и кладёт в profiles.
      const { error } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            artist_name: artistName.trim(),
          },
        },
      });
      if (error) throw error;
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось зарегистрироваться");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] text-center">
        <span className="w-11 h-11 rounded-full bg-[#E9F6EF] text-[#166B49] flex items-center justify-center mx-auto mb-3">
          <Check className="w-5 h-5" strokeWidth={2.5} />
        </span>
        <div className="text-[16px] font-semibold tracking-[-0.01em]">Аккаунт создан</div>
        <p className="text-[13px] text-[#6E6D73] mt-1 leading-[1.5]">
          Если в инстансе включено подтверждение почты — проверьте письмо на {email}.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] space-y-4"
    >
      <div>
        <div className="text-[16px] font-semibold tracking-[-0.01em]">Регистрация артиста</div>
        <div className="text-[13px] text-[#6E6D73] mt-[2px]">
          Профиль создастся автоматически после регистрации
        </div>
      </div>

      <label className="block">
        <span className="block text-[13px] font-medium text-[#6E6D73] mb-[8px]">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full text-[14px] rounded-[12px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]"
        />
      </label>

      <label className="block">
        <span className="block text-[13px] font-medium text-[#6E6D73] mb-[8px]">Имя и фамилия</span>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          placeholder="Иван Петров"
          className="w-full text-[14px] rounded-[12px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]"
        />
      </label>

      <label className="block">
        <span className="block text-[13px] font-medium text-[#6E6D73] mb-[8px]">Имя артиста</span>
        <input
          value={artistName}
          onChange={(e) => setArtistName(e.target.value)}
          placeholder="KXDE"
          className="w-full text-[14px] rounded-[12px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]"
        />
      </label>

      <label className="block">
        <span className="block text-[13px] font-medium text-[#6E6D73] mb-[8px]">Пароль</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="Минимум 6 символов"
          className="w-full text-[14px] rounded-[12px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]"
        />
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
        {busy ? "Создаём аккаунт…" : "Зарегистрироваться"}
      </button>
    </form>
  );
}

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { DemoIcon } from "@/components/ui/icons";
import { fetchPublicLabel, submitDemo } from "@/lib/supabase/scouting";

const inputCls =
  "w-full text-[14px] rounded-[12px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]";
const labelCls = "block text-[12.5px] font-medium text-[#6E6D73] mb-[6px]";

/**
 * Публичная страница лейбла «Прислать демо». Аккаунт не нужен — заявка
 * попадает в скаутинг лейбла. Пишем только через submit_demo(), который сам
 * проверяет поля и ограничивает частоту.
 */
function SubmitInner({ slug }: { slug: string }) {
  const [label, setLabel] = useState<{ name: string; submissions_open: boolean; submissions_intro: string | null } | null | undefined>(undefined);
  const [f, setF] = useState({
    artistName: "",
    contactName: "",
    email: "",
    telegram: "",
    city: "",
    genre: "",
    trackUrl: "",
    link1: "",
    link2: "",
    link3: "",
    followers: "",
    monthlyListeners: "",
    message: "",
    consent: false,
    // ловушка для ботов: поле скрыто, человек его не заполнит
    website: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchPublicLabel(slug)
      .then(setLabel)
      .catch(() => setLabel(null));
  }, [slug]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const num = (s: string) => {
    const n = Number(s.replace(/[\s ]/g, ""));
    return s.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };

  const canSubmit = f.artistName.trim() && f.email.trim() && f.trackUrl.trim() && f.consent && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (f.website) {
      setDone(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitDemo(slug, {
        artistName: f.artistName,
        contactName: f.contactName,
        email: f.email,
        telegram: f.telegram,
        city: f.city,
        genre: f.genre,
        trackUrl: f.trackUrl.trim(),
        links: [f.link1, f.link2, f.link3].map((l) => l.trim()).filter(Boolean),
        followers: num(f.followers),
        monthlyListeners: num(f.monthlyListeners),
        message: f.message,
        consent: f.consent,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить");
    } finally {
      setBusy(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-[#FAFAF9]">
      <div className="max-w-[560px] mx-auto px-5 py-8">
        <Link href="/" className="font-semibold tracking-[0.16em] text-[17px] text-[#17161A]">
          UNIT
        </Link>
        {children}
      </div>
    </div>
  );

  if (label === undefined) {
    return shell(
      <div className="py-20 flex justify-center text-[#A6A5AB]">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!label || !label.submissions_open) {
    return shell(
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 mt-6">
        <div className="text-[18px] font-medium">{label ? label.name : "Страница не найдена"}</div>
        <p className="text-[14px] text-[#6E6D73] mt-2">
          {label ? "Лейбл сейчас не принимает демо. Загляните позже." : "Проверьте ссылку — такой страницы нет."}
        </p>
      </div>
    );
  }

  if (done) {
    return shell(
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 mt-6 text-center">
        <span className="w-11 h-11 rounded-full bg-[#E9F6EF] text-[#166B49] flex items-center justify-center mx-auto mb-3">
          <Check className="w-5 h-5" strokeWidth={2.5} />
        </span>
        <div className="text-[18px] font-medium">Демо отправлено</div>
        <p className="text-[14px] text-[#6E6D73] mt-2 leading-[1.5]">
          Команда {label.name} послушает трек. Если он зацепит — напишут на {f.email.trim()}
          {f.telegram.trim() ? " или в Telegram" : ""}.
        </p>
      </div>
    );
  }

  return shell(
    <>
      <div className="flex items-center gap-3 mt-7 mb-2">
        <span className="w-11 h-11 rounded-full bg-white border-[0.5px] border-[#ECEAE5] flex items-center justify-center shrink-0">
          <DemoIcon className="w-5 h-5 text-[#17161A]" />
        </span>
        <div>
          <h1 className="text-[22px] font-medium tracking-[-0.01em] leading-tight">Демо для {label.name}</h1>
          <p className="text-[13.5px] text-[#6E6D73]">Аккаунт не нужен — достаточно ссылки на трек</p>
        </div>
      </div>
      {label.submissions_intro && (
        <p className="text-[14px] text-[#17161A] leading-[1.55] bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] px-4 py-3 mt-4 whitespace-pre-line">
          {label.submissions_intro}
        </p>
      )}

      <form onSubmit={submit} className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-5 mt-4 space-y-4">
        <input
          type="text"
          name="website"
          value={f.website}
          onChange={set("website")}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />

        <label className="block">
          <span className={labelCls}>Имя артиста *</span>
          <input value={f.artistName} onChange={set("artistName")} maxLength={100} placeholder="Сценическое имя" className={inputCls} />
        </label>

        <label className="block">
          <span className={labelCls}>Ссылка на трек *</span>
          <input
            type="url"
            value={f.trackUrl}
            onChange={set("trackUrl")}
            maxLength={500}
            placeholder="https://… — Яндекс Диск, SoundCloud, площадка"
            className={inputCls}
          />
          <span className="block text-[11.5px] text-[#A6A5AB] mt-1">Проверьте, что ссылка открывается без входа в аккаунт</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Почта *</span>
            <input type="email" value={f.email} onChange={set("email")} autoComplete="email" maxLength={200} placeholder="you@example.com" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Telegram</span>
            <input value={f.telegram} onChange={set("telegram")} maxLength={64} placeholder="@username" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Город</span>
            <input value={f.city} onChange={set("city")} maxLength={80} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Жанр</span>
            <input value={f.genre} onChange={set("genre")} maxLength={80} placeholder="Поп, рэп, инди…" className={inputCls} />
          </label>
        </div>

        <div>
          <span className={labelCls}>Где вас послушать ещё</span>
          <div className="space-y-2">
            {(["link1", "link2", "link3"] as const).map((k, i) => (
              <input
                key={k}
                type="url"
                value={f[k]}
                onChange={set(k)}
                maxLength={500}
                placeholder={["Профиль на площадке", "Соцсеть", "Ещё ссылка"][i]}
                className={inputCls}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Подписчики в соцсетях</span>
            <input inputMode="numeric" value={f.followers} onChange={set("followers")} placeholder="например, 12000" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Слушатели в месяц</span>
            <input inputMode="numeric" value={f.monthlyListeners} onChange={set("monthlyListeners")} placeholder="если есть релизы" className={inputCls} />
          </label>
        </div>

        <label className="block">
          <span className={labelCls}>Пара слов о себе и треке</span>
          <textarea value={f.message} onChange={set("message")} rows={4} maxLength={2000} className={`${inputCls} resize-y`} />
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={f.consent} onChange={set("consent")} className="mt-[3px] w-4 h-4 accent-[#17161A] shrink-0" />
          <span className="text-[12.5px] text-[#6E6D73] leading-[1.5]">
            Согласен на обработку персональных данных (имя, почта, Telegram, город) лейблом {label.name}, чтобы он мог
            рассмотреть демо и связаться со мной. Согласие можно отозвать, написав лейблу. *
          </span>
        </label>

        {error && <div className="text-[13px] bg-[#F0EEEA] border-[0.5px] border-[#D2D0CB] rounded-[12px] px-3 py-[9px]">{error}</div>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full inline-flex items-center justify-center gap-2 bg-[#17161A] text-white font-medium text-[14px] px-[18px] py-[10px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Отправить демо
        </button>
      </form>
    </>
  );
}

export default function SubmitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <SubmitInner slug={slug} />;
}

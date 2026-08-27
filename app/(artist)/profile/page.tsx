"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Download, FileText, CalendarDays, LogOut, Check } from "lucide-react";
import FaqSection from "@/components/artist/FaqSection";
import { getSupabase } from "@/lib/supabase/client";
import { fetchMyProfile, displayNameOf } from "@/lib/supabase/profile";
import {
  defaultProfile,
  formatListeners,
  CONTRACT_UNTIL,
  CONTRACT_PDF,
  LISTENERS_GOAL,
  type ArtistProfile,
  type ArtistStatus,
} from "@/lib/artist/profile";

// Количество выпущенных треков — задаёт менеджер из своего кабинета
const releasedTracks = 0;

export default function ProfilePage() {
  const router = useRouter();
  const [draft, setDraft] = useState<ArtistProfile>({ ...defaultProfile, name: "Артист" });
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyProfile()
      .then((p) => {
        if (cancelled || !p) return;
        setDraft((prev) => ({ ...prev, name: displayNameOf(p) }));
      })
      .catch(() => {
        /* профиль недоступен — оставляем значение по умолчанию */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // Освобождаем object URL при размонтировании
  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

  const pickPhoto = (file: File | null) => {
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setDraft((d) => ({ ...d, photo: url }));
  };

  const listenersProgress = Math.min(100, Math.round((draft.listeners / LISTENERS_GOAL) * 100));
  const isContract = draft.status === "contract";

  return (
    <>
      <div className="mb-4">
        <div className="text-[22px] font-medium tracking-[-0.01em]">Профиль</div>
        <div className="text-[14px] text-[#6E6D73] mt-[3px]">Данные артиста, показатели и договор</div>
      </div>

      {/* Показатели */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] px-4 py-[14px]">
          <div className="text-[12px] text-[#A6A5AB] mb-[6px]">Слушатели / месяц</div>
          <div className="text-[22px] font-medium">{formatListeners(draft.listeners)}</div>
          <div className="h-[4px] bg-[#F0EEEA] rounded-full overflow-hidden mt-[7px] mb-[5px]">
            <div
              className="h-full bg-[#17161A] rounded-full transition-all"
              style={{ width: `${listenersProgress}%` }}
            />
          </div>
          <div className="text-[12px] text-[#6E6D73]">{listenersProgress}% до цели 100k</div>
        </div>
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] px-4 py-[14px]">
          <div className="text-[12px] text-[#A6A5AB] mb-[6px]">Стримы / квартал</div>
          <div className="text-[22px] font-medium">0</div>
          <div className="text-[12px] text-[#6E6D73] mt-[2px]">пока нет данных</div>
        </div>
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] px-4 py-[14px]">
          <div className="text-[12px] text-[#A6A5AB] mb-[6px]">Треков выпущено</div>
          <div className="text-[22px] font-medium">{releasedTracks}</div>
          <div className="text-[12px] text-[#6E6D73] mt-[2px]">за всё время</div>
        </div>
      </div>

      {/* Данные артиста */}
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] mb-4 space-y-5">
        {/* Фото */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => fileRef.current?.click()}
            className="relative w-[72px] h-[72px] rounded-full shrink-0 overflow-hidden bg-[#17161A] text-white flex items-center justify-center text-[26px] font-medium group"
            aria-label="Загрузить фото"
          >
            {draft.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.photo} alt="Фото артиста" className="w-full h-full object-cover" />
            ) : (
              draft.name.charAt(0) || "?"
            )}
            <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" strokeWidth={1.75} />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
          />
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              className="text-[13px] font-medium text-[#17161A] hover:opacity-80 transition"
            >
              Загрузить фото
            </button>
            <div className="text-[12px] text-[#A6A5AB] mt-[2px]">JPG или PNG, квадрат от 400×400</div>
          </div>
        </div>

        {/* Имя */}
        <label className="block">
          <span className="block text-[13px] font-medium text-[#6E6D73] mb-[8px]">Имя артиста</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="w-full text-[14px] rounded-[12px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]"
          />
        </label>

        {/* Био */}
        <label className="block">
          <span className="block text-[13px] font-medium text-[#6E6D73] mb-[8px]">Био</span>
          <textarea
            value={draft.bio}
            onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
            rows={3}
            maxLength={300}
            placeholder="Коротко о себе и звучании"
            className="w-full resize-none text-[14px] leading-[1.45] rounded-[12px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]"
          />
          <span className="block text-[11px] text-[#A6A5AB] mt-[4px] text-right">
            {draft.bio.length} / 300
          </span>
        </label>

        {/* Статус */}
        <div>
          <span className="block text-[13px] font-medium text-[#6E6D73] mb-[8px]">Статус</span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { key: "contract", label: "Контракт", disabled: false },
                { key: "independent", label: "Независимый артист", disabled: true },
              ] as { key: ArtistStatus; label: string; disabled: boolean }[]
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => !opt.disabled && setDraft((d) => ({ ...d, status: opt.key }))}
                disabled={opt.disabled}
                title={opt.disabled ? "Недоступно — изменяет менеджер" : undefined}
                className={`text-[13px] font-medium rounded-[12px] px-[14px] py-[10px] border transition ${
                  draft.status === opt.key
                    ? "border-[#17161A] bg-[#F0EEEA] text-[#17161A]"
                    : "border-[#E5E3DE] bg-white text-[#6E6D73] hover:border-[#D2D0CB]"
                } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#E5E3DE]`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Договор — только при статусе «Контракт» */}
        {isContract && (
          <div className="rounded-[12px] border-[0.5px] border-[#ECEAE5] bg-[#FAFAF9] p-4">
            <div className="flex items-center gap-2 text-[13px] font-medium text-[#17161A] mb-3">
              <FileText className="w-[15px] h-[15px] text-[#6E6D73]" strokeWidth={1.75} />
              Договор и условия
            </div>

            <div className="flex items-center gap-2 text-[13px] text-[#6E6D73] mb-1">
              <CalendarDays className="w-[14px] h-[14px]" strokeWidth={1.75} />
              Срок договора —{" "}
              <span className="font-medium text-[#17161A]">до {CONTRACT_UNTIL} г.</span>
            </div>
            <div className="text-[12px] text-[#A6A5AB] mb-3">
              Роялти 70 / 30 · UNIT Records · договор UNT-2026-0417
            </div>

            <a
              href={CONTRACT_PDF}
              download
              className="inline-flex items-center gap-[7px] text-[13px] font-medium text-[#17161A] bg-white border border-[#E5E3DE] rounded-full px-[14px] py-[8px] hover:border-[#D2D0CB] transition"
            >
              <Download className="w-4 h-4" strokeWidth={2} />
              Скачать PDF копию
            </a>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            onClick={() => setToast("Профиль сохранён")}
            disabled={!draft.name.trim()}
            className="bg-[#17161A] text-white font-medium text-[14px] px-[18px] py-[10px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Сохранить
          </button>
        </div>
      </div>

      <FaqSection />

      <button
        onClick={async () => {
          await getSupabase().auth.signOut();
          router.push("/");
        }}
        className="w-full flex items-center justify-center gap-[7px] text-[14px] font-medium text-[#6E6D73] bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] px-4 py-[13px] hover:text-[#17161A] hover:border-[#D2D0CB] transition"
      >
        <LogOut className="w-[16px] h-[16px]" strokeWidth={1.75} />
        Выйти из аккаунта
      </button>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            role="status"
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-[10px] bg-[#17161A] text-white text-[13px] font-medium pl-[14px] pr-[18px] py-[11px] rounded-full max-w-[calc(100vw-2rem)]"
          >
            <span className="w-5 h-5 rounded-full bg-[#1F9D6B] flex items-center justify-center shrink-0">
              <Check className="w-[13px] h-[13px]" strokeWidth={3} />
            </span>
            <span className="truncate">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

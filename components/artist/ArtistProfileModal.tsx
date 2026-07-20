"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Camera, Download, FileText, CalendarDays } from "lucide-react";

export type ArtistStatus = "contract" | "independent";

export interface ArtistProfile {
  name: string;
  photo: string | null; // object URL или путь
  bio: string;
  listeners: number; // ежемесячные слушатели
  status: ArtistStatus;
}

export const defaultProfile: ArtistProfile = {
  name: "KXDE",
  photo: null,
  bio: "Электронный продюсер из Санкт-Петербурга. Тёмный синти-поп и хаус.",
  listeners: 65000,
  status: "contract",
};

/** Дата окончания договора */
export const CONTRACT_UNTIL = "31.12.2030";
const CONTRACT_PDF = "/docs/unit-artist-agreement-kxde.pdf";

interface ArtistProfileModalProps {
  open: boolean;
  onClose: () => void;
  profile: ArtistProfile;
  onSave: (p: ArtistProfile) => void;
}

export default function ArtistProfileModal({
  open,
  onClose,
  profile,
  onSave,
}: ArtistProfileModalProps) {
  const [draft, setDraft] = useState<ArtistProfile>(profile);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Подхватываем актуальный профиль при открытии
  useEffect(() => {
    if (open) setDraft(profile);
  }, [open, profile]);

  // Esc закрывает
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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

  const isContract = draft.status === "contract";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Редактирование профиля артиста"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.98, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 24 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="bg-white w-full sm:max-w-[520px] max-h-[90vh] sm:max-h-[86vh] overflow-y-auto rounded-t-[20px] sm:rounded-[18px] border-[0.5px] border-[#ECEAE5] shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
            >
              {/* Header */}
              <div className="sticky top-0 bg-white/95 backdrop-blur-sm flex items-center justify-between px-[22px] py-[18px] border-b-[0.5px] border-[#ECEAE5] z-10">
                <div>
                  <div className="text-[12px] text-[#A6A5AB]">Профиль артиста</div>
                  <div className="text-[17px] font-medium tracking-[-0.01em]">
                    Редактировать профиль
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Закрыть"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition"
                >
                  <X className="w-[18px] h-[18px]" strokeWidth={2} />
                </button>
              </div>

              <div className="px-[22px] py-5 space-y-5">
                {/* Фото */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="relative w-[72px] h-[72px] rounded-full shrink-0 overflow-hidden bg-[#17161A] text-white flex items-center justify-center text-[26px] font-medium group"
                    aria-label="Загрузить фото"
                  >
                    {draft.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={draft.photo}
                        alt="Фото артиста"
                        className="w-full h-full object-cover"
                      />
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
                      className="text-[13px] font-medium text-[#E23A34] hover:opacity-80 transition"
                    >
                      Загрузить фото
                    </button>
                    <div className="text-[12px] text-[#A6A5AB] mt-[2px]">
                      JPG или PNG, квадрат от 400×400
                    </div>
                  </div>
                </div>

                {/* Имя */}
                <label className="block">
                  <span className="block text-[13px] font-medium text-[#6E6D73] mb-[8px]">
                    Имя артиста
                  </span>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    className="w-full text-[14px] rounded-[10px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#E23A34] transition placeholder:text-[#C4C3C8]"
                  />
                </label>

                {/* Био */}
                <label className="block">
                  <span className="block text-[13px] font-medium text-[#6E6D73] mb-[8px]">
                    Био
                  </span>
                  <textarea
                    value={draft.bio}
                    onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
                    rows={3}
                    maxLength={300}
                    placeholder="Коротко о себе и звучании"
                    className="w-full resize-none text-[14px] leading-[1.45] rounded-[12px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#E23A34] transition placeholder:text-[#C4C3C8]"
                  />
                  <span className="block text-[11px] text-[#A6A5AB] mt-[4px] text-right">
                    {draft.bio.length} / 300
                  </span>
                </label>

                {/* Слушатели */}
                <label className="block">
                  <span className="block text-[13px] font-medium text-[#6E6D73] mb-[8px]">
                    Ежемесячные слушатели
                  </span>
                  <input
                    value={draft.listeners.toLocaleString("ru-RU")}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        listeners: Number(e.target.value.replace(/\D/g, "").slice(0, 9)) || 0,
                      }))
                    }
                    inputMode="numeric"
                    className="w-full text-[14px] rounded-[10px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#E23A34] transition"
                  />
                </label>

                {/* Статус */}
                <div>
                  <span className="block text-[13px] font-medium text-[#6E6D73] mb-[8px]">
                    Статус
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { key: "contract", label: "Контракт" },
                        { key: "independent", label: "Независимый артист" },
                      ] as { key: ArtistStatus; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setDraft((d) => ({ ...d, status: opt.key }))}
                        className={`text-[13px] font-medium rounded-[10px] px-3 py-[10px] border transition ${
                          draft.status === opt.key
                            ? "border-[#E23A34] bg-[#FDEDEB] text-[#A62018]"
                            : "border-[#E5E3DE] bg-white text-[#6E6D73] hover:border-[#D2D0CB]"
                        }`}
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
                      <span className="font-medium text-[#17161A]">
                        до {CONTRACT_UNTIL} г.
                      </span>
                    </div>
                    <div className="text-[12px] text-[#A6A5AB] mb-3">
                      Роялти 70 / 30 · UNIT Records · договор UNT-2026-0417
                    </div>

                    <a
                      href={CONTRACT_PDF}
                      download
                      className="inline-flex items-center gap-[7px] text-[13px] font-medium text-[#17161A] bg-white border border-[#E5E3DE] rounded-[10px] px-[14px] py-[9px] hover:border-[#D2D0CB] transition"
                    >
                      <Download className="w-4 h-4" strokeWidth={2} />
                      Скачать PDF копию
                    </a>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm flex items-center justify-end gap-2 px-[22px] py-[16px] border-t-[0.5px] border-[#ECEAE5]">
                <button
                  onClick={onClose}
                  className="text-[14px] font-medium text-[#6E6D73] px-[14px] py-[10px] rounded-[10px] hover:bg-[#F0EEEA] transition"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    onSave(draft);
                    onClose();
                  }}
                  disabled={!draft.name.trim()}
                  className="bg-[#E23A34] text-white font-medium text-[14px] px-[18px] py-[10px] rounded-[10px] hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Сохранить
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

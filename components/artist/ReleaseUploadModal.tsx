"use client";

import { useEffect, useRef, useState, DragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Plus,
  Trash2,
  FileAudio,
  FileText,
  Users,
  Copyright,
  Check,
} from "lucide-react";

interface ReleaseUploadModalProps {
  open: boolean;
  onClose: () => void;
  releaseTitle?: string;
}

interface CoAuthor {
  id: number;
  name: string;
  role: string;
  share: string; // percent as string for controlled input
}

const ROLES = [
  "Автор музыки",
  "Автор текста",
  "Исполнитель",
  "Продюсер",
  "Аранжировщик",
];

// ── Compact light-themed file dropzone ─────────────────────
function UploadField({
  icon,
  label,
  hint,
  accept,
  file,
  onFile,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={handleDrop}
      className={`flex items-center gap-3 rounded-[12px] border border-dashed px-4 py-[14px] cursor-pointer transition ${
        dragging
          ? "border-[#E23A34] bg-[#FDEDEB]"
          : file
          ? "border-[#1F9D6B]/50 bg-[#E9F6EF]"
          : "border-[#D2D0CB] hover:border-[#E23A34]/50 hover:bg-[#FAFAF9]"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <span
        className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${
          file ? "bg-[#1F9D6B] text-white" : "bg-[#F0EEEA] text-[#6E6D73]"
        }`}
      >
        {file ? <Check className="w-[18px] h-[18px]" strokeWidth={2.5} /> : icon}
      </span>
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-[#17161A]">{label}</div>
        <div className="text-[12px] text-[#A6A5AB] truncate">
          {file ? file.name : hint}
        </div>
      </div>
    </div>
  );
}

export default function ReleaseUploadModal({
  open,
  onClose,
  releaseTitle = "Релиз",
}: ReleaseUploadModalProps) {
  const [audio, setAudio] = useState<File | null>(null);
  const [lyrics, setLyrics] = useState<File | null>(null);
  const [copyrightHolder, setCopyrightHolder] = useState("");
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([
    { id: 1, name: "KXDE", role: "Автор музыки", share: "100" },
  ]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const totalShare = coAuthors.reduce(
    (sum, a) => sum + (parseFloat(a.share) || 0),
    0
  );
  const shareOk = Math.round(totalShare) === 100;

  const updateAuthor = (id: number, patch: Partial<CoAuthor>) =>
    setCoAuthors((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a))
    );

  const addAuthor = () =>
    setCoAuthors((prev) => [
      ...prev,
      { id: Date.now(), name: "", role: "Автор текста", share: "" },
    ]);

  const removeAuthor = (id: number) =>
    setCoAuthors((prev) => prev.filter((a) => a.id !== id));

  const canSubmit = Boolean(audio) && shareOk;

  const handleSubmit = () => {
    // Mock submit — в реальном приложении здесь загрузка на бэкенд
    onClose();
  };

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
              aria-label={`Загрузка релиза ${releaseTitle}`}
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.98, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 24 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="bg-white w-full sm:max-w-[560px] max-h-[90vh] sm:max-h-[86vh] overflow-y-auto rounded-t-[20px] sm:rounded-[18px] border-[0.5px] border-[#ECEAE5] shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
            >
              {/* Header */}
              <div className="sticky top-0 bg-white/95 backdrop-blur-sm flex items-center justify-between px-[22px] py-[18px] border-b-[0.5px] border-[#ECEAE5] z-10">
                <div>
                  <div className="text-[12px] text-[#A6A5AB]">Загрузка релиза</div>
                  <div className="text-[17px] font-medium tracking-[-0.01em]">
                    {releaseTitle}
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

              <div className="px-[22px] py-5 space-y-6">
                {/* Files */}
                <section className="space-y-3">
                  <div className="text-[13px] font-medium text-[#6E6D73]">
                    Файлы
                  </div>
                  <UploadField
                    icon={<FileAudio className="w-[18px] h-[18px]" strokeWidth={1.75} />}
                    label="Загрузить аудио"
                    hint="WAV, FLAC или MP3 · до 100 МБ"
                    accept="audio/*,.wav,.flac,.mp3,.aiff"
                    file={audio}
                    onFile={setAudio}
                  />
                  <UploadField
                    icon={<FileText className="w-[18px] h-[18px]" strokeWidth={1.75} />}
                    label="Загрузить текст"
                    hint="Текст песни · TXT, PDF или DOCX"
                    accept=".txt,.pdf,.doc,.docx,.rtf"
                    file={lyrics}
                    onFile={setLyrics}
                  />
                </section>

                {/* Copyright holder */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-[#6E6D73]">
                    <Copyright className="w-[15px] h-[15px]" strokeWidth={1.75} />
                    Авторские права
                  </div>
                  <label className="block">
                    <span className="block text-[12px] text-[#A6A5AB] mb-[6px]">
                      Правообладатель
                    </span>
                    <input
                      value={copyrightHolder}
                      onChange={(e) => setCopyrightHolder(e.target.value)}
                      placeholder="Напр. KXDE / UNIT Records"
                      className="w-full text-[14px] rounded-[10px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#E23A34] transition placeholder:text-[#C4C3C8]"
                    />
                  </label>
                </section>

                {/* Co-authors & shares */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-[#6E6D73]">
                      <Users className="w-[15px] h-[15px]" strokeWidth={1.75} />
                      Со-авторы и доли
                    </div>
                    <span
                      className={`text-[12px] font-medium px-[10px] py-[3px] rounded-full ${
                        shareOk
                          ? "bg-[#E9F6EF] text-[#166B49]"
                          : "bg-[#FDEDEB] text-[#A62018]"
                      }`}
                    >
                      {totalShare % 1 === 0 ? totalShare : totalShare.toFixed(1)}% из
                      100%
                    </span>
                  </div>

                  <div className="space-y-2">
                    {coAuthors.map((a) => (
                      <div key={a.id} className="flex items-center gap-2">
                        <input
                          value={a.name}
                          onChange={(e) =>
                            updateAuthor(a.id, { name: e.target.value })
                          }
                          placeholder="Имя"
                          className="flex-1 min-w-0 text-[14px] rounded-[10px] border border-[#E5E3DE] bg-white px-3 py-[9px] outline-none focus:border-[#E23A34] transition placeholder:text-[#C4C3C8]"
                        />
                        <select
                          value={a.role}
                          onChange={(e) =>
                            updateAuthor(a.id, { role: e.target.value })
                          }
                          className="text-[13px] rounded-[10px] border border-[#E5E3DE] bg-white px-2 py-[9px] outline-none focus:border-[#E23A34] transition text-[#17161A] cursor-pointer shrink-0 w-[130px]"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <div className="relative w-[72px] shrink-0">
                          <input
                            value={a.share}
                            onChange={(e) =>
                              updateAuthor(a.id, {
                                share: e.target.value.replace(/[^\d.]/g, ""),
                              })
                            }
                            inputMode="decimal"
                            placeholder="0"
                            className="w-full text-[14px] text-right rounded-[10px] border border-[#E5E3DE] bg-white pl-3 pr-6 py-[9px] outline-none focus:border-[#E23A34] transition placeholder:text-[#C4C3C8]"
                          />
                          <span className="absolute right-[10px] top-1/2 -translate-y-1/2 text-[13px] text-[#A6A5AB] pointer-events-none">
                            %
                          </span>
                        </div>
                        <button
                          onClick={() => removeAuthor(a.id)}
                          disabled={coAuthors.length === 1}
                          aria-label="Удалить со-автора"
                          className="w-8 h-8 shrink-0 rounded-[8px] flex items-center justify-center text-[#A6A5AB] hover:text-[#A62018] hover:bg-[#FDEDEB] transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#A6A5AB]"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={addAuthor}
                    className="inline-flex items-center gap-[6px] text-[13px] font-medium text-[#E23A34] hover:opacity-80 transition"
                  >
                    <Plus className="w-4 h-4" strokeWidth={2} />
                    Добавить со-автора
                  </button>
                </section>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm flex items-center justify-between gap-3 px-[22px] py-[16px] border-t-[0.5px] border-[#ECEAE5]">
                <span className="text-[12px] text-[#A6A5AB]">
                  {!audio
                    ? "Добавьте аудиофайл"
                    : !shareOk
                    ? "Доли должны составлять 100%"
                    : "Готово к загрузке"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="text-[14px] font-medium text-[#6E6D73] px-[14px] py-[10px] rounded-[10px] hover:bg-[#F0EEEA] transition"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="bg-[#E23A34] text-white font-medium text-[14px] px-[18px] py-[10px] rounded-[10px] hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Загрузить релиз
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

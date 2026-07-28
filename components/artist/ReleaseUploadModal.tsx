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
  ImagePlus,
  Paperclip,
  Disc3,
  Music,
  Loader2,
} from "lucide-react";
import { useDemos } from "@/components/artist/DemoContext";
import { createRelease } from "@/lib/supabase/cabinet";

interface ReleaseUploadModalProps {
  open: boolean;
  onClose: () => void;
  releaseTitle?: string;
  /** релиз создан и сохранён — родитель перезагружает список */
  onSubmit?: () => void;
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

// ── Multi-file upload (PDF-договора) ───────────────────────
function MultiFileField({
  files,
  onAdd,
  onRemove,
}: {
  files: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
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
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const dropped = Array.from(e.dataTransfer.files || []);
          if (dropped.length) onAdd(dropped);
        }}
        className={`flex items-center gap-3 rounded-[12px] border border-dashed px-4 py-[14px] cursor-pointer transition ${
          dragging
            ? "border-[#E23A34] bg-[#FDEDEB]"
            : "border-[#D2D0CB] hover:border-[#E23A34]/50 hover:bg-[#FAFAF9]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files || []);
            if (picked.length) onAdd(picked);
            e.target.value = "";
          }}
        />
        <span className="w-9 h-9 rounded-[10px] bg-[#F0EEEA] text-[#6E6D73] flex items-center justify-center shrink-0">
          <Paperclip className="w-[18px] h-[18px]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-[#17161A]">
            Загрузить договора (PDF)
          </div>
          <div className="text-[12px] text-[#A6A5AB]">
            Можно несколько файлов
          </div>
        </div>
      </div>

      {files.map((f, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-[10px] bg-[#FAFAF9] border-[0.5px] border-[#ECEAE5] px-3 py-[8px]"
        >
          <FileText className="w-[15px] h-[15px] text-[#6E6D73] shrink-0" strokeWidth={1.75} />
          <span className="text-[13px] text-[#17161A] truncate flex-1">{f.name}</span>
          <button
            onClick={() => onRemove(i)}
            aria-label="Удалить документ"
            className="w-6 h-6 shrink-0 rounded-[6px] flex items-center justify-center text-[#A6A5AB] hover:text-[#A62018] hover:bg-[#FDEDEB] transition"
          >
            <Trash2 className="w-[14px] h-[14px]" strokeWidth={1.75} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function ReleaseUploadModal({
  open,
  onClose,
  releaseTitle = "Релиз",
  onSubmit,
}: ReleaseUploadModalProps) {
  const [title, setTitle] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [lyrics, setLyrics] = useState<File | null>(null);
  const [copyrightHolder, setCopyrightHolder] = useState("");
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([
    { id: 1, name: "KXDE", role: "Автор музыки", share: "100" },
  ]);
  const [docs, setDocs] = useState<File[]>([]);
  const [demoIds, setDemoIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const { demos } = useDemos();

  // Сброс полей при каждом открытии
  useEffect(() => {
    if (open) {
      setTitle(releaseTitle && releaseTitle !== "Новый релиз" ? releaseTitle : "");
      setCover(null);
      setCoverPreview(null);
      setAudio(null);
      setLyrics(null);
      setCopyrightHolder("");
      setCoAuthors([{ id: 1, name: "KXDE", role: "Автор музыки", share: "100" }]);
      setDocs([]);
      setDemoIds([]);
      setBusy(false);
      setProgress(null);
      setUploadError(null);
    }
  }, [open]);

  const toggleDemo = (id: string) =>
    setDemoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // Превью обложки (объектный URL живёт, пока выбран файл)
  useEffect(() => {
    if (!cover) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

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

  const hasAudio = Boolean(audio) || demoIds.length > 0;
  const canSubmit = title.trim().length > 0 && hasAudio && shareOk;

  const handleSubmit = async () => {
    if (busy) return;
    setBusy(true);
    setUploadError(null);
    if (audio) setProgress(0);
    try {
      await createRelease({
        title,
        cover,
        audio,
        onProgress: audio ? setProgress : undefined,
      });
      onSubmit?.();
      onClose();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Не удалось создать релиз");
    } finally {
      setBusy(false);
      setProgress(null);
    }
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
                    {title.trim() || "Новый релиз"}
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
                {/* Название */}
                <section className="space-y-3">
                  <label className="block">
                    <span className="block text-[13px] font-medium text-[#6E6D73] mb-[7px]">
                      Название релиза
                    </span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Например, Midnight Protocol"
                      className="w-full text-[14px] rounded-[10px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#E23A34] transition placeholder:text-[#C4C3C8]"
                    />
                  </label>
                </section>

                {/* Обложка */}
                <section className="space-y-3">
                  <div className="text-[13px] font-medium text-[#6E6D73]">
                    Обложка релиза
                  </div>
                  <div
                    onClick={() => coverInputRef.current?.click()}
                    className="flex items-center gap-4 rounded-[12px] border border-dashed border-[#D2D0CB] hover:border-[#E23A34]/50 hover:bg-[#FAFAF9] p-3 cursor-pointer transition"
                  >
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => setCover(e.target.files?.[0] ?? null)}
                    />
                    <span className="w-[64px] h-[64px] rounded-[10px] shrink-0 overflow-hidden bg-[#F0EEEA] flex items-center justify-center">
                      {coverPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverPreview} alt="Обложка" className="w-full h-full object-cover" />
                      ) : (
                        <ImagePlus className="w-6 h-6 text-[#A6A5AB]" strokeWidth={1.5} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-[#17161A]">
                        {cover ? "Заменить обложку" : "Загрузить обложку"}
                      </div>
                      <div className="text-[12px] text-[#A6A5AB] truncate">
                        {cover ? cover.name : "JPG или PNG · 3000×3000"}
                      </div>
                    </div>
                  </div>
                </section>

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

                {/* Треки из демо */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-[#6E6D73]">
                      <Music className="w-[15px] h-[15px]" strokeWidth={1.75} />
                      Треки из демо
                    </div>
                    {demoIds.length > 0 && (
                      <span className="text-[12px] font-medium text-[#166B49]">
                        Выбрано: {demoIds.length}
                      </span>
                    )}
                  </div>
                  {demos.length === 0 ? (
                    <p className="text-[12px] text-[#A6A5AB]">
                      Демо пока нет — добавьте их на странице ДЕМО.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[188px] overflow-y-auto pr-1">
                      {demos.map((d) => {
                        const on = demoIds.includes(d.id);
                        return (
                          <button
                            key={d.id}
                            onClick={() => toggleDemo(d.id)}
                            className={`w-full flex items-center gap-3 rounded-[12px] border px-3 py-[9px] transition text-left ${
                              on
                                ? "border-[#1F9D6B]/50 bg-[#E9F6EF]"
                                : "border-[#E5E3DE] bg-white hover:border-[#D2D0CB]"
                            }`}
                          >
                            <span
                              className="relative w-9 h-9 rounded-[8px] shrink-0 overflow-hidden flex items-center justify-center"
                              style={{ background: d.gradient }}
                            >
                              {d.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={d.image} alt={d.title} className="absolute inset-0 w-full h-full object-cover" />
                              ) : (
                                <Disc3 className="w-[18px] h-[18px] text-white/75" strokeWidth={1.5} />
                              )}
                            </span>
                            <span className="text-[13.5px] font-medium text-[#17161A] truncate flex-1">
                              {d.title}
                            </span>
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                                on ? "bg-[#1F9D6B] text-white" : "border border-[#D2D0CB] text-transparent"
                              }`}
                            >
                              {on ? <Check className="w-[14px] h-[14px]" strokeWidth={2.5} /> : <Plus className="w-[14px] h-[14px] text-[#A6A5AB]" strokeWidth={2} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
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

                {/* Договора с со-авторами */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-[#6E6D73]">
                    <FileText className="w-[15px] h-[15px]" strokeWidth={1.75} />
                    Договора с со-авторами
                  </div>
                  <p className="text-[12px] leading-[1.45] text-[#A6A5AB]">
                    Загрузите сюда подписанные договора с вашими со-авторами — авторами,
                    битмейкерами, музыкантами, звукорежиссёрами и др. Формат PDF.
                  </p>
                  <MultiFileField
                    files={docs}
                    onAdd={(added) => setDocs((prev) => [...prev, ...added])}
                    onRemove={(index) =>
                      setDocs((prev) => prev.filter((_, i) => i !== index))
                    }
                  />
                </section>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm px-[22px] py-[16px] border-t-[0.5px] border-[#ECEAE5]">
                {uploadError && (
                  <div className="text-[12px] text-[#A62018] bg-[#FDEDEB] border-[0.5px] border-[#F3C9C6] rounded-[10px] px-3 py-[8px] mb-3">
                    {uploadError}
                  </div>
                )}
                {progress !== null && (
                  <div className="h-[6px] bg-[#F0EEEA] rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-[#E23A34] rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] text-[#A6A5AB]">
                    {busy
                      ? progress !== null
                        ? `Загрузка… ${progress}%`
                        : "Сохраняем…"
                      : !title.trim()
                      ? "Впишите название релиза"
                      : !hasAudio
                      ? "Добавьте аудио или выберите демо"
                      : !shareOk
                      ? "Доли должны составлять 100%"
                      : "Готово к загрузке"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onClose}
                      disabled={busy}
                      className="text-[14px] font-medium text-[#6E6D73] px-[14px] py-[10px] rounded-[10px] hover:bg-[#F0EEEA] transition disabled:opacity-40"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!canSubmit || busy}
                      className="inline-flex items-center gap-2 bg-[#E23A34] text-white font-medium text-[14px] px-[18px] py-[10px] rounded-[10px] hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {busy && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />}
                      Загрузить релиз
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

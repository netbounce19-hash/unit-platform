"use client";

import { useState } from "react";
import { Plus, Trash2, RefreshCw, Disc3, Music, Loader2, ImagePlus, ChevronUp, ChevronDown } from "lucide-react";
import { useDemos } from "@/components/artist/DemoContext";
import BackHome from "@/components/ui/BackHome";
import AuthGate from "@/components/auth/AuthGate";

// Открывает системный выбор файла и резолвит выбранный File
function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

function DemoEditInner() {
  const { demos, loading, addDemo, removeDemo, replaceAudio, updateTitle, setImage, moveDemo } =
    useDemos();

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const onUpload = async () => {
    const file = await pickFile("audio/*,.wav,.mp3,.flac,.aiff");
    if (!file) return;
    setError(null);
    setUploadProgress(0);
    try {
      await addDemo(file, setUploadProgress);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить демо");
    } finally {
      setUploadProgress(null);
    }
  };

  const onReplaceAudio = async (id: string) => {
    const file = await pickFile("audio/*,.wav,.mp3,.flac,.aiff");
    if (!file) return;
    setError(null);
    setBusyId(id);
    try {
      await replaceAudio(id, file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось заменить аудио");
    } finally {
      setBusyId(null);
    }
  };

  const onSetImage = async (id: string) => {
    const file = await pickFile("image/jpeg,image/png,.jpg,.jpeg,.png,.webp");
    if (!file) return;
    setError(null);
    setBusyId(id);
    try {
      await setImage(id, file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить обложку");
    } finally {
      setBusyId(null);
    }
  };

  const onMove = async (id: string, dir: -1 | 1) => {
    setError(null);
    try {
      await moveDemo(id, dir);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось изменить порядок");
    }
  };

  const onRemove = async (id: string) => {
    setError(null);
    setBusyId(id);
    try {
      await removeDemo(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить");
    } finally {
      setBusyId(null);
    }
  };

  const commitTitle = async (id: string, current: string) => {
    const next = (drafts[id] ?? current).trim();
    setDrafts((d) => {
      const { [id]: _omit, ...rest } = d;
      return rest;
    });
    if (next && next !== current) {
      try {
        await updateTitle(id, next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось переименовать");
      }
    }
  };

  const uploading = uploadProgress !== null;

  return (
    <div className="max-w-[720px] mx-auto px-5 py-7">
      {/* Страница живёт вне (artist)-каркаса, поэтому контрол ставим вручную */}
      <BackHome homeHref="/dashboard" roots={[]} />

      <div className="mb-5">
        <div className="text-[12px] text-[#A6A5AB]">ДЕМО</div>
        <div className="text-[22px] font-semibold tracking-[-0.01em]">Управление демо</div>
        <div className="text-[14px] text-[#6E6D73] mt-[3px]">
          Загружайте, заменяйте и удаляйте черновики — всё хранится в вашем кабинете
        </div>
      </div>

      {/* Загрузить демо */}
      <button
        onClick={onUpload}
        disabled={uploading}
        className="w-full mb-3 flex items-center justify-center gap-3 rounded-[16px] border border-dashed border-[#D2D0CB] bg-white px-5 py-[20px] hover:border-[#17161A] hover:bg-[#F0EEEA]/50 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className="w-11 h-11 rounded-full bg-[#17161A] text-white flex items-center justify-center shrink-0">
          {uploading ? <Loader2 className="w-6 h-6 animate-spin" strokeWidth={2} /> : <Plus className="w-6 h-6" strokeWidth={2.5} />}
        </span>
        <span className="text-left">
          <span className="block text-[15px] font-medium">
            {uploading ? `Загрузка… ${uploadProgress}%` : "Загрузить демо"}
          </span>
          <span className="block text-[12px] text-[#A6A5AB]">WAV, MP3 или FLAC</span>
        </span>
      </button>

      {uploading && (
        <div className="h-2 bg-[#F0EEEA] rounded-full overflow-hidden mb-5">
          <div className="h-full bg-[#17161A] rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      {error && (
        <div className="text-[13px] text-[#17161A] bg-[#F0EEEA] border-[0.5px] border-[#D2D0CB] rounded-[12px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      {/* Список демо */}
      {loading ? (
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] py-10 flex items-center justify-center text-[#A6A5AB]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : demos.length === 0 ? (
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] py-10 text-center text-[13px] text-[#A6A5AB]">
          Пока нет ни одного демо
        </div>
      ) : (
        <div className="space-y-3">
          {demos.map((d, i) => {
            const rowBusy = busyId === d.id;
            return (
              <div
                key={d.id}
                className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-3 flex items-center gap-3"
              >
                {/* Порядок */}
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={() => onMove(d.id, -1)}
                    disabled={i === 0}
                    aria-label="Выше"
                    className="w-6 h-6 rounded-[12px] flex items-center justify-center text-[#A6A5AB] hover:text-[#17161A] hover:bg-[#F0EEEA] transition disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <ChevronUp className="w-[16px] h-[16px]" strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => onMove(d.id, 1)}
                    disabled={i === demos.length - 1}
                    aria-label="Ниже"
                    className="w-6 h-6 rounded-[12px] flex items-center justify-center text-[#A6A5AB] hover:text-[#17161A] hover:bg-[#F0EEEA] transition disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <ChevronDown className="w-[16px] h-[16px]" strokeWidth={2} />
                  </button>
                </div>

                {/* Обложка */}
                <button
                  onClick={() => onSetImage(d.id)}
                  disabled={rowBusy}
                  aria-label={d.image ? "Заменить обложку" : "Добавить обложку"}
                  title={d.image ? "Заменить обложку" : "Добавить обложку"}
                  className="relative w-16 h-16 rounded-[12px] shrink-0 overflow-hidden flex items-center justify-center group disabled:opacity-60"
                  style={{ background: d.gradient }}
                >
                  {d.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.image} alt={d.title} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <Disc3 className="w-6 h-6 text-white/70" strokeWidth={1.5} />
                  )}
                  <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <ImagePlus className="w-5 h-5 text-white" strokeWidth={1.75} />
                  </span>
                </button>

                {/* Название */}
                <div className="min-w-0 flex-1">
                  <input
                    value={drafts[d.id] ?? d.title}
                    onChange={(e) => setDrafts((s) => ({ ...s, [d.id]: e.target.value }))}
                    onBlur={() => commitTitle(d.id, d.title)}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    placeholder="Название демо"
                    className="w-full text-[14px] font-medium rounded-[12px] border border-transparent hover:border-[#E5E3DE] focus:border-[#17161A] bg-transparent px-2 py-[6px] -ml-2 outline-none transition placeholder:text-[#C4C3C8]"
                  />
                  <div className="flex items-center gap-[5px] text-[12px] text-[#A6A5AB] mt-[2px] px-[2px]">
                    <Music className="w-[12px] h-[12px]" strokeWidth={1.75} />
                    <span className="truncate">Аудио · сохранено</span>
                  </div>
                </div>

                {/* Действия */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onReplaceAudio(d.id)}
                    disabled={rowBusy}
                    aria-label="Заменить аудио"
                    title="Заменить аудио"
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition disabled:opacity-40"
                  >
                    {rowBusy ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} /> : <RefreshCw className="w-[17px] h-[17px]" strokeWidth={1.75} />}
                  </button>
                  <button
                    onClick={() => onRemove(d.id)}
                    disabled={rowBusy}
                    aria-label="Удалить демо"
                    title="Удалить"
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[#A6A5AB] hover:text-[#17161A] hover:bg-[#F0EEEA] transition disabled:opacity-40"
                  >
                    <Trash2 className="w-[17px] h-[17px]" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DemoEditPage() {
  return (
    <AuthGate>
      <DemoEditInner />
    </AuthGate>
  );
}

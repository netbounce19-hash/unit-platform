"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Disc3,
  Upload,
  Loader2,
  FileAudio,
  ImageIcon,
  FileText,
  ExternalLink,
  Check,
  CircleAlert,
} from "lucide-react";
import { formatPlannedDate } from "@/components/artist/ReleaseCarousel";
import {
  fetchRelease,
  updateRelease,
  listReleaseAssets,
  addReleaseAsset,
  releaseStatusLabels,
  type ReleaseView,
  type ReleaseAsset,
} from "@/lib/supabase/cabinet";
import { formatBytes, type AssetKind } from "@/lib/supabase/uploads";

const KINDS: { key: AssetKind; label: string; accept: string; icon: React.ReactNode }[] = [
  {
    key: "audio",
    label: "Аудио",
    accept: "audio/*,.wav,.flac,.mp3,.aiff",
    icon: <FileAudio className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  },
  {
    key: "photo",
    label: "Обложка",
    accept: "image/*,.jpg,.jpeg,.png,.webp",
    icon: <ImageIcon className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  },
  {
    key: "document",
    label: "Документ",
    accept: ".pdf,.doc,.docx,.txt,.rtf",
    icon: <FileText className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  },
];

export default function ReleasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [release, setRelease] = useState<ReleaseView | null>(null);
  const [assets, setAssets] = useState<ReleaseAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [savingDate, setSavingDate] = useState(false);
  const [kind, setKind] = useState<AssetKind>("audio");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetchRelease(id);
      setRelease(r);
      setDate(r?.planned_date ?? "");
      if (r) setAssets(await listReleaseAssets(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить релиз");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const saveDate = async () => {
    setSavingDate(true);
    setError(null);
    try {
      await updateRelease(id, { plannedDate: date || null });
      setRelease((r) => (r ? { ...r, planned_date: date || null } : r));
      setToast("Дата релиза сохранена");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить дату");
    } finally {
      setSavingDate(false);
    }
  };

  const onPick = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      await addReleaseAsset(id, file, kind, setProgress);
      setAssets(await listReleaseAssets(id));
      setToast("Файл добавлен к релизу");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Загрузка не удалась");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center text-[#A6A5AB]">
        <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
      </div>
    );
  }

  if (!release) {
    return (
      <>
        <Link
          href="/releases"
          className="inline-flex items-center gap-[6px] text-[13px] text-[#6E6D73] hover:text-[#17161A] transition mb-5"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          К релизам
        </Link>
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px]">
          <div className="text-[16px] font-semibold tracking-[-0.01em]">Релиз не найден</div>
          <p className="text-[13px] text-[#6E6D73] mt-2">
            Возможно, он был удалён или у вас нет к нему доступа.
          </p>
        </div>
      </>
    );
  }

  const badge = releaseStatusLabels[release.status] ?? {
    label: release.status,
    cls: "bg-[#F0EEEA] text-[#6E6D73]",
  };
  const current = KINDS.find((k) => k.key === kind)!;
  const uploading = progress !== null;
  const dateChanged = (release.planned_date ?? "") !== date;

  return (
    <>
      <Link
        href="/releases"
        className="inline-flex items-center gap-[6px] text-[13px] text-[#6E6D73] hover:text-[#17161A] transition mb-5"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        К релизам
      </Link>

      {/* Шапка релиза */}
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] mb-4">
        <div className="flex items-center gap-4">
          <div className="w-[72px] h-[72px] rounded-[12px] overflow-hidden border-[0.5px] border-[#ECEAE5] shrink-0 bg-[#17161A] flex items-center justify-center">
            {release.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={release.coverUrl}
                alt={`Обложка релиза ${release.title}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <Disc3 className="w-8 h-8 text-white/60" strokeWidth={1.5} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[20px] font-medium tracking-[-0.01em] truncate">
              {release.title}
            </div>
            <div className="flex items-center gap-[6px] text-[13px] text-[#6E6D73] mt-[3px]">
              <CalendarDays className="w-[14px] h-[14px] shrink-0" strokeWidth={1.75} />
              {formatPlannedDate(release.planned_date) ?? (
                <span className="text-[#A6A5AB]">Дата не назначена</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Приёмка менеджером */}
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] mb-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="text-[16px] font-semibold tracking-[-0.01em]">Приёмка менеджером</div>
          <span
            className={`text-[12px] font-medium px-[10px] py-[4px] rounded-full shrink-0 ${badge.cls}`}
          >
            {badge.label}
          </span>
        </div>
        <p className="text-[13px] text-[#6E6D73] leading-[1.5]">
          {release.status === "pending_approval" &&
            "Релиз отправлен менеджеру и ждёт решения. Пока он на согласовании, можно догружать материалы."}
          {release.status === "approved" &&
            `Менеджер принял релиз${release.approved_at ? ` ${formatPlannedDate(release.approved_at.slice(0, 10))}` : ""}.`}
          {release.status === "rejected" &&
            "Менеджер отклонил релиз. Свяжитесь с ним в чате, чтобы узнать причину."}
          {release.status === "in_progress" && "Лейбл ведёт релиз в работу."}
          {release.status === "released" && "Релиз вышел и доступен на площадках."}
          {release.status === "draft" && "Черновик ещё не отправлен менеджеру."}
        </p>
        {!release.org_id && (
          <div className="flex items-start gap-[10px] rounded-[12px] border-[0.5px] border-[#F0E2BF] bg-[#FBF1DE] px-[14px] py-[11px] mt-3">
            <CircleAlert className="w-[14px] h-[14px] text-[#8A5A16] shrink-0 mt-[2px]" strokeWidth={2} />
            <p className="text-[12px] leading-[1.45] text-[#6E6D73]">
              Этот релиз не привязан к лейблу, поэтому менеджер его не видит. Так бывает у релизов,
              созданных до подключения приёмки.
            </p>
          </div>
        )}
      </div>

      {/* Дата релиза */}
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] mb-4">
        <div className="text-[16px] font-semibold tracking-[-0.01em] mb-1">Дата релиза</div>
        <p className="text-[13px] text-[#6E6D73] mb-3">
          Менеджер видит эту дату в кабинете лейбла и планирует по ней питчинг.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 text-[14px] rounded-[12px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#E23A34] transition"
          />
          <button
            onClick={saveDate}
            disabled={!dateChanged || savingDate}
            className="shrink-0 bg-[#E23A34] text-white font-medium text-[14px] px-[18px] py-[10px] rounded-full hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {savingDate ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>

      {/* Догрузить данные */}
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] mb-4">
        <div className="text-[16px] font-semibold tracking-[-0.01em] mb-1">Догрузить данные</div>
        <p className="text-[13px] text-[#6E6D73] mb-4">
          Мастер, обложка или документы — файлы прикрепятся к этому релизу.
        </p>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {KINDS.map((k) => (
            <button
              key={k.key}
              onClick={() => setKind(k.key)}
              disabled={uploading}
              className={`flex items-center justify-center gap-2 text-[13px] font-medium rounded-full px-[14px] py-[8px] border transition disabled:opacity-50 ${
                kind === k.key
                  ? "border-[#E23A34] bg-[#FDEDEB] text-[#A62018]"
                  : "border-[#E5E3DE] bg-white text-[#6E6D73] hover:border-[#D2D0CB]"
              }`}
            >
              {k.icon}
              {k.label}
            </button>
          ))}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={current.accept}
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />

        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-3 rounded-[12px] border border-dashed border-[#D2D0CB] px-5 py-[16px] hover:border-[#E23A34] hover:bg-[#FDEDEB]/50 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="w-9 h-9 rounded-full bg-[#E23A34] text-white flex items-center justify-center shrink-0">
            <Upload className="w-[18px] h-[18px]" strokeWidth={2} />
          </span>
          <span className="text-[14px] font-medium">
            {uploading ? `Загрузка… ${progress}%` : `Выбрать ${current.label.toLowerCase()}`}
          </span>
        </button>

        {uploading && (
          <div className="h-2 bg-[#F0EEEA] rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-[#E23A34] rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Файлы релиза */}
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] px-[22px] pt-[18px] pb-[14px] mb-4">
        <div className="text-[16px] font-semibold tracking-[-0.01em] mb-1">Файлы релиза</div>
        {assets.length === 0 ? (
          <div className="py-8 text-[13px] text-[#A6A5AB] text-center">
            К релизу пока ничего не прикреплено
          </div>
        ) : (
          assets.map((a, i) => (
            <div
              key={a.id}
              className={`flex items-center gap-3 py-[13px] ${
                i > 0 ? "border-t-[0.5px] border-[#ECEAE5]" : ""
              }`}
            >
              <span className="w-9 h-9 rounded-[12px] bg-[#F0EEEA] text-[#6E6D73] flex items-center justify-center shrink-0">
                {KINDS.find((k) => k.key === a.kind)?.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium truncate">{a.title}</div>
                <div className="text-[12px] text-[#A6A5AB] mt-[2px]">
                  {formatBytes(a.size_bytes)} · {new Date(a.created_at).toLocaleDateString("ru-RU")}
                </div>
              </div>
              {a.url && (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Открыть ${a.title}`}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition shrink-0"
                >
                  <ExternalLink className="w-4 h-4" strokeWidth={1.75} />
                </a>
              )}
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="text-[13px] text-[#A62018] bg-[#FDEDEB] border-[0.5px] border-[#F3C9C6] rounded-[12px] px-3 py-[9px]">
          {error}
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-[10px] bg-[#17161A] text-white text-[13px] font-medium pl-[14px] pr-[18px] py-[11px] rounded-full"
        >
          <span className="w-5 h-5 rounded-full bg-[#1F9D6B] flex items-center justify-center shrink-0">
            <Check className="w-[13px] h-[13px]" strokeWidth={3} />
          </span>
          {toast}
        </div>
      )}
    </>
  );
}

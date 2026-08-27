"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileAudio, ImageIcon, FileText, Upload, Trash2, ExternalLink, Loader2 } from "lucide-react";
import {
  uploadAsset,
  listAssets,
  getSignedUrl,
  deleteAsset,
  formatBytes,
  type Asset,
  type AssetKind,
} from "@/lib/supabase/uploads";

const KINDS: { key: AssetKind; label: string; accept: string; icon: React.ReactNode }[] = [
  {
    key: "audio",
    label: "Аудио",
    accept: "audio/*,.wav,.flac,.mp3,.aiff",
    icon: <FileAudio className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  },
  {
    key: "photo",
    label: "Фото",
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

interface AssetManagerProps {
  /** Зафиксировать тип файла снаружи (вкладки страницы «Материалы»). */
  kind?: AssetKind;
  /** Скрыть внутренний переключатель типов — когда им управляют снаружи. */
  hideTabs?: boolean;
}

export default function AssetManager({ kind: controlledKind, hideTabs = false }: AssetManagerProps = {}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalKind, setInternalKind] = useState<AssetKind>("audio");
  const kind = controlledKind ?? internalKind;
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setAssets(await listAssets());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить список");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onPick = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setProgress(0);

    try {
      await uploadAsset({ file, kind, onProgress: setProgress });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Загрузка не удалась");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const open = async (asset: Asset) => {
    setBusyId(asset.id);
    setError(null);
    try {
      const url = await getSignedUrl(asset.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось получить ссылку");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (asset: Asset) => {
    setBusyId(asset.id);
    setError(null);
    try {
      await deleteAsset(asset);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить");
    } finally {
      setBusyId(null);
    }
  };

  const current = KINDS.find((k) => k.key === kind)!;
  const uploading = progress !== null;
  // Когда тип задан снаружи, список тоже показывает только его.
  const visible = controlledKind ? assets.filter((a) => a.kind === controlledKind) : assets;

  return (
    <div className="space-y-4">
      {/* Загрузка */}
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px]">
        <div className="text-[16px] font-semibold tracking-[-0.01em] mb-1">Загрузить файл</div>
        <div className="text-[13px] text-[#6E6D73] mb-4">
          Аудио загружается по частям — обрыв связи не начнёт всё заново
        </div>

        {!hideTabs && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {KINDS.map((k) => (
            <button
              key={k.key}
              onClick={() => setInternalKind(k.key)}
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
        )}

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

        {error && (
          <div className="text-[13px] text-[#A62018] bg-[#FDEDEB] border-[0.5px] border-[#F3C9C6] rounded-[12px] px-3 py-[9px] mt-3">
            {error}
          </div>
        )}
      </div>

      {/* Список */}
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] px-[22px] pt-[18px] pb-[14px]">
        <div className="text-[16px] font-semibold tracking-[-0.01em] mb-1">Мои загрузки</div>

        {loading ? (
          <div className="py-8 flex items-center justify-center text-[#A6A5AB]">
            <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
          </div>
        ) : visible.length === 0 ? (
          <div className="py-8 text-[13px] text-[#A6A5AB] text-center">Пока ничего не загружено</div>
        ) : (
          visible.map((a, i) => (
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
                  {formatBytes(a.size_bytes)} ·{" "}
                  {new Date(a.created_at).toLocaleDateString("ru-RU")}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => open(a)}
                  disabled={busyId === a.id}
                  aria-label="Открыть по временной ссылке"
                  title="Открыть по временной ссылке"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition disabled:opacity-40"
                >
                  {busyId === a.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                  ) : (
                    <ExternalLink className="w-4 h-4" strokeWidth={1.75} />
                  )}
                </button>
                <button
                  onClick={() => remove(a)}
                  disabled={busyId === a.id}
                  aria-label="Удалить файл"
                  title="Удалить"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#C4C3C8] hover:text-[#A62018] hover:bg-[#FDEDEB] transition disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

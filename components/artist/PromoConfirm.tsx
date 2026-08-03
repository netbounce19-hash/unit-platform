"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, Link2, Check, Trash2, Loader2, ExternalLink } from "lucide-react";
import {
  listPromoReports,
  createPromoReport,
  deletePromoReport,
  promoStatusLabels,
  PROMO_PLATFORMS,
  type PromoReportRow,
} from "@/lib/supabase/cabinet";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/**
 * Подтверждение промо-действия: артист присылает менеджеру ссылку на
 * опубликованный ролик. Появляется, когда задачи на сегодня выполнены —
 * до этого подтверждать нечего.
 */
export default function PromoConfirm() {
  const [reports, setReports] = useState<PromoReportRow[]>([]);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<string>(PROMO_PLATFORMS[0]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPromoReports()
      .then((rows) => !cancelled && setReports(rows))
      .catch(() => {
        /* не залогинен или нет доступа — оставляем пустой список */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => setSent(false), 2600);
    return () => clearTimeout(t);
  }, [sent]);

  const looksLikeLink = /^https?:\/\/\S+$/i.test(url.trim());

  const send = async () => {
    if (!looksLikeLink || busy) return;
    setBusy(true);
    setError(null);
    try {
      const row = await createPromoReport({ platform, url });
      setReports((prev) => [row, ...prev]);
      setUrl("");
      setOpen(false);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить подтверждение");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const prev = reports;
    setReports((r) => r.filter((x) => x.id !== id)); // оптимистично
    try {
      await deletePromoReport(id);
    } catch {
      setReports(prev); // откат
      setError("Не удалось отозвать подтверждение");
    }
  };

  return (
    <div className="border-t-[0.5px] border-[#ECEAE5] mt-1 pt-[14px]">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-[7px] bg-[#17161A] text-white font-medium text-[14px] px-[18px] py-[11px] rounded-[10px] hover:bg-[#2A282E] transition"
        >
          {sent ? (
            <>
              <Check className="w-[16px] h-[16px]" strokeWidth={2.5} />
              Отправлено менеджеру
            </>
          ) : (
            <>
              <Send className="w-[15px] h-[15px]" strokeWidth={2} />
              Отправить подтверждение менеджеру
            </>
          )}
        </button>
      ) : (
        <div>
          <div className="text-[13px] font-medium text-[#6E6D73] mb-[8px]">Где опубликовано</div>
          <div className="flex flex-wrap gap-[6px] mb-3">
            {PROMO_PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`text-[12.5px] font-medium rounded-full px-[12px] py-[6px] border transition ${
                  platform === p
                    ? "border-[#E23A34] bg-[#FDEDEB] text-[#A62018]"
                    : "border-[#E5E3DE] bg-white text-[#6E6D73] hover:border-[#D2D0CB]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="text-[13px] font-medium text-[#6E6D73] mb-[8px]">Ссылка на публикацию</div>
          <div className="flex items-center gap-2">
            <span className="relative flex-1 min-w-0">
              <Link2
                className="absolute left-[11px] top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-[#A6A5AB]"
                strokeWidth={1.75}
              />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="https://tiktok.com/@…"
                className="w-full text-[14px] rounded-[10px] border border-[#E5E3DE] bg-white pl-[34px] pr-3 py-[10px] outline-none focus:border-[#E23A34] transition placeholder:text-[#C4C3C8]"
              />
            </span>
            <button
              onClick={send}
              disabled={!looksLikeLink || busy}
              className="shrink-0 inline-flex items-center gap-[6px] bg-[#E23A34] text-white font-medium text-[14px] px-[16px] py-[10px] rounded-[10px] hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
              ) : (
                <Send className="w-4 h-4" strokeWidth={2} />
              )}
              Отправить
            </button>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="text-[13px] font-medium text-[#6E6D73] hover:text-[#17161A] transition"
            >
              Отмена
            </button>
            {url.trim() && !looksLikeLink && (
              <span className="text-[12px] text-[#A6A5AB]">Ссылка должна начинаться с http</span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="text-[12.5px] text-[#A62018] bg-[#FDEDEB] border-[0.5px] border-[#F3C9C6] rounded-[10px] px-3 py-[8px] mt-2">
          {error}
        </div>
      )}

      {/* Уже отправленные подтверждения */}
      {reports.length > 0 && (
        <div className="mt-3">
          <AnimatePresence initial={false}>
            {reports.map((r, i) => (
              <motion.div
                key={r.id}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div
                  className={`flex items-center gap-3 py-[11px] ${
                    i > 0 ? "border-t-[0.5px] border-[#ECEAE5]" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium truncate">{r.platform}</div>
                    <div className="text-[12px] text-[#A6A5AB] mt-[1px] truncate">
                      {formatWhen(r.created_at)}
                      {r.url ? ` · ${r.url.replace(/^https?:\/\//, "")}` : ""}
                    </div>
                  </div>
                  <span
                    className={`text-[11.5px] font-medium px-[9px] py-[3px] rounded-full shrink-0 ${
                      promoStatusLabels[r.status].cls
                    }`}
                  >
                    {promoStatusLabels[r.status].label}
                  </span>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Открыть публикацию в ${r.platform}`}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition shrink-0"
                    >
                      <ExternalLink className="w-[15px] h-[15px]" strokeWidth={1.75} />
                    </a>
                  )}
                  {r.status === "submitted" && (
                    <button
                      onClick={() => remove(r.id)}
                      aria-label="Отозвать подтверждение"
                      title="Отозвать — пока менеджер не отсмотрел"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[#C4C3C8] hover:text-[#A62018] hover:bg-[#FDEDEB] transition shrink-0"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

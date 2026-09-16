"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Megaphone } from "lucide-react";
import { fmtCompact } from "@/lib/label/trends";
import {
  PITCH_CLS,
  campaignLabel,
  channelLabel,
  fetchMyReleasePromo,
  pitchLabel,
  type ArtistPromo,
} from "@/lib/supabase/promo";

const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : null;

/**
 * Что лейбл делает для продвижения релиза: куда отправили трек, где он
 * вышел и какие публикации уже случились. Стоимость и внутренние заметки
 * артисту не показываются — их база и не отдаёт.
 */
export default function ReleasePromoCard({ releaseId }: { releaseId: string }) {
  const [promo, setPromo] = useState<ArtistPromo | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchMyReleasePromo(releaseId)
      .then((p) => !cancelled && setPromo(p))
      .catch(() => !cancelled && setPromo(null));
    return () => {
      cancelled = true;
    };
  }, [releaseId]);

  if (!promo || (promo.pitches.length === 0 && promo.campaigns.length === 0)) return null;

  const placed = promo.pitches.filter((p) => p.status === "placed");
  const reach =
    placed.reduce((t, p) => t + (p.reach ?? 0), 0) +
    promo.campaigns.reduce((t, c) => t + c.items.reduce((s, i) => s + (i.reach ?? 0), 0), 0);

  return (
    <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] mb-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-[16px] font-semibold tracking-[-0.01em]">
          <Megaphone className="w-[17px] h-[17px] text-[#6E6D73]" strokeWidth={1.75} />
          Продвижение
        </div>
        {reach > 0 && <span className="text-[12.5px] text-[#6E6D73] tabular-nums">охват {fmtCompact(reach)}</span>}
      </div>

      {promo.pitches.length > 0 && (
        <div className="mb-3">
          <div className="text-[12px] font-medium text-[#A6A5AB] mb-1.5">
            Питчинг · попали в {placed.length} из {promo.pitches.length}
          </div>
          <div className="space-y-1.5">
            {promo.pitches.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{p.target}</span>
                  <span className="block text-[11.5px] text-[#A6A5AB] truncate">
                    {[p.curator, p.result, p.reach ? `охват ${fmtCompact(p.reach)}` : null, p.sent_on ? `отправлен ${fmtDate(p.sent_on)}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {p.result_url && (
                  <a href={p.result_url} target="_blank" rel="noopener noreferrer" aria-label="Открыть плейлист" className="text-[#6E6D73] hover:text-[#17161A]">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <span className={`text-[11.5px] font-medium px-[8px] py-[3px] rounded-full shrink-0 ${PITCH_CLS[p.status]}`}>{pitchLabel(p.status)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {promo.campaigns.map((c) => (
        <div key={c.id} className="rounded-[12px] bg-[#FAFAF9] px-[14px] py-[11px] mt-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium truncate">{c.title}</div>
              <div className="text-[11.5px] text-[#A6A5AB]">
                {[channelLabel(c.channel), c.starts_on || c.ends_on ? `${fmtDate(c.starts_on) ?? "…"} — ${fmtDate(c.ends_on) ?? "…"}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <span className="text-[11.5px] font-medium px-[8px] py-[3px] rounded-full bg-white text-[#17161A] shrink-0">{campaignLabel(c.status)}</span>
          </div>
          {c.goal && <p className="text-[12.5px] text-[#6E6D73] mt-1">Цель: {c.goal}</p>}
          {c.items.length > 0 && (
            <div className="mt-2 space-y-1">
              {c.items.map((i, k) => (
                <div key={k} className="flex items-center gap-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate">
                    {i.name}
                    {i.platform ? <span className="text-[#A6A5AB]"> · {i.platform}</span> : null}
                  </span>
                  {i.reach ? <span className="text-[#6E6D73] tabular-nums shrink-0">{fmtCompact(i.reach)}</span> : null}
                  {i.url && (
                    <a href={i.url} target="_blank" rel="noopener noreferrer" aria-label={`Открыть публикацию: ${i.name}`} className="text-[#6E6D73] hover:text-[#17161A]">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

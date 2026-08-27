"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, ChevronRight, Loader2 } from "lucide-react";
import { fetchMyArtistLink, listReleases, listBudgetRequests, listPromoReports } from "@/lib/supabase/cabinet";
import { fetchMyStreamStat, formatCount, type StreamStat } from "@/lib/supabase/streamStats";

interface Counts {
  releases: number;
  released: number;
  budgetsApproved: number;
  budgetsTotal: number;
  promoAccepted: number;
  promoTotal: number;
}

/**
 * Показатели артиста на дашборде.
 *
 * Стримы и слушателей вводит менеджер в «Загрузке данных» — сюда они
 * приходят из artist_stream_stats. Остальное считается по собственным
 * строкам артиста, поэтому цифры честные: если менеджер ещё ничего не
 * загрузил, так и написано, а не показан ноль.
 */
export default function StatsSection() {
  const [stat, setStat] = useState<StreamStat | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [linked, setLinked] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const link = await fetchMyArtistLink();
        if (cancelled) return;
        setLinked(link !== null);

        const [releases, budgets, promos, s] = await Promise.all([
          listReleases().catch(() => []),
          listBudgetRequests().catch(() => []),
          listPromoReports().catch(() => []),
          link ? fetchMyStreamStat(link.artistId).catch(() => null) : Promise.resolve(null),
        ]);
        if (cancelled) return;

        setStat(s);
        setCounts({
          releases: releases.length,
          released: releases.filter((r) => r.status === "released").length,
          budgetsApproved: budgets.filter((b) => b.status === "approved").length,
          budgetsTotal: budgets.length,
          promoAccepted: promos.filter((p) => p.status === "accepted").length,
          promoTotal: promos.length,
        });
      } catch {
        /* не залогинен или сеть — покажем пустое состояние */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] px-[22px] pt-[18px] pb-[18px] mb-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-[17px] h-[17px] text-[#6E6D73]" strokeWidth={1.75} />
        <div className="text-[16px] font-semibold tracking-[-0.01em]">Статистика</div>
      </div>

      {loading ? (
        <div className="py-6 flex items-center justify-center text-[#A6A5AB]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : (
        <>
          {/* Стримы и слушатели — от менеджера */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Tile
              label="Стримы"
              value={stat ? formatCount(stat.streams) : "—"}
              hint={stat ? "всего" : "менеджер ещё не загрузил"}
            />
            <Tile
              label="Слушатели"
              value={stat ? formatCount(stat.listeners) : "—"}
              hint={stat ? "в месяц" : "менеджер ещё не загрузил"}
            />
          </div>

          {/* Собственные данные артиста */}
          <div className="grid grid-cols-3 gap-3">
            <Tile
              label="Релизы"
              value={String(counts?.releases ?? 0)}
              hint={counts?.released ? `${counts.released} вышло` : "в работе"}
            />
            <Tile
              label="Заявки"
              value={String(counts?.budgetsApproved ?? 0)}
              hint={`одобрено из ${counts?.budgetsTotal ?? 0}`}
            />
            <Tile
              label="Промо"
              value={String(counts?.promoAccepted ?? 0)}
              hint={`принято из ${counts?.promoTotal ?? 0}`}
            />
          </div>

          {!linked && (
            <p className="text-[12px] text-[#A6A5AB] leading-[1.45] mt-3">
              Аккаунт не привязан к лейблу, поэтому стримы и слушатели сюда не приходят.
            </p>
          )}

          {stat && (
            <div className="text-[11.5px] text-[#A6A5AB] mt-3">
              Обновлено {new Date(stat.updated_at).toLocaleDateString("ru-RU")}
            </div>
          )}

          <Link
            href="/profile"
            className="flex items-center gap-2 text-[13px] font-medium text-[#17161A] hover:text-[#6E6D73] transition mt-4"
          >
            Все показатели в профиле
            <ChevronRight className="w-[15px] h-[15px]" strokeWidth={2} />
          </Link>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[12px] bg-[#FAFAF9] px-[12px] py-[10px]">
      <div className="text-[11.5px] text-[#A6A5AB] truncate">{label}</div>
      <div className="text-[20px] font-medium mt-[2px] tabular-nums">{value}</div>
      <div className="text-[11.5px] text-[#6E6D73] mt-[1px] truncate">{hint}</div>
    </div>
  );
}

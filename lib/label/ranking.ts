import type { RosterArtist, ObligationStat } from "@/lib/supabase/label";

/** Минимум, который нужен рейтингу от строки статистики. */
export interface HasStreams {
  streams: number;
}

/**
 * Рейтинг артистов по трём метрикам. Формула жила внутри страницы
 * статистики; теперь её же показывает ростер, поэтому она здесь —
 * чтобы два экрана не разъехались в подсчётах.
 */
export type Metric = "streams" | "efficiency" | "obligation";

export interface ArtistScore {
  artist: RosterArtist;
  /** абсолютное число прослушиваний */
  streams: number;
  /** 0..100 — доля от лучшего в ростере */
  streamsScore: number;
  /** 0..100, null если у артиста ещё нет задач */
  obligationScore: number | null;
  /** 0..100 */
  efficiency: number;
}

/** Вес стримов в эффективности; остальное — обязательность. */
const STREAMS_WEIGHT = 0.6;

export function computeScores(
  artists: RosterArtist[],
  obligations: ObligationStat[],
  streamsMap: Map<string, HasStreams>
): ArtistScore[] {
  const oblByArtist = new Map(obligations.map((o) => [o.artistId, o]));
  // Нормируем по лучшему в ростере: абсолютные стримы несопоставимы между лейблами
  const maxStreams = Math.max(1, ...artists.map((a) => streamsMap.get(a.id)?.streams ?? 0));

  return artists.map((a) => {
    const streams = streamsMap.get(a.id)?.streams ?? 0;
    const streamsScore = Math.round((streams / maxStreams) * 100);
    const obligationScore = oblByArtist.get(a.id)?.ratio ?? null;
    // Если задач ещё нет, обязательность не с чем складывать — считаем по стримам
    const efficiency =
      obligationScore === null
        ? streamsScore
        : Math.round(streamsScore * STREAMS_WEIGHT + obligationScore * (1 - STREAMS_WEIGHT));
    return { artist: a, streams, streamsScore, obligationScore, efficiency };
  });
}

export function sortByMetric(rows: ArtistScore[], metric: Metric): ArtistScore[] {
  return [...rows].sort((x, y) => {
    if (metric === "streams") return y.streams - x.streams;
    if (metric === "obligation") return (y.obligationScore ?? -1) - (x.obligationScore ?? -1);
    return y.efficiency - x.efficiency;
  });
}

/** 65000 → «65k», 1200000 → «1.2M» */
export function fmtStreams(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

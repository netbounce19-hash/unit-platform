"use client";

import { useEffect, useState } from "react";
import StreamTrendCard from "@/components/charts/StreamTrendCard";
import { fetchMyArtistLink } from "@/lib/supabase/cabinet";

/** Динамика стримов артиста на дашборде — только если он привязан к лейблу. */
export default function MyStreamTrend() {
  const [artistId, setArtistId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchMyArtistLink()
      .then((l) => !cancelled && setArtistId(l?.artistId ?? null))
      .catch(() => !cancelled && setArtistId(null));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!artistId) return null;
  return <StreamTrendCard artistId={artistId} title="Стримы по месяцам" />;
}

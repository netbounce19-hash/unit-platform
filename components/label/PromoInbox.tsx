"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";

export default function PromoInbox() {
  const { state, dispatch } = useApp();

  const getArtistName = (id: string) =>
    state.artists.find((a) => a.id === id)?.name || "—";

  const unreviewed = state.promos.filter((p) => !p.reviewed);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  };

  const getPlatformCode = (platform: string) => {
    switch (platform) {
      case "TikTok": return "TT";
      case "Instagram Reels": return "IG";
      case "YouTube Shorts": return "YT";
      default: return "•";
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="bg-navy/30 border border-navy rounded-xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-alabaster">
          Промо-входящие
        </h3>
        {unreviewed.length > 0 && (
          <span className="px-2.5 py-1 bg-brass/20 text-brass text-[9px] tracking-wider uppercase rounded-full">
            {unreviewed.length} новых
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {state.promos.map((promo) => (
          <motion.div
            key={promo.id}
            layout
            className={`rounded-lg border overflow-hidden transition-opacity ${
              promo.reviewed ? "opacity-50 border-navy/30" : "border-navy/60"
            }`}
          >
            <div className="h-24 bg-navy/40 flex items-center justify-center relative">
              <div className="text-center">
                <span className="text-2xl font-bold text-alabaster-dim/20">
                  {getPlatformCode(promo.platform)}
                </span>
                <p className="text-[8px] text-alabaster-dim/25 mt-1 px-2 truncate">{promo.screenshotName}</p>
              </div>
              <span className="absolute top-2 left-2 px-2 py-0.5 bg-sapphire/80 text-[8px] tracking-wider uppercase text-brass rounded">
                {promo.platform}
              </span>
            </div>

            <div className="p-3 bg-sapphire/20">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-5 h-5 rounded-full bg-navy flex items-center justify-center text-[9px] font-bold text-alabaster">
                  {getArtistName(promo.artistId)[0]}
                </div>
                <span className="text-xs font-medium text-alabaster">{getArtistName(promo.artistId)}</span>
                <span className="text-[9px] text-alabaster-dim ml-auto">{formatDate(promo.submittedAt)}</span>
              </div>

              <a
                href={promo.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] text-brass hover:text-brass-dim truncate block mb-2.5 transition-colors"
              >
                {promo.link}
              </a>

              {!promo.reviewed ? (
                <button
                  onClick={() => dispatch({ type: "REVIEW_PROMO", payload: promo.id })}
                  className="w-full py-1.5 bg-brass/20 text-brass text-[9px] font-semibold tracking-widest uppercase rounded hover:bg-brass/30 transition-colors cursor-pointer"
                >
                  Отметить проверенным
                </button>
              ) : (
                <span className="block text-center text-[9px] tracking-widest uppercase text-success py-1.5">
                  ✓ Проверено
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {state.promos.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-xs text-alabaster-dim/40 tracking-wider uppercase">
            Нет промо-отчётов
          </p>
        </div>
      )}
    </motion.section>
  );
}

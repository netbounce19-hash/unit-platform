"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";
import { useState } from "react";

export default function PromoReports() {
  const { state, dispatch } = useApp();
  const [link, setLink] = useState("");
  const [platform, setPlatform] = useState("TikTok");
  const [submitted, setSubmitted] = useState(false);

  const artistPromos = state.promos.filter(
    (p) => p.artistId === state.currentArtistId
  );

  const handleSubmit = () => {
    if (!link) return;
    dispatch({
      type: "ADD_PROMO",
      payload: {
        artistId: state.currentArtistId,
        platform,
        link,
        screenshotName: `promo_${platform.toLowerCase()}_${Date.now()}.png`,
        submittedAt: new Date().toISOString(),
        reviewed: false,
      },
    });
    setLink("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  const platforms = ["TikTok", "Instagram Reels", "YouTube Shorts"];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="bg-navy/30 border border-navy rounded-xl p-7"
    >
      <h3 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-alabaster mb-6">
        Промо-отчёты
      </h3>

      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {platforms.map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`
                px-3 py-1.5 rounded-md text-[9px] tracking-wider uppercase transition-all cursor-pointer
                ${platform === p
                  ? "bg-brass text-sapphire font-semibold"
                  : "bg-sapphire/50 text-alabaster-dim hover:text-alabaster border border-navy"
                }
              `}
            >
              {p}
            </button>
          ))}
        </div>

        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder={`Вставьте ссылку ${platform}...`}
          className="w-full bg-sapphire border border-navy rounded-lg px-4 py-3 text-sm text-alabaster placeholder-alabaster-dim/50 focus:outline-none focus:border-brass/50 transition-colors"
        />

        <div
          className="border-2 border-dashed border-navy rounded-lg p-5 text-center hover:border-brass/50 transition-colors cursor-pointer"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.click();
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-alabaster-dim mb-2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <p className="text-[9px] tracking-widest uppercase text-alabaster-dim">
            Загрузить скриншот
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!link}
          className={`
            w-full py-3 rounded-lg text-xs font-semibold tracking-widest uppercase transition-all cursor-pointer
            ${link
              ? "bg-brass text-sapphire hover:bg-brass-dim"
              : "bg-navy/50 text-alabaster-dim cursor-not-allowed"
            }
          `}
        >
          {submitted ? "✓ Отправлено" : "Отправить отчёт"}
        </button>
      </div>

      {artistPromos.length > 0 && (
        <div className="mt-5 pt-5 border-t border-navy/40">
          <p className="text-[9px] tracking-widest uppercase text-alabaster-dim mb-3">
            История отчётов
          </p>
          <div className="space-y-2.5">
            {artistPromos.slice(-3).reverse().map((promo) => (
              <div
                key={promo.id}
                className="flex items-center justify-between bg-sapphire/40 rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[9px] tracking-wider uppercase text-brass flex-shrink-0">
                    {promo.platform}
                  </span>
                  <span className="text-xs text-alabaster truncate">{promo.link}</span>
                </div>
                <span className={`text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-full flex-shrink-0 ml-3 ${
                  promo.reviewed ? "bg-success/20 text-success" : "bg-navy/50 text-alabaster-dim"
                }`}>
                  {promo.reviewed ? "Проверено" : "Ожидание"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}

"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";
import { useState } from "react";
import { Megaphone, Link2, UploadCloud, CheckCircle2, Clock } from "lucide-react";

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

  const platforms = ["TikTok", "Instagram Reels", "YouTube Shorts", "VK Клипы"];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 lg:p-7 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-5 pb-3 border-b-[0.5px] border-[#ECEAE5]">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#17161A]" />
            <h3 className="text-[14px] font-semibold text-[#17161A] tracking-tight">
              Промо-отчёты
            </h3>
          </div>
          <span className="text-[10px] font-mono tracking-wider text-[#A6A5AB] uppercase">
            [VIRAL PITCHING]
          </span>
        </div>

        <div className="space-y-3.5">
          <div className="flex gap-1.5 flex-wrap">
            {platforms.map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`
                  px-3 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer
                  ${platform === p
                    ? "bg-[#17161A] text-white font-semibold"
                    : "bg-[#FAFAF9] text-[#6E6D73] hover:text-[#17161A] border border-[#E5E3DE] hover:border-[#D2D0CB]"
                  }
                `}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={`Вставьте ссылку на видео (${platform})...`}
              className="w-full bg-[#FAFAF9] border border-[#E5E3DE] focus:border-[#17161A] rounded-[12px] pl-3.5 pr-10 py-2.5 text-[13.5px] text-[#17161A] placeholder-[#A6A5AB] focus:outline-none transition-colors"
            />
            <Link2 className="w-4 h-4 text-[#A6A5AB] absolute right-3.5 top-3 pointer-events-none" />
          </div>

          <div
            className="border border-dashed border-[#D2D0CB] hover:border-[#17161A] rounded-[12px] p-4 text-center bg-[#FAFAF9] hover:bg-white transition-colors cursor-pointer"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.click();
            }}
          >
            <UploadCloud className="w-4 h-4 text-[#6E6D73] mx-auto mb-1" />
            <p className="text-[11px] font-medium text-[#6E6D73]">
              Прикрепить скриншот статистики / охватов
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!link}
            className={`
              w-full py-2.5 rounded-full text-[13px] font-medium tracking-wide transition-all cursor-pointer
              ${link
                ? "bg-[#17161A] text-white hover:bg-[#2A282E]"
                : "bg-[#F0EEEA] text-[#A6A5AB] cursor-not-allowed"
              }
            `}
          >
            {submitted ? "✓ Отчёт принят в трекинг" : "Отправить отчёт"}
          </button>
        </div>
      </div>

      {artistPromos.length > 0 && (
        <div className="mt-5 pt-4 border-t border-[#ECEAE5]">
          <p className="text-[11px] font-mono tracking-wider uppercase text-[#6E6D73] mb-2.5">
            История отчётов
          </p>
          <div className="space-y-2">
            {artistPromos.slice(-3).reverse().map((promo) => (
              <div
                key={promo.id}
                className="flex items-center justify-between bg-[#FAFAF9] border border-[#ECEAE5] rounded-[12px] px-3.5 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono tracking-wider uppercase text-[#17161A] bg-[#F0EEEA] px-2 py-0.5 rounded-md flex-shrink-0">
                    {promo.platform}
                  </span>
                  <span className="text-[12px] font-mono text-[#17161A] truncate">{promo.link}</span>
                </div>
                <span className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                  promo.reviewed
                    ? "bg-[#E9F6EF] text-[#166B49] border border-[#BDE8D3]"
                    : "bg-[#FBF1DE] text-[#8A5A16] border border-[#F4E1BA]"
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

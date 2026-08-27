"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";
import { NotificationIconControlled } from "@/components/ui/animated-state-icons";
import { ExternalLink, Check } from "lucide-react";

export default function PromoInbox() {
  const { state, dispatch } = useApp();

  const getArtistName = (id: string) =>
    state.artists.find((a) => a.id === id)?.name || "—";

  const unreviewed = state.promos.filter((p) => !p.reviewed);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  };

  const getPlatformBadge = (platform: string) => {
    switch (platform) {
      case "TikTok":
        return "bg-[#17161A] text-white";
      case "Instagram Reels":
        return "bg-[#FDEDEB] text-[#A62018]";
      case "YouTube Shorts":
        return "bg-[#FBF1DE] text-[#8A5A16]";
      default:
        return "bg-[#F0EEEA] text-[#6E6D73]";
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <NotificationIconControlled
            size={18}
            color="#E23A34"
            hasNotif={unreviewed.length > 0}
          />
          <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[#17161A]">
            Входящие промо-отчёты
          </h3>
        </div>
        {unreviewed.length > 0 ? (
          <span className="px-2.5 py-0.5 bg-[#FDEDEB] text-[#A62018] text-[11px] font-medium rounded-full">
            {unreviewed.length} на проверке
          </span>
        ) : (
          <span className="px-2.5 py-0.5 bg-[#E9F6EF] text-[#1F9D6B] text-[11px] font-medium rounded-full">
            Все проверены
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {state.promos.map((promo) => (
          <motion.div
            key={promo.id}
            layout
            className={`rounded-[12px] border transition-all p-3.5 flex flex-col justify-between ${
              promo.reviewed
                ? "border-[#ECEAE5] bg-[#FAFAF9] opacity-75"
                : "border-[#ECEAE5] bg-white shadow-xs"
            }`}
          >
            <div>
              {/* Header inside item */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#17161A] text-white flex items-center justify-center text-[10px] font-bold">
                    {getArtistName(promo.artistId)[0]}
                  </div>
                  <span className="text-[13px] font-semibold text-[#17161A]">
                    {getArtistName(promo.artistId)}
                  </span>
                </div>
                <span className="text-[11px] text-[#A6A5AB]">
                  {formatDate(promo.submittedAt)}
                </span>
              </div>

              {/* Platform tag + file */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full ${getPlatformBadge(
                    promo.platform
                  )}`}
                >
                  {promo.platform}
                </span>
                <span className="text-[11px] text-[#6E6D73] truncate max-w-[130px]">
                  {promo.screenshotName}
                </span>
              </div>

              {/* Link */}
              <a
                href={promo.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-[#6E6D73] hover:text-[#E23A34] transition inline-flex items-center gap-1 mb-3 truncate max-w-full"
              >
                <span className="truncate">{promo.link}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>

            {/* Action button */}
            {!promo.reviewed ? (
              <button
                onClick={() =>
                  dispatch({ type: "REVIEW_PROMO", payload: promo.id })
                }
                className="w-full py-1.5 bg-[#FDEDEB] text-[#A62018] hover:bg-[#FCE2DF] text-[12px] font-medium rounded-full transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                Отметить проверенным
              </button>
            ) : (
              <div className="text-center py-1 text-[11px] font-medium text-[#1F9D6B] flex items-center justify-center gap-1">
                <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                Проверено менеджером
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {state.promos.length === 0 && (
        <div className="py-8 text-center text-[13px] text-[#A6A5AB]">
          Нет промо-отчётов
        </div>
      )}
    </motion.section>
  );
}

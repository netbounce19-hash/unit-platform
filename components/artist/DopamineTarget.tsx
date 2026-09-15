"use client";

import { useApp } from "@/components/providers/AppProvider";
import ProgressRing from "@/components/shared/ProgressRing";
import { motion } from "framer-motion";
import { Radio, Disc3, TrendingUp, Sparkles } from "lucide-react";

export default function DopamineTarget() {
  const { state } = useApp();
  const target = state.targets.find((t) => t.artistId === state.currentArtistId);
  const artist = state.artists.find((a) => a.id === state.currentArtistId);

  if (!target || !artist) return null;

  const progress = Math.min(target.current / target.goal, 1);
  const isComplete = progress >= 1;

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return n.toString();
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 lg:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b-[0.5px] border-[#ECEAE5]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#F0EEEA] flex items-center justify-center text-[#17161A]">
            <Radio className="w-4 h-4 text-[#17161A] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono tracking-wider text-[#A6A5AB] uppercase">
                [LIVE TRACKING]
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#1F9D6B]" />
            </div>
            <h2 className="text-[18px] font-semibold text-[#17161A] tracking-tight">{artist.name}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-[#6E6D73] bg-[#F7F6F3] border border-[#ECEAE5] px-3 py-1 rounded-full">
            Q3 / 2026
          </span>
          {isComplete && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#E9F6EF] text-[#166B49] text-[11px] font-medium rounded-full border border-[#BDE8D3]">
              <Sparkles className="w-3 h-3" /> Цель выполнена
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-8 lg:gap-12">
        <ProgressRing
          current={target.current}
          goal={target.goal}
          label={target.metric}
          size={190}
          strokeWidth={8}
        />

        <div className="flex-1 space-y-6 w-full">
          <div>
            <div className="flex justify-between text-xs text-[#6E6D73] font-medium mb-2">
              <span>Выполнение цели</span>
              <span className="text-[#17161A] font-semibold">{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 bg-[#F0EEEA] rounded-full overflow-hidden p-0.5 border border-[#ECEAE5]">
              <motion.div
                className="h-full bg-[#17161A] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#FAFAF9] rounded-[12px] p-4 border border-[#ECEAE5]">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-medium text-[#6E6D73]">Осталось до цели</p>
                <TrendingUp className="w-3.5 h-3.5 text-[#A6A5AB]" />
              </div>
              <p className="text-[22px] font-semibold text-[#17161A] tracking-tight">
                {formatNumber(Math.max(target.goal - target.current, 0))}
              </p>
              <p className="text-[10px] text-[#A6A5AB] font-mono mt-0.5">слушателей</p>
            </div>

            <div className="bg-[#FAFAF9] rounded-[12px] p-4 border border-[#ECEAE5]">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-medium text-[#6E6D73]">Стримы за квартал</p>
                <Disc3 className="w-3.5 h-3.5 text-[#A6A5AB]" />
              </div>
              <p className="text-[22px] font-semibold text-[#17161A] tracking-tight">
                {(artist.quarterlyStreams / 1000000).toFixed(1)}M
              </p>
              <p className="text-[10px] text-[#1F9D6B] font-medium mt-0.5">▲ +14% динамика</p>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

"use client";

import { useApp } from "@/components/providers/AppProvider";
import ProgressRing from "@/components/shared/ProgressRing";
import { motion } from "framer-motion";

export default function DopamineTarget() {
  const { state } = useApp();
  const target = state.targets.find((t) => t.artistId === state.currentArtistId);
  const artist = state.artists.find((a) => a.id === state.currentArtistId);

  if (!target || !artist) return null;

  const progress = Math.min(target.current / target.goal, 1);
  const isComplete = progress >= 1;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-navy/30 border border-navy rounded-xl p-8"
    >
      <div className="flex items-start justify-between mb-7">
        <div>
          <p className="text-[9px] tracking-[0.25em] uppercase text-alabaster-dim mb-2">
            Целевой показатель
          </p>
          <h2 className="text-lg font-semibold text-alabaster">{artist.name}</h2>
        </div>
        {isComplete && (
          <span className="px-3 py-1.5 bg-success/20 text-success text-[9px] tracking-widest uppercase rounded-full border border-success/30">
            Цель достигнута
          </span>
        )}
      </div>

      <div className="flex flex-col md:flex-row items-center gap-10">
        <ProgressRing
          current={target.current}
          goal={target.goal}
          label={target.metric}
          size={200}
        />

        <div className="flex-1 space-y-5 w-full">
          <div>
            <div className="flex justify-between text-xs text-alabaster-dim mb-2.5">
              <span>Прогресс</span>
              <span className="text-brass font-semibold">{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-1.5 bg-navy rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-brass rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-sapphire/60 rounded-lg p-4 border border-navy/50">
              <p className="text-[9px] tracking-widest uppercase text-alabaster-dim mb-2">Осталось</p>
              <p className="text-xl font-bold text-alabaster">
                {((target.goal - target.current) / 1000).toFixed(0)}k
              </p>
            </div>
            <div className="bg-sapphire/60 rounded-lg p-4 border border-navy/50">
              <p className="text-[9px] tracking-widest uppercase text-alabaster-dim mb-2">Стримы за квартал</p>
              <p className="text-xl font-bold text-alabaster">
                {(artist.quarterlyStreams / 1000000).toFixed(1)}M
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";
import { useState } from "react";

export default function TargetManagement() {
  const { state, dispatch } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleSave = (artistId: string) => {
    const goal = Number(editValue);
    if (goal > 0) dispatch({ type: "SET_TARGET", payload: { artistId, goal } });
    setEditingId(null);
    setEditValue("");
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return n.toString();
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-navy/30 border border-navy rounded-xl p-7"
    >
      <h3 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-alabaster mb-6">
        Управление целями
      </h3>

      <div className="space-y-4">
        {state.targets.map((target) => {
          const artist = state.artists.find((a) => a.id === target.artistId);
          if (!artist) return null;
          const progress = Math.min(target.current / target.goal, 1);
          const isEditing = editingId === target.artistId;

          return (
            <div key={target.artistId} className="bg-sapphire/40 rounded-lg p-5 border border-navy/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-full bg-navy flex items-center justify-center text-xs font-bold text-alabaster flex-shrink-0">
                  {artist.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-alabaster mb-1">{artist.name}</p>
                  <p className="text-[9px] text-alabaster-dim">
                    {formatNumber(target.current)} / {formatNumber(target.goal)} слушателей
                  </p>
                </div>
                <span className="text-xs font-bold text-brass flex-shrink-0">
                  {Math.round(progress * 100)}%
                </span>
              </div>

              <div className="h-1 bg-navy rounded-full overflow-hidden mb-3">
                <motion.div
                  className="h-full bg-brass rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>

              {isEditing ? (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="Новая цель"
                    autoFocus
                    className="flex-1 bg-sapphire border border-navy rounded px-3 py-1.5 text-xs text-alabaster focus:outline-none focus:border-brass/50 transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave(target.artistId);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <button
                    onClick={() => handleSave(target.artistId)}
                    className="px-3 py-1.5 bg-brass text-sapphire text-xs font-semibold rounded hover:bg-brass-dim transition-colors cursor-pointer"
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-2.5 py-1.5 bg-navy text-alabaster-dim text-xs rounded hover:text-alabaster transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingId(target.artistId); setEditValue(target.goal.toString()); }}
                  className="text-[9px] tracking-widest uppercase text-brass hover:text-brass-dim transition-colors cursor-pointer"
                >
                  Изменить цель →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}

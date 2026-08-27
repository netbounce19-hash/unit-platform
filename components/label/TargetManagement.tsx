"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";
import { useState } from "react";
import { Target, Check } from "lucide-react";

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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#6E6D73]" strokeWidth={2} />
            <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[#17161A]">
              Цели по слушателям
            </h3>
          </div>
          <span className="text-[11px] font-medium text-[#6E6D73] bg-[#FAFAF9] border border-[#ECEAE5] px-2 py-0.5 rounded-full">
            Таргеты Q3
          </span>
        </div>

        <div className="space-y-3.5">
          {state.targets.map((target) => {
            const artist = state.artists.find((a) => a.id === target.artistId);
            if (!artist) return null;
            const progress = Math.min(target.current / target.goal, 1);
            const isEditing = editingId === target.artistId;

            return (
              <div
                key={target.artistId}
                className="bg-[#FAFAF9] rounded-[12px] p-4 border-[0.5px] border-[#ECEAE5] transition hover:border-[#D2D0CB]"
              >
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#17161A] text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                    {artist.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium text-[#17161A] leading-tight">
                      {artist.name}
                    </p>
                    <p className="text-[11px] text-[#A6A5AB] mt-0.5">
                      {formatNumber(target.current)} из {formatNumber(target.goal)}
                    </p>
                  </div>
                  <span
                    className={`text-[12px] font-semibold tabular-nums shrink-0 ${
                      progress >= 0.8 ? "text-[#1F9D6B]" : "text-[#17161A]"
                    }`}
                  >
                    {Math.round(progress * 100)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-[#ECEAE5] rounded-full overflow-hidden mb-2.5">
                  <motion.div
                    className={`h-full rounded-full ${
                      progress >= 0.8 ? "bg-[#1F9D6B]" : "bg-[#17161A]"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>

                {isEditing ? (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Новая цель"
                      autoFocus
                      className="flex-1 bg-white border border-[#E5E3DE] rounded-[12px] px-2.5 py-1 text-[12px] text-[#17161A] outline-none focus:border-[#17161A]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave(target.artistId);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <button
                      onClick={() => handleSave(target.artistId)}
                      className="px-2.5 py-1 bg-[#17161A] text-white text-[11px] font-medium rounded-full hover:bg-[#2A292E] transition"
                    >
                      Сохранить
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1 text-[#6E6D73] text-[11px] hover:text-[#17161A]"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setEditingId(target.artistId);
                        setEditValue(target.goal.toString());
                      }}
                      className="text-[11px] font-medium text-[#6E6D73] hover:text-[#17161A] transition cursor-pointer"
                    >
                      Изменить цель →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}

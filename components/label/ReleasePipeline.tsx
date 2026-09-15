"use client";

import { useApp, Release } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";
import { useState } from "react";
import { Disc3, Clock, AlertCircle, GripVertical } from "lucide-react";

const COLUMNS: { key: Release["status"]; label: string; tag: string }[] = [
  { key: "demos", label: "Демо", tag: "RAW" },
  { key: "production", label: "Продакшн", tag: "PROD" },
  { key: "promo", label: "Промо", tag: "PR" },
  { key: "released", label: "Выпущено", tag: "LIVE" },
];

export default function ReleasePipeline() {
  const { state, dispatch } = useApp();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const getArtistName = (id: string) =>
    state.artists.find((a) => a.id === id)?.name || "—";

  const getDaysUntil = (deadline: string) =>
    Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const handleDragStart = (e: React.DragEvent, releaseId: string) => {
    setDraggedId(releaseId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    setDragOverCol(colKey);
  };

  const handleDrop = (e: React.DragEvent, newStatus: Release["status"]) => {
    e.preventDefault();
    setDragOverCol(null);
    if (draggedId) {
      dispatch({ type: "MOVE_RELEASE", payload: { id: draggedId, status: newStatus } });
      setDraggedId(null);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 lg:p-7"
    >
      <div className="flex items-center justify-between mb-5 pb-3 border-b-[0.5px] border-[#ECEAE5]">
        <div className="flex items-center gap-2">
          <Disc3 className="w-4 h-4 text-[#17161A]" />
          <h3 className="text-[14px] font-semibold text-[#17161A] tracking-tight">
            Пайплайн релизов
          </h3>
        </div>
        <span className="text-[10px] font-mono tracking-wider text-[#A6A5AB] uppercase">
          [KANBAN BOARD]
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMNS.map((col) => {
          const releases = state.releases.filter((r) => r.status === col.key);
          const isOver = dragOverCol === col.key;

          return (
            <div
              key={col.key}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => handleDrop(e, col.key)}
              className={`
                rounded-[12px] p-3 transition-all duration-200 min-h-[220px] flex flex-col justify-between
                ${isOver
                  ? "bg-[#F0EEEA] border-2 border-dashed border-[#17161A]"
                  : "bg-[#FAFAF9] border border-[#ECEAE5]"
                }
              `}
            >
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#ECEAE5]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-semibold tracking-wider text-[#17161A] uppercase">
                      {col.label}
                    </span>
                    <span className="text-[9px] font-mono text-[#A6A5AB]">
                      [{col.tag}]
                    </span>
                  </div>
                  <span className="w-5 h-5 rounded-full bg-white border border-[#ECEAE5] flex items-center justify-center text-[11px] font-mono text-[#6E6D73]">
                    {releases.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {releases.map((release) => {
                    const daysLeft = getDaysUntil(release.deadline);
                    const isUrgent = daysLeft <= 5 && col.key !== "released";

                    return (
                      <motion.div
                        key={release.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, release.id)}
                        layout
                        className={`
                          p-3 rounded-[10px] border cursor-grab active:cursor-grabbing
                          transition-all duration-200 group
                          ${draggedId === release.id
                            ? "opacity-40 border-[#17161A]"
                            : "bg-white border-[#ECEAE5] hover:border-[#D2D0CB] hover:shadow-xs"
                          }
                        `}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <p className="text-[13px] font-semibold text-[#17161A] truncate">
                            {release.title}
                          </p>
                          <GripVertical className="w-3 h-3 text-[#A6A5AB] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#FAFAF9]">
                          <span className="text-[11px] font-medium text-[#6E6D73]">
                            {getArtistName(release.artistId)}
                          </span>
                          {col.key !== "released" && (
                            <span className={`text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-full ${
                              isUrgent
                                ? "bg-[#F0EEEA] text-[#17161A] border border-[#D2D0CB] font-semibold"
                                : "bg-[#F0EEEA] text-[#6E6D73]"
                            }`}>
                              {daysLeft <= 0 ? "! СРОК" : `${daysLeft}Д`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#A6A5AB] mt-1.5">
                          <span>{release.genre}</span>
                          {col.key === "released" && (
                            <span className="text-[#1F9D6B] font-medium">✓ РЕЛИЗ</span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                  {releases.length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-[11px] font-mono text-[#A6A5AB] uppercase">Нет треков</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}

"use client";

import { useApp, Release } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";
import { useState } from "react";

const COLUMNS: { key: Release["status"]; label: string }[] = [
  { key: "demos", label: "Демо" },
  { key: "production", label: "Продакшн" },
  { key: "promo", label: "Промо" },
  { key: "released", label: "Выпущено" },
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
      transition={{ duration: 0.5, delay: 0.1 }}
      className="bg-navy/30 border border-navy rounded-xl p-6"
    >
      <h3 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-alabaster mb-5">
        Пайплайн релизов
      </h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                kanban-column rounded-lg p-3 transition-all duration-200
                ${isOver
                  ? "bg-brass/10 border-2 border-dashed border-brass/50"
                  : "bg-sapphire/30 border border-navy/50"
                }
              `}
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-navy/30">
                <span className="text-[9px] tracking-[0.2em] uppercase text-alabaster-dim font-medium">
                  {col.label}
                </span>
                <span className="w-4 h-4 rounded-full bg-navy/60 flex items-center justify-center text-[9px] text-alabaster-dim">
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
                        p-3 rounded-lg border cursor-grab active:cursor-grabbing
                        transition-all duration-200
                        ${draggedId === release.id
                          ? "opacity-40 border-brass"
                          : "bg-navy/40 border-navy/30 hover:border-navy/70"
                        }
                      `}
                    >
                      <p className="text-xs font-medium text-alabaster mb-1.5 truncate">
                        {release.title}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-alabaster-dim">
                          {getArtistName(release.artistId)}
                        </span>
                        {col.key !== "released" && (
                          <span className={`text-[9px] tracking-wider px-1.5 py-0.5 rounded ${
                            isUrgent ? "bg-error/20 text-[#d4564a]" : "bg-navy/30 text-alabaster-dim"
                          }`}>
                            {daysLeft <= 0 ? "Просрочено" : `${daysLeft}д`}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-alabaster-dim/40 mt-1 block">{release.genre}</span>
                    </motion.div>
                  );
                })}
                {releases.length === 0 && (
                  <div className="py-6 text-center">
                    <p className="text-[9px] text-alabaster-dim/25 tracking-wider uppercase">Пусто</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}

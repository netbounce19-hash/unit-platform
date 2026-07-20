"use client";

import { ReactNode, useState } from "react";
import { motion, PanInfo } from "framer-motion";
import { Trash2 } from "lucide-react";

interface SwipeToDeleteProps {
  children: ReactNode;
  onDelete: () => void;
  /** подпись для скринридера */
  label?: string;
}

const REVEAL = 96; // насколько открывается кнопка удаления
const THRESHOLD = 72; // порог срабатывания

export default function SwipeToDelete({
  children,
  onDelete,
  label = "Удалить",
}: SwipeToDeleteProps) {
  const [open, setOpen] = useState(false);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    // быстрый свайп влево или заметное смещение — удаляем
    if (info.offset.x < -THRESHOLD * 2 || info.velocity.x < -700) {
      onDelete();
      return;
    }
    setOpen(info.offset.x < -THRESHOLD / 2);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Подложка с удалением */}
      <div className="absolute inset-y-0 right-0 w-[96px] flex items-center justify-center bg-[#FDEDEB]">
        <button
          onClick={onDelete}
          aria-label={label}
          className="inline-flex flex-col items-center gap-[2px] text-[#A62018]"
        >
          <Trash2 className="w-[18px] h-[18px]" strokeWidth={1.75} />
          <span className="text-[11px] font-medium">Удалить</span>
        </button>
      </div>

      {/* Содержимое */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -REVEAL, right: 0 }}
        dragElastic={0.08}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        animate={{ x: open ? -REVEAL : 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 400 }}
        className="relative bg-white select-none touch-pan-y cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
}

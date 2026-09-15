"use client";

import { useState, useCallback, DragEvent } from "react";
import { motion } from "framer-motion";
import { DownloadDoneIconControlled } from "@/components/ui/animated-state-icons";

interface FileDropZoneProps {
  label: string;
  accept?: string;
  icon: React.ReactNode;
  onFileDrop: (file: File) => void;
  compact?: boolean;
}

export default function FileDropZone({
  label,
  accept,
  icon,
  onFileDrop,
  compact = false,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [droppedFile, setDroppedFile] = useState<string | null>(null);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        setDroppedFile(file.name);
        onFileDrop(file);
      }
    },
    [onFileDrop]
  );

  const handleClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    if (accept) input.accept = accept;
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setDroppedFile(file.name);
        onFileDrop(file);
      }
    };
    input.click();
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        relative border border-dashed rounded-[12px] cursor-pointer
        transition-all duration-200 group
        ${isDragging
          ? "border-[#17161A] bg-[#F0EEEA]"
          : "border-[#D2D0CB] hover:border-[#17161A] bg-[#FAFAF9] hover:bg-white"
        }
        ${compact ? "p-3.5" : "p-5"}
      `}
    >
      <div className={`flex ${compact ? "flex-row items-center gap-3" : "flex-col items-center gap-2.5"}`}>
        <div className={`text-[#6E6D73] group-hover:text-[#17161A] transition-colors ${isDragging ? "text-[#17161A]" : ""}`}>
          {icon}
        </div>
        <div className={compact ? "" : "text-center"}>
          <p className="text-[12px] font-medium text-[#17161A]">
            {label}
          </p>
          {droppedFile ? (
            <div className="flex items-center gap-1.5 mt-1">
              <DownloadDoneIconControlled
                size={14}
                color="#1F9D6B"
                done={true}
              />
              <p className="text-[11px] text-[#1F9D6B] font-mono truncate max-w-[150px]">{droppedFile}</p>
            </div>
          ) : (
            <p className="text-[10px] text-[#A6A5AB] mt-0.5">
              Нажмите или перетащите
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

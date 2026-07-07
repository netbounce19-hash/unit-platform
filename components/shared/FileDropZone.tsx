"use client";

import { useState, useCallback, DragEvent } from "react";
import { motion } from "framer-motion";

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
        relative border-2 border-dashed rounded-lg cursor-pointer
        transition-all duration-300 group
        ${isDragging
          ? "border-brass bg-brass/5"
          : "border-navy hover:border-brass/50"
        }
        ${compact ? "p-4" : "p-6"}
      `}
    >
      <div className={`flex ${compact ? "flex-row items-center gap-3" : "flex-col items-center gap-3"}`}>
        <div className={`text-alabaster-dim group-hover:text-brass transition-colors ${isDragging ? "text-brass" : ""}`}>
          {icon}
        </div>
        <div className={compact ? "" : "text-center"}>
          <p className="text-xs font-medium tracking-widest uppercase text-alabaster-dim">
            {label}
          </p>
          {droppedFile ? (
            <p className="text-xs text-brass mt-1 truncate max-w-[200px]">
              ✓ {droppedFile}
            </p>
          ) : (
            <p className="text-[10px] text-alabaster-dim/50 mt-1">
              Drop file or click
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

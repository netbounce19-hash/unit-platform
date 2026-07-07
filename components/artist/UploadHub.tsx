"use client";

import { useApp } from "@/components/providers/AppProvider";
import FileDropZone from "@/components/shared/FileDropZone";
import { motion } from "framer-motion";
import { useState } from "react";

export default function UploadHub() {
  const { state, dispatch } = useApp();
  const [depositionHash, setDepositionHash] = useState<{
    hash: string;
    timestamp: string;
    fileName: string;
  } | null>(null);

  const artistUploads = state.uploads.filter(
    (u) => u.artistId === state.currentArtistId
  );

  const generateHash = () => {
    const chars = "0123456789abcdef";
    let hash = "";
    for (let i = 0; i < 64; i++) hash += chars[Math.floor(Math.random() * 16)];
    return hash;
  };

  const handleUpload = (file: File, type: "demo" | "master" | "cover" | "lyric") => {
    const upload = {
      artistId: state.currentArtistId,
      name: file.name,
      type,
      uploadedAt: new Date().toISOString(),
      size: `${(file.size / (1024 * 1024)).toFixed(1)} МБ`,
      depositionHash: type === "lyric" ? `sha256:${generateHash()}` : undefined,
    };
    dispatch({ type: "ADD_UPLOAD", payload: upload });
    if (type === "lyric") {
      setDepositionHash({
        hash: upload.depositionHash!,
        timestamp: new Date().toISOString(),
        fileName: file.name,
      });
    }
  };

  const icons = {
    demo: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
      </svg>
    ),
    master: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="6" width="20" height="12" rx="2" /><path d="M12 6v12M7 12h10" />
      </svg>
    ),
    cover: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
      </svg>
    ),
    lyric: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" />
      </svg>
    ),
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-navy/30 border border-navy rounded-xl p-7"
    >
      <h3 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-alabaster mb-6">
        Загрузки
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <FileDropZone label="Демо" accept="audio/*" icon={icons.demo} onFileDrop={(f) => handleUpload(f, "demo")} />
        <FileDropZone label="Мастер" accept="audio/*" icon={icons.master} onFileDrop={(f) => handleUpload(f, "master")} />
        <FileDropZone label="Обложка" accept="image/*" icon={icons.cover} onFileDrop={(f) => handleUpload(f, "cover")} />
        <FileDropZone label="Тексты" accept=".txt,.pdf,.doc,.docx" icon={icons.lyric} onFileDrop={(f) => handleUpload(f, "lyric")} />
      </div>

      {depositionHash && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 bg-sapphire border border-brass/30 rounded-lg p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-brass animate-pulse-brass" />
            <p className="text-[9px] tracking-[0.25em] uppercase text-brass font-semibold">
              Хэш депонирования — Доказательство авторства
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[9px] tracking-widest uppercase text-alabaster-dim mb-1">Файл</p>
              <p className="text-xs text-alabaster font-mono truncate">{depositionHash.fileName}</p>
            </div>
            <div>
              <p className="text-[9px] tracking-widest uppercase text-alabaster-dim mb-1">Хэш</p>
              <p className="text-[10px] text-brass font-mono break-all leading-relaxed">{depositionHash.hash}</p>
            </div>
            <div>
              <p className="text-[9px] tracking-widest uppercase text-alabaster-dim mb-1">Время</p>
              <p className="text-xs text-alabaster font-mono">{new Date(depositionHash.timestamp).toISOString()}</p>
            </div>
          </div>
        </motion.div>
      )}

      {artistUploads.length > 0 && (
        <div className="mt-5 pt-5 border-t border-navy/40">
          <p className="text-[9px] tracking-widest uppercase text-alabaster-dim mb-3">
            Последние загрузки
          </p>
          <div className="space-y-2.5">
            {artistUploads.slice(-3).reverse().map((upload) => (
              <div key={upload.id} className="flex items-center justify-between text-xs bg-sapphire/40 rounded-lg px-4 py-3">
                <span className="text-alabaster truncate">{upload.name}</span>
                <span className="text-alabaster-dim flex-shrink-0 ml-3">{upload.size}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}

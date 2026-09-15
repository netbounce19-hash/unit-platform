"use client";

import { useApp } from "@/components/providers/AppProvider";
import FileDropZone from "@/components/shared/FileDropZone";
import { motion } from "framer-motion";
import { useState } from "react";
import { UploadCloud, Music, Disc, Image as ImageIcon, FileCheck, ShieldCheck, Clock } from "lucide-react";

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
    demo: <Music className="w-5 h-5 text-[#17161A]" />,
    master: <Disc className="w-5 h-5 text-[#17161A]" />,
    cover: <ImageIcon className="w-5 h-5 text-[#6E6D73]" />,
    lyric: <FileCheck className="w-5 h-5 text-[#1F9D6B]" />,
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 lg:p-7 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-5 pb-3 border-b-[0.5px] border-[#ECEAE5]">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-[#17161A]" />
            <h3 className="text-[14px] font-semibold text-[#17161A] tracking-tight">
              Загрузка материалов
            </h3>
          </div>
          <span className="text-[10px] font-mono tracking-wider text-[#A6A5AB] uppercase">
            [STUDIO INTAKE]
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FileDropZone label="Демо-запись" accept="audio/*" icon={icons.demo} onFileDrop={(f) => handleUpload(f, "demo")} />
          <FileDropZone label="Мастер (WAV)" accept="audio/*" icon={icons.master} onFileDrop={(f) => handleUpload(f, "master")} />
          <FileDropZone label="Обложка (3000px)" accept="image/*" icon={icons.cover} onFileDrop={(f) => handleUpload(f, "cover")} />
          <FileDropZone label="Текст / Права" accept=".txt,.pdf,.doc,.docx" icon={icons.lyric} onFileDrop={(f) => handleUpload(f, "lyric")} />
        </div>

        {depositionHash && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 bg-[#F7F6F3] border border-[#ECEAE5] rounded-[12px] p-4"
          >
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#ECEAE5]">
              <ShieldCheck className="w-4 h-4 text-[#1F9D6B]" />
              <p className="text-[11px] font-mono tracking-wider uppercase text-[#17161A] font-medium">
                Депонирование авторского права
              </p>
            </div>
            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-[#A6A5AB]">Файл:</span>
                <span className="text-[#17161A] truncate max-w-[220px]">{depositionHash.fileName}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[#A6A5AB] text-[10px]">ХЭШ SHA-256:</span>
                <span className="text-[#17161A] text-[10px] break-all leading-tight">{depositionHash.hash}</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {artistUploads.length > 0 && (
        <div className="mt-5 pt-4 border-t border-[#ECEAE5]">
          <p className="text-[11px] font-mono tracking-wider uppercase text-[#6E6D73] mb-2.5">
            Последние файлы
          </p>
          <div className="space-y-1.5">
            {artistUploads.slice(-3).reverse().map((upload) => (
              <div key={upload.id} className="flex items-center justify-between text-xs bg-[#FAFAF9] border border-[#ECEAE5] rounded-[12px] px-3.5 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#17161A]" />
                  <span className="text-[12px] font-medium text-[#17161A] truncate">{upload.name}</span>
                </div>
                <span className="text-[11px] font-mono text-[#A6A5AB] flex-shrink-0 ml-2">{upload.size}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}

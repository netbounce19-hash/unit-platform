"use client";

import Link from "next/link";
import { ArrowLeft, Plus, Trash2, ImagePlus, RefreshCw, Disc3, Music } from "lucide-react";
import { useDemos } from "@/components/artist/DemoContext";

// Открывает системный выбор файла и резолвит выбранный File
function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export default function DemoEditPage() {
  const { demos, addDemo, removeDemo, replaceAudio, setImage, updateTitle } = useDemos();

  const onUpload = async () => {
    const file = await pickFile("audio/*,.wav,.mp3,.flac,.aiff");
    if (file) addDemo(file);
  };

  const onReplaceAudio = async (id: string) => {
    const file = await pickFile("audio/*,.wav,.mp3,.flac,.aiff");
    if (file) replaceAudio(id, file);
  };

  const onSetImage = async (id: string) => {
    const file = await pickFile("image/jpeg,image/png,.jpg,.jpeg,.png,.webp");
    if (file) setImage(id, file);
  };

  return (
    <div className="max-w-[720px] mx-auto px-5 py-7">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-[6px] text-[13px] text-[#6E6D73] hover:text-[#17161A] transition mb-5"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        К дашборду
      </Link>

      <div className="mb-5">
        <div className="text-[12px] text-[#A6A5AB]">ДЕМО</div>
        <div className="text-[22px] font-semibold tracking-[-0.01em]">Управление демо</div>
        <div className="text-[14px] text-[#6E6D73] mt-[3px]">
          Загружайте, заменяйте и удаляйте черновики, добавляйте обложки
        </div>
      </div>

      {/* Загрузить демо */}
      <button
        onClick={onUpload}
        className="w-full mb-5 flex items-center justify-center gap-3 rounded-[16px] border border-dashed border-[#D2D0CB] bg-white px-5 py-[20px] hover:border-[#E23A34] hover:bg-[#FDEDEB]/50 transition"
      >
        <span className="w-11 h-11 rounded-full bg-[#E23A34] text-white flex items-center justify-center shrink-0">
          <Plus className="w-6 h-6" strokeWidth={2.5} />
        </span>
        <span className="text-left">
          <span className="block text-[15px] font-medium">Загрузить демо</span>
          <span className="block text-[12px] text-[#A6A5AB]">WAV, MP3 или FLAC</span>
        </span>
      </button>

      {/* Список демо */}
      {demos.length === 0 ? (
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] py-10 text-center text-[13px] text-[#A6A5AB]">
          Пока нет ни одного демо
        </div>
      ) : (
        <div className="space-y-3">
          {demos.map((d) => (
            <div
              key={d.id}
              className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-3 flex items-center gap-3"
            >
              {/* Обложка */}
              <button
                onClick={() => onSetImage(d.id)}
                aria-label={d.image ? "Заменить обложку" : "Добавить обложку"}
                className="relative w-16 h-16 rounded-[12px] shrink-0 overflow-hidden flex items-center justify-center group"
                style={{ background: d.gradient }}
              >
                {d.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.image} alt={d.title} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <Disc3 className="w-6 h-6 text-white/70" strokeWidth={1.5} />
                )}
                <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <ImagePlus className="w-5 h-5 text-white" strokeWidth={1.75} />
                </span>
              </button>

              {/* Название + аудио */}
              <div className="min-w-0 flex-1">
                <input
                  value={d.title}
                  onChange={(e) => updateTitle(d.id, e.target.value)}
                  placeholder="Название демо"
                  className="w-full text-[14px] font-medium rounded-[8px] border border-transparent hover:border-[#E5E3DE] focus:border-[#E23A34] bg-transparent px-2 py-[6px] -ml-2 outline-none transition placeholder:text-[#C4C3C8]"
                />
                <div className="flex items-center gap-[5px] text-[12px] text-[#A6A5AB] mt-[2px] px-[2px]">
                  <Music className="w-[12px] h-[12px]" strokeWidth={1.75} />
                  <span className="truncate">{d.src.split("/").pop()}</span>
                </div>
              </div>

              {/* Действия */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onReplaceAudio(d.id)}
                  aria-label="Заменить аудио"
                  title="Заменить аудио"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition"
                >
                  <RefreshCw className="w-[17px] h-[17px]" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => removeDemo(d.id)}
                  aria-label="Удалить демо"
                  title="Удалить"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#A6A5AB] hover:text-[#A62018] hover:bg-[#FDEDEB] transition"
                >
                  <Trash2 className="w-[17px] h-[17px]" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

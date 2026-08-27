"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import ReleaseCarousel from "@/components/artist/ReleaseCarousel";
import ReleaseUploadModal from "@/components/artist/ReleaseUploadModal";

export default function ReleasesPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [version, setVersion] = useState(0);

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="text-[22px] font-medium tracking-[-0.01em]">Релизы</div>
          <div className="text-[14px] text-[#6E6D73] mt-[3px]">Готовящиеся и вышедшие</div>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="shrink-0 inline-flex items-center gap-[6px] bg-[#E23A34] text-white font-medium text-[13px] px-[14px] py-[8px] rounded-full hover:brightness-95 transition mt-1"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Добавить релиз
        </button>
      </div>

      <ReleaseCarousel refreshKey={version} />

      <ReleaseUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        releaseTitle="Новый релиз"
        onSubmit={() => setVersion((v) => v + 1)}
      />
    </>
  );
}

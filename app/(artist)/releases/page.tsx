"use client";

import { useState } from "react";
import AddButton from "@/components/ui/AddButton";
import ReleaseCarousel from "@/components/artist/ReleaseCarousel";
import ReleaseUploadModal from "@/components/artist/ReleaseUploadModal";

export default function ReleasesPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [version, setVersion] = useState(0);

  return (
    <>
      {/* Действие отдельной строкой: рядом с заголовком оно на 375px
          заставляло подзаголовок переноситься */}
      <div className="mb-4">
        <div className="text-[22px] font-medium tracking-[-0.01em]">Релизы</div>
        <div className="text-[14px] text-[#6E6D73] mt-[3px]">Готовящиеся и вышедшие</div>
        <AddButton
          label="Добавить релиз"
          onClick={() => setUploadOpen(true)}
          className="mt-3"
        />
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

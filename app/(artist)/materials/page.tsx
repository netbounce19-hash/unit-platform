"use client";

import { useState } from "react";
import type { AssetKind } from "@/lib/supabase/uploads";
import AddButton from "@/components/ui/AddButton";
import DemoSection from "@/components/artist/DemoSection";
import AssetManager from "@/components/artist/AssetManager";

/**
 * Все материалы артиста в одном месте. Раньше это были две отдельные
 * секции на дашборде — «Демо» и «Файлы артиста», причём вторая прятала
 * три типа файлов за собственным переключателем. Теперь один уровень вкладок.
 */
type Tab = { key: string; label: string; kind?: AssetKind };

const TABS: Tab[] = [
  { key: "demo", label: "Демо" },
  { key: "masters", label: "Мастера", kind: "audio" },
  { key: "covers", label: "Обложки", kind: "photo" },
  { key: "docs", label: "Документы", kind: "document" },
];

export default function MaterialsPage() {
  const [tab, setTab] = useState<Tab>(TABS[0]);

  return (
    <>
      <div className="mb-4">
        <div className="text-[22px] font-medium tracking-[-0.01em]">Материалы</div>
        <div className="text-[14px] text-[#6E6D73] mt-[3px]">Демо, мастера, обложки и документы</div>
        {/* Демо заводятся на отдельном экране, остальное — загрузчиком ниже */}
        {!tab.kind && (
          <AddButton label="Добавить демо" href="/demo/edit" className="mt-3" />
        )}
      </div>

      <div className="flex items-center gap-[6px] mb-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t)}
            className={`shrink-0 text-[13px] font-medium rounded-full px-[14px] py-[8px] border transition ${
              tab.key === t.key
                ? "border-[#E23A34] bg-[#FDEDEB] text-[#A62018]"
                : "border-[#ECEAE5] bg-white text-[#6E6D73] hover:border-[#D2D0CB] hover:text-[#17161A]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab.kind ? (
        // key заставляет пересобрать состояние загрузчика при смене вкладки
        <AssetManager key={tab.kind} kind={tab.kind} hideTabs />
      ) : (
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] px-[22px] pt-[18px] pb-[14px]">
          <DemoSection bare />
        </div>
      )}
    </>
  );
}

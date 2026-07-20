"use client";

import { AlertTriangle } from "lucide-react";

/** Компактное напоминание от лейбла */
export default function LabelNotice() {
  return (
    <div className="flex items-start gap-[10px] rounded-[12px] border-[0.5px] border-[#F3C9C6] bg-[#FDEDEB] px-[14px] py-[11px] mb-4">
      <AlertTriangle
        className="w-[14px] h-[14px] text-[#A62018] shrink-0 mt-[2px]"
        strokeWidth={2.25}
      />
      <p className="text-[12px] leading-[1.45] text-[#6E6D73]">
        <span className="font-semibold text-[#A62018]">Важно.</span> Все треки
        отгружаются за 3 недели до даты релиза — учитывайте это при подготовке. Нужна
        срочная отгрузка — напишите менеджеру в мессенджере.
      </p>
    </div>
  );
}

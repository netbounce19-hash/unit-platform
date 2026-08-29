"use client";

import { TrendingUp, CheckCircle2, Zap, type LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Стримы: TrendingUp,
  Обязательность: CheckCircle2,
  Эффективность: Zap,
};

/**
 * Полоска одной метрики рейтинга с микро-иконкой и визуальным заполнением.
 * Значение всегда 0..100 — абсолютные стримы нормируются по лучшему в ростере.
 */
export default function ScoreMeter({
  label,
  value,
  display,
  accent = false,
  icon: CustomIcon,
}: {
  label: string;
  /** 0..100; null — метрику пока не по чему считать */
  value: number | null;
  /** что показать справа: «65k», «80%», «73» */
  display: string;
  /** выделить цветом — используется для эффективности */
  accent?: boolean;
  /** кастомная иконка при необходимости */
  icon?: LucideIcon;
}) {
  const width = value === null ? 0 : Math.max(0, Math.min(100, value));
  const Icon = CustomIcon || ICON_MAP[label];

  // Цветовая логика для полосы заполнения
  let barCls = "bg-[#C4C3C8] dark:bg-[#4A4952]";
  if (accent) {
    barCls = "bg-[#17161A] dark:bg-[#F5F4F2]";
  } else if (label === "Обязательность" && value !== null) {
    if (value >= 80) barCls = "bg-[#1F9D6B] dark:bg-[#5FCB9B]";
    else if (value >= 50) barCls = "bg-[#D97706] dark:bg-[#E8B65A]";
    else barCls = "bg-[#C4C3C8] dark:bg-[#4A4952]";
  }

  return (
    <div className="min-w-0 flex flex-col justify-between">
      {/* Метка с микро-иконкой */}
      <div className="flex items-center gap-1 text-[11px] text-[#A6A5AB] dark:text-[#6E6D73] truncate mb-[2px]">
        {Icon && <Icon className="w-[11px] h-[11px] shrink-0" strokeWidth={2} />}
        <span className="truncate">{label}</span>
      </div>

      {/* Значение */}
      <div
        className={`text-[13.5px] tabular-nums mb-[5px] flex items-baseline gap-1 ${
          accent
            ? "font-semibold text-[#17161A] dark:text-[#F5F4F2]"
            : "font-medium text-[#17161A] dark:text-[#F5F4F2]"
        }`}
      >
        <span>{display}</span>
      </div>

      {/* Дорожка шкалы */}
      <div className="h-[4px] w-full rounded-full bg-[#F0EEEA] dark:bg-[#242327] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barCls}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

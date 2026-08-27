"use client";

/**
 * Полоска одной метрики рейтинга. Значение всегда 0..100 — абсолютные
 * стримы нормируются по лучшему в ростере, иначе шкалы несопоставимы.
 */
export default function ScoreMeter({
  label,
  value,
  display,
  accent = false,
}: {
  label: string;
  /** 0..100; null — метрику пока не по чему считать */
  value: number | null;
  /** что показать справа: «65k», «80%», «73» */
  display: string;
  /** выделить цветом — используется для эффективности */
  accent?: boolean;
}) {
  const width = value === null ? 0 : Math.max(0, Math.min(100, value));

  return (
    <div className="min-w-0">
      {/* Подпись над значением, а не рядом: «Обязательность» не помещается
          в треть ширины телефона в одну строку со значением. */}
      <div className="text-[11px] text-[#A6A5AB] dark:text-[#6E6D73] truncate">{label}</div>
      <div
        className={`text-[13.5px] tabular-nums mb-[4px] ${
          accent
            ? "font-semibold text-[#17161A] dark:text-[#F5F4F2]"
            : "text-[#17161A] dark:text-[#F5F4F2]"
        }`}
      >
        {display}
      </div>
      <div className="h-[4px] rounded-full bg-[#F0EEEA] dark:bg-[#242327] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            accent ? "bg-[#17161A]" : "bg-[#C4C3C8] dark:bg-[#4A4952]"
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

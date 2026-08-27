"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

/**
 * Действие «добавить»: залитый круг с плюсом и подпись рядом.
 *
 * Форма взята из add-circle-fill, но собрана на нашем стеке — ставить
 * ради одной иконки отдельную дизайн-систему со своим CSS-ресетом значило
 * бы сломать шкалу радиусов и типографику кабинета.
 *
 * Круг здесь и есть кнопка, поэтому капсульной подложки под ним нет —
 * иначе получилось бы два вложенных affordance.
 */

const SIZES = {
  sm: { circle: "w-7 h-7", icon: "w-[15px] h-[15px]", label: "text-[13px]", gap: "gap-[8px]" },
  md: { circle: "w-8 h-8", icon: "w-[17px] h-[17px]", label: "text-[14px]", gap: "gap-[10px]" },
  lg: { circle: "w-10 h-10", icon: "w-[21px] h-[21px]", label: "text-[15px]", gap: "gap-3" },
} as const;

export type AddButtonSize = keyof typeof SIZES;

interface AddButtonProps {
  label: string;
  size?: AddButtonSize;
  /** Ссылка вместо обработчика — когда действие ведёт на отдельный экран. */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export default function AddButton({
  label,
  size = "md",
  href,
  onClick,
  disabled = false,
  className = "",
}: AddButtonProps) {
  const s = SIZES[size];

  const content = (
    <>
      <span
        className={`${s.circle} rounded-full bg-[#17161A] text-white flex items-center justify-center shrink-0 transition group-hover:bg-[#2A282E]`}
      >
        <Plus className={s.icon} strokeWidth={2.5} />
      </span>
      {/* Подпись цвет не меняет — на ховер отзывается круг */}
      <span className={`${s.label} font-medium text-[#17161A] dark:text-[#F5F4F2]`}>
        {label}
      </span>
    </>
  );

  const cls = `group inline-flex items-center ${s.gap} transition disabled:opacity-40 disabled:cursor-not-allowed ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {content}
    </button>
  );
}

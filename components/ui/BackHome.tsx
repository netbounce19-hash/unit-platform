"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";

/**
 * «Назад» и «На главную» для страниц, которых нет в нижней навигации.
 *
 * На корневых разделах не рисуется: там нижняя навигация и так показывает,
 * где ты находишься, а лишняя пара кнопок только съедала бы высоту экрана.
 */
export default function BackHome({
  homeHref,
  roots,
}: {
  homeHref: string;
  /** Разделы нижней навигации — на них контрол не нужен. */
  roots: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();

  if (roots.includes(pathname)) return null;

  const cls =
    "inline-flex items-center gap-[6px] text-[13px] font-medium rounded-full px-[14px] py-[8px] " +
    "text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#17161A] dark:hover:text-[#F5F4F2] " +
    "hover:bg-[#F0EEEA] dark:hover:bg-[#232227] transition";

  return (
    <div className="flex items-center gap-1 -ml-[14px] mb-3">
      <button
        type="button"
        onClick={() => {
          // Прямой заход по ссылке — истории нет, уводить из приложения нельзя
          if (typeof window !== "undefined" && window.history.length > 1) router.back();
          else router.push(homeHref);
        }}
        className={cls}
      >
        <ArrowLeft className="w-[15px] h-[15px]" strokeWidth={2} />
        Назад
      </button>
      <Link href={homeHref} className={cls}>
        <Home className="w-[15px] h-[15px]" strokeWidth={2} />
        На главную
      </Link>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Wallet,
  MessagesSquare,
  BarChart3,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

/**
 * Нижняя навигация кабинета лейбла — как в кабинете артиста.
 * Разделов восемь, в панель влезает пять: четыре рабочих плюс «Ещё»,
 * куда уходят загрузка данных, приглашения, настройки и поддержка.
 */
const ITEMS: { href: string; label: string; icon: LucideIcon; match: string[] }[] = [
  { href: "/label/roster", label: "Ростер", icon: Users, match: ["/label/roster", "/label/artists"] },
  { href: "/label/budgets", label: "Заявки", icon: Wallet, match: ["/label/budgets"] },
  { href: "/label/messages", label: "Чаты", icon: MessagesSquare, match: ["/label/messages"] },
  { href: "/label/stats", label: "Статистика", icon: BarChart3, match: ["/label/stats"] },
  {
    href: "/label/more",
    label: "Ещё",
    icon: MoreHorizontal,
    match: ["/label/more", "/label/data-upload", "/label/invites", "/label/promo", "/label/settings", "/label/support"],
  },
];

export default function LabelNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1A191D]/95 backdrop-blur-sm border-t-[0.5px] border-[#ECEAE5] dark:border-[#242327]">
      <div className="max-w-[720px] mx-auto px-2 flex items-stretch">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.match.some(
            (m) => pathname === m || pathname.startsWith(m + "/")
          );
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 flex flex-col items-center gap-[3px] py-[9px] rounded-full transition ${
                active
                  ? "text-[#17161A] dark:text-[#F5F4F2]"
                  : "text-[#A6A5AB] dark:text-[#6E6D73] hover:text-[#6E6D73] dark:hover:text-[#9A98A0]"
              }`}
            >
              <Icon className="w-[19px] h-[19px]" strokeWidth={active ? 2 : 1.75} />
              <span className={`text-[11px] ${active ? "font-medium" : ""}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

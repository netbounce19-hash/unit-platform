"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FolderOpen, Disc3, Wallet, User, type LucideIcon } from "lucide-react";

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Сегодня", icon: Home },
  { href: "/materials", label: "Материалы", icon: FolderOpen },
  { href: "/releases", label: "Релизы", icon: Disc3 },
  { href: "/finance", label: "Финансы", icon: Wallet },
  { href: "/profile", label: "Профиль", icon: User },
];

/**
 * Нижняя навигация кабинета артиста — единственный способ переключать
 * разделы. Раньше на дашборде были чипсы-якоря, но после разнесения
 * секций по роутам якоря стали бессмысленны.
 */
export default function ArtistNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t-[0.5px] border-[#ECEAE5]">
      <div className="max-w-[720px] mx-auto px-2 flex items-stretch">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 flex flex-col items-center gap-[3px] py-[9px] rounded-full transition ${
                active ? "text-[#17161A]" : "text-[#A6A5AB] hover:text-[#6E6D73]"
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  FolderOpen,
  Disc3,
  Wallet,
  Target,
  User,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { fetchMyProfile, displayNameOf } from "@/lib/supabase/profile";

type Item = { href: string; label: string; icon: LucideIcon };

/**
 * Боковая навигация кабинета артиста на десктопе. Те же разделы, что в
 * нижней панели, плюс стратегия — на телефоне до неё добираются с плитки
 * на дашборде, а здесь места хватает, чтобы держать её под рукой.
 */
const ITEMS: Item[] = [
  { href: "/dashboard", label: "Сегодня", icon: Home },
  { href: "/materials", label: "Материалы", icon: FolderOpen },
  { href: "/releases", label: "Релизы", icon: Disc3 },
  { href: "/finance", label: "Финансы", icon: Wallet },
  { href: "/strategy", label: "Стратегия", icon: Target },
];

const PROFILE: Item = { href: "/profile", label: "Профиль", icon: User };

function NavItem({ item, pathname }: { item: Item; pathname: string }) {
  const Icon = item.icon;
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-[10px] text-[13.5px] rounded-full px-[14px] py-[8px] transition ${
        active
          ? "bg-[#F0EEEA] text-[#17161A] font-medium"
          : "text-[#6E6D73] hover:bg-[#FAFAF9] hover:text-[#17161A]"
      }`}
    >
      <Icon className="w-[17px] h-[17px] shrink-0" strokeWidth={active ? 2 : 1.75} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export default function ArtistSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState("Артист");

  useEffect(() => {
    let cancelled = false;
    fetchMyProfile()
      .then((p) => {
        if (!cancelled && p) setName(displayNameOf(p));
      })
      .catch(() => {
        /* профиль недоступен — оставляем значение по умолчанию */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="hidden lg:flex flex-col w-[248px] shrink-0 h-screen sticky top-0 bg-white border-r-[0.5px] border-[#ECEAE5]">
      <div className="px-5 pt-6 pb-5 border-b-[0.5px] border-[#ECEAE5]">
        <Link href="/dashboard" className="font-semibold tracking-[0.16em] text-[17px] text-[#17161A]">
          UNIT
        </Link>
        <Link href="/profile" className="mt-4 flex items-center gap-[10px] min-w-0 group">
          <span className="w-8 h-8 rounded-full bg-[#17161A] text-white flex items-center justify-center text-[13px] font-medium shrink-0">
            {name.charAt(0) || "?"}
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-[#17161A] truncate group-hover:underline">
              {name}
            </span>
            <span className="block text-[11.5px] text-[#A6A5AB]">Кабинет артиста</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-[2px]">
        {ITEMS.map((i) => (
          <NavItem key={i.href} item={i} pathname={pathname} />
        ))}
      </nav>

      <div className="px-3 py-3 border-t-[0.5px] border-[#ECEAE5] space-y-[2px]">
        <NavItem item={PROFILE} pathname={pathname} />
        <button
          onClick={async () => {
            await getSupabase().auth.signOut();
            router.push("/");
          }}
          className="w-full flex items-center gap-[10px] text-[13.5px] rounded-full px-[14px] py-[8px] text-[#6E6D73] hover:bg-[#FAFAF9] hover:text-[#17161A] transition"
        >
          <LogOut className="w-[17px] h-[17px] shrink-0" strokeWidth={1.75} />
          Выйти
        </button>
      </div>
    </aside>
  );
}

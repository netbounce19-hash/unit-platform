"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  Wallet,
  MessagesSquare,
  BarChart3,
  Megaphone,
  UploadCloud,
  Mail,
  Settings,
  LifeBuoy,
  LogOut,
  UsersRound,
  ShieldCheck,
  HandCoins,
  Radar,
  type LucideIcon,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import type { MyOrg } from "@/lib/supabase/label";
import { canAccess, roleLabel, type Section } from "@/lib/label/roles";

type Item = { href: string; label: string; icon: LucideIcon; match: string[]; section: Section };

/**
 * Боковая навигация кабинета лейбла на десктопе.
 *
 * На телефоне разделов в нижней панели пять, остальное прячется в «Ещё».
 * На мониторе места хватает, поэтому здесь все разделы видны сразу и
 * «Ещё» не нужно: промо, загрузка данных и приглашения — рабочие
 * инструменты менеджера, а не второстепенные настройки.
 */
const WORK: Item[] = [
  { href: "/label/roster", label: "Ростер", icon: Users, match: ["/label/roster", "/label/artists", "/label/tasks"], section: "roster" },
  { href: "/label/budgets", label: "Заявки", icon: Wallet, match: ["/label/budgets"], section: "budgets" },
  { href: "/label/messages", label: "Чаты", icon: MessagesSquare, match: ["/label/messages"], section: "messages" },
  { href: "/label/stats", label: "Статистика", icon: BarChart3, match: ["/label/stats"], section: "stats" },
];

const TOOLS: Item[] = [
  { href: "/label/scouting", label: "Скаутинг", icon: Radar, match: ["/label/scouting"], section: "scouting" },
  { href: "/label/royalties", label: "Роялти", icon: HandCoins, match: ["/label/royalties"], section: "royalties" },
  { href: "/label/moderation", label: "Модерация", icon: ShieldCheck, match: ["/label/moderation"], section: "moderation" },
  { href: "/label/promo", label: "Промо-отчёты", icon: Megaphone, match: ["/label/promo"], section: "promo" },
  { href: "/label/data-upload", label: "Загрузка данных", icon: UploadCloud, match: ["/label/data-upload"], section: "dataUpload" },
  { href: "/label/invites", label: "Приглашения", icon: Mail, match: ["/label/invites"], section: "invites" },
];

const FOOTER: Item[] = [
  { href: "/label/team", label: "Команда", icon: UsersRound, match: ["/label/team"], section: "team" },
  { href: "/label/settings", label: "Настройки", icon: Settings, match: ["/label/settings"], section: "settings" },
  { href: "/label/support", label: "Поддержка", icon: LifeBuoy, match: ["/label/support"], section: "support" },
];

function NavItem({ item, pathname }: { item: Item; pathname: string }) {
  const Icon = item.icon;
  const active = item.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-[10px] text-[13.5px] rounded-full px-[14px] py-[8px] transition ${
        active
          ? "bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2] font-medium"
          : "text-[#6E6D73] dark:text-[#9A98A0] hover:bg-[#FAFAF9] dark:hover:bg-[#1F1E22] hover:text-[#17161A] dark:hover:text-[#F5F4F2]"
      }`}
    >
      <Icon className="w-[17px] h-[17px] shrink-0" strokeWidth={active ? 2 : 1.75} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export default function LabelSidebar({ org }: { org: MyOrg }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="hidden lg:flex flex-col w-[248px] shrink-0 h-screen sticky top-0 bg-white dark:bg-[#1A191D] border-r-[0.5px] border-[#ECEAE5] dark:border-[#242327]">
      <div className="px-5 pt-6 pb-5 border-b-[0.5px] border-[#ECEAE5] dark:border-[#242327]">
        <Link
          href="/label/roster"
          className="font-semibold tracking-[0.16em] text-[17px] text-[#17161A] dark:text-[#F5F4F2]"
        >
          UNIT
        </Link>
        <div className="mt-4 text-[13px] font-medium text-[#17161A] dark:text-[#F5F4F2] truncate">
          {org.name}
        </div>
        <div className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73]">
          {roleLabel(org.role)}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-[2px]">
          {WORK.filter((i) => canAccess(org.role, i.section)).map((i) => (
            <NavItem key={i.href} item={i} pathname={pathname} />
          ))}
        </div>

        <div className="text-[11px] font-medium text-[#A6A5AB] dark:text-[#6E6D73] px-[14px] mt-6 mb-2">
          Инструменты
        </div>
        <div className="space-y-[2px]">
          {TOOLS.filter((i) => canAccess(org.role, i.section)).map((i) => (
            <NavItem key={i.href} item={i} pathname={pathname} />
          ))}
        </div>
      </nav>

      <div className="px-3 py-3 border-t-[0.5px] border-[#ECEAE5] dark:border-[#242327] space-y-[2px]">
        {FOOTER.filter((i) => canAccess(org.role, i.section)).map((i) => (
          <NavItem key={i.href} item={i} pathname={pathname} />
        ))}
        <button
          onClick={async () => {
            await getSupabase().auth.signOut();
            router.push("/");
          }}
          className="w-full flex items-center gap-[10px] text-[13.5px] rounded-full px-[14px] py-[8px] text-[#6E6D73] dark:text-[#9A98A0] hover:bg-[#FAFAF9] dark:hover:bg-[#1F1E22] hover:text-[#17161A] dark:hover:text-[#F5F4F2] transition"
        >
          <LogOut className="w-[17px] h-[17px] shrink-0" strokeWidth={1.75} />
          Выйти
        </button>
      </div>
    </aside>
  );
}

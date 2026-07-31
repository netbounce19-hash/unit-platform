"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Wallet,
  Mail,
  LogOut,
  MessagesSquare,
  BarChart3,
  UploadCloud,
  Settings,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import type { MyOrg } from "@/lib/supabase/label";
import { LabelThemeProvider } from "./LabelThemeProvider";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/label/roster", label: "Ростер", icon: Users },
  { href: "/label/messages", label: "Сообщения", icon: MessagesSquare },
  { href: "/label/stats", label: "Статистика", icon: BarChart3 },
  { href: "/label/data-upload", label: "Загрузка данных", icon: UploadCloud },
  { href: "/label/budgets", label: "Заявки", icon: Wallet },
  { href: "/label/invites", label: "Приглашения", icon: Mail },
];

const NAV_BOTTOM: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/label/settings", label: "Настройки", icon: Settings },
  { href: "/label/support", label: "Поддержка", icon: LifeBuoy },
];

const ROLE_LABEL: Record<string, string> = {
  label_admin: "Администратор",
  label_manager: "Менеджер",
};

function NavLink({ item, active }: { item: (typeof NAV)[number]; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-[10px] text-[13.5px] rounded-[10px] px-3 py-[9px] mb-[2px] transition ${
        active
          ? "bg-[#FDEDEB] text-[#A62018] font-medium dark:bg-[#3A2422] dark:text-[#F3928C]"
          : "text-[#6E6D73] hover:bg-[#F0EEEA] hover:text-[#17161A] dark:text-[#9A98A0] dark:hover:bg-[#242327] dark:hover:text-[#F5F4F2]"
      }`}
    >
      <Icon className="w-[16px] h-[16px] shrink-0" strokeWidth={1.75} />
      {item.label}
    </Link>
  );
}

/**
 * Каркас кабинета лейбла: боковая навигация и плотная рабочая область.
 * Намеренно не похож на артистский — тут не лента карточек, а рабочий стол.
 */
function LabelShellInner({
  org,
  title,
  subtitle,
  actions,
  children,
}: {
  org: MyOrg;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-screen flex bg-[#FAFAF9] dark:bg-[#141316]">
      {/* Сайдбар */}
      <aside className="w-[212px] shrink-0 border-r-[0.5px] border-[#ECEAE5] dark:border-[#242327] bg-white dark:bg-[#1A191D] flex flex-col sticky top-0 h-screen">
        <div className="px-4 py-[18px] border-b-[0.5px] border-[#ECEAE5] dark:border-[#242327]">
          <div className="font-semibold tracking-[0.16em] text-[15px] dark:text-[#F5F4F2]">UNIT</div>
          <div className="text-[12px] text-[#6E6D73] dark:text-[#9A98A0] mt-[3px] truncate">{org.name}</div>
          <div className="text-[11px] text-[#A6A5AB] dark:text-[#6E6D73] mt-[1px]">
            {ROLE_LABEL[org.role] ?? org.role}
          </div>
        </div>

        <nav className="flex-1 p-2 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>

        <div className="p-2 border-t-[0.5px] border-[#ECEAE5] dark:border-[#242327]">
          {NAV_BOTTOM.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
          <button
            onClick={() => getSupabase().auth.signOut()}
            className="w-full flex items-center gap-[10px] text-[13.5px] text-[#6E6D73] dark:text-[#9A98A0] rounded-[10px] px-3 py-[9px] hover:bg-[#F0EEEA] hover:text-[#A62018] dark:hover:bg-[#242327] dark:hover:text-[#F3928C] transition"
          >
            <LogOut className="w-[16px] h-[16px] shrink-0" strokeWidth={1.75} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Рабочая область */}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 bg-[#FAFAF9]/95 dark:bg-[#141316]/95 backdrop-blur-sm border-b-[0.5px] border-[#ECEAE5] dark:border-[#242327] px-6 py-[14px] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[18px] font-semibold tracking-[-0.01em] truncate dark:text-[#F5F4F2]">{title}</h1>
            {subtitle && (
              <p className="text-[12.5px] text-[#6E6D73] dark:text-[#9A98A0] mt-[1px] truncate">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>

        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

export default function LabelShell(props: Parameters<typeof LabelShellInner>[0]) {
  return (
    <LabelThemeProvider>
      <LabelShellInner {...props} />
    </LabelThemeProvider>
  );
}

/** Плотная таблица — основной способ показывать данные в кабинете лейбла. */
export function DataTable({
  head,
  children,
  empty,
}: {
  head: string[];
  children: React.ReactNode;
  empty?: string | null;
}) {
  return (
    <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] overflow-hidden">
      <table className="w-full text-[13.5px] dark:text-[#F5F4F2]">
        <thead>
          <tr className="border-b-[0.5px] border-[#ECEAE5] dark:border-[#242327]">
            {head.map((h) => (
              <th
                key={h}
                className="text-left font-medium text-[#A6A5AB] dark:text-[#6E6D73] text-[12px] px-4 py-[10px] whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && (
        <div className="px-4 py-8 text-center text-[13px] text-[#A6A5AB] dark:text-[#6E6D73]">{empty}</div>
      )}
    </div>
  );
}

export function Badge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-block text-[11.5px] font-medium px-[8px] py-[3px] rounded-full ${cls}`}>
      {label}
    </span>
  );
}

/** Общий класс белой панели-карточки — с поддержкой тёмной темы. */
export const panelCls =
  "bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px]";

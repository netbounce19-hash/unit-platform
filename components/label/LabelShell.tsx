"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { canAccess, roleLabel, sectionOfPath } from "@/lib/label/roles";
import type { MyOrg } from "@/lib/supabase/label";
import { LabelThemeProvider } from "./LabelThemeProvider";
import LabelNav from "./LabelNav";
import LabelSidebar from "./LabelSidebar";
import BackHome from "@/components/ui/BackHome";

/** Разделы нижней навигации — на них «Назад» не нужен. */
const LABEL_ROOTS = [
  "/label/roster",
  "/label/budgets",
  "/label/messages",
  "/label/stats",
  "/label/more",
];

/**
 * Каркас кабинета лейбла. Две раскладки в одном компоненте:
 *
 * - до lg (1024px) — мобильная: колонка 720px, топбар сверху, пять
 *   разделов в нижней панели, остальное в «Ещё»;
 * - от lg — рабочий стол: боковая панель со всеми разделами, заголовок
 *   и кнопки страницы в одну строку, контент до 1200px.
 *
 * Менеджер лейбла работает за компьютером: ростер, заявки и переписка —
 * это таблицы и очереди, которые на широком экране читаются в разы
 * быстрее, чем стопка карточек в колонку.
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
  const section = sectionOfPath(pathname);
  const allowed = !section || canAccess(org.role, section);

  return (
    <div className="min-h-screen bg-[#FAFAF9] dark:bg-[#141316] lg:flex">
      <LabelSidebar org={org} />

      <div className="flex-1 min-w-0">
        <div className="max-w-[720px] lg:max-w-[1200px] mx-auto px-5 lg:px-10 py-7 lg:py-8 pb-[92px] lg:pb-10">
          {/* Топбар — только на телефоне: на десктопе бренд и организация в сайдбаре */}
          <div className="flex items-center justify-between gap-4 mb-6 lg:hidden">
            <Link
              href="/label/roster"
              className="font-semibold tracking-[0.16em] text-[17px] dark:text-[#F5F4F2] shrink-0"
            >
              UNIT
            </Link>
            <div className="text-right min-w-0">
              <div className="text-[12.5px] font-medium truncate dark:text-[#F5F4F2]">{org.name}</div>
              <div className="text-[11px] text-[#A6A5AB] dark:text-[#6E6D73]">
                {roleLabel(org.role)}
              </div>
            </div>
          </div>

          <BackHome homeHref="/label/roster" roots={LABEL_ROOTS} />

          {/* Заголовок страницы. На телефоне кнопки уходят под него — в строку
              не помещаются; на десктопе встают справа. */}
          <div className="mb-4 lg:mb-6 lg:flex lg:items-end lg:justify-between lg:gap-6">
            <div className="min-w-0">
              <h1 className="text-[22px] lg:text-[26px] font-medium tracking-[-0.01em] dark:text-[#F5F4F2]">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[13.5px] text-[#6E6D73] dark:text-[#9A98A0] mt-[3px]">{subtitle}</p>
              )}
            </div>
            {actions && allowed && (
              <div className="flex flex-wrap items-center gap-2 mt-3 lg:mt-0 lg:shrink-0 lg:justify-end">
                {actions}
              </div>
            )}
          </div>

          {allowed ? (
            children
          ) : (
            // Раздел не для этой роли. Данные закрыты и в базе — это экран-объяснение.
            <div className={`${panelCls} px-6 py-10 text-center`}>
              <Lock className="w-6 h-6 mx-auto text-[#A6A5AB]" strokeWidth={1.75} />
              <div className="text-[15px] font-medium mt-2 dark:text-[#F5F4F2]">Раздел недоступен для роли «{roleLabel(org.role)}»</div>
              <p className="text-[13px] text-[#6E6D73] dark:text-[#9A98A0] mt-1">
                Если он нужен в работе, попросите администратора лейбла поменять роль в разделе «Команда».
              </p>
            </div>
          )}
        </div>
      </div>

      <LabelNav role={org.role} />
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

/** Общий класс белой панели-карточки — с поддержкой тёмной темы. */
export const panelCls =
  "bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px]";

export function Badge({
  label,
  cls,
  icon: Icon,
  dot = false,
}: {
  label: string;
  cls: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  dot?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-[5px] text-[11.5px] font-medium px-[8px] py-[3px] rounded-full ${cls}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />}
      {Icon && <Icon className="w-[12px] h-[12px] shrink-0" strokeWidth={2} />}
      <span>{label}</span>
    </span>
  );
}

/**
 * Список карточек вместо таблицы. Плотные таблицы с whitespace-nowrap
 * на телефоне уезжали вбок, поэтому строка стала карточкой.
 * На десктопе карточки встают в две колонки — одна колонка на 1200px
 * превращала каждую в длинную полосу с пустотой посередине.
 */
export function CardList({
  children,
  empty,
  columns = 2,
}: {
  children?: React.ReactNode;
  empty?: string | null;
  /** Колонок на десктопе. 1 — для списков, которые читаются сверху вниз (рейтинг). */
  columns?: 1 | 2;
}) {
  return (
    <div
      className={
        columns === 2
          ? "space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start"
          : "space-y-2"
      }
    >
      {children}
      {empty && (
        <div
          className={`${panelCls} px-4 py-8 text-center text-[13px] text-[#A6A5AB] dark:text-[#6E6D73] lg:col-span-2`}
        >
          {empty}
        </div>
      )}
    </div>
  );
}

/** Одна карточка списка. С href становится ссылкой на подробности. */
export function ListCard({
  href,
  children,
}: {
  href?: string;
  children: React.ReactNode;
}) {
  const cls = `${panelCls} block px-4 py-[13px] ${
    href ? "hover:border-[#D2D0CB] dark:hover:border-[#33323A] transition" : ""
  }`;
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}

/**
 * Пара «подпись — значение» внутри карточки: то, что в таблице было
 * заголовком колонки, здесь стоит рядом со значением.
 */
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px] py-[3px]">
      <span className="text-[#A6A5AB] dark:text-[#6E6D73] shrink-0">{label}</span>
      <span className="text-right min-w-0 dark:text-[#F5F4F2]">{children}</span>
    </div>
  );
}

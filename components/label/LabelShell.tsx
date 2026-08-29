"use client";

import Link from "next/link";
import type { MyOrg } from "@/lib/supabase/label";
import { LabelThemeProvider } from "./LabelThemeProvider";
import LabelNav from "./LabelNav";
import BackHome from "@/components/ui/BackHome";

/** Разделы нижней навигации — на них «Назад» не нужен. */
const LABEL_ROOTS = [
  "/label/roster",
  "/label/budgets",
  "/label/messages",
  "/label/stats",
  "/label/more",
];

const ROLE_LABEL: Record<string, string> = {
  label_admin: "Администратор",
  label_manager: "Менеджер",
};

/**
 * Каркас кабинета лейбла — единый мобильный макет, как в кабинете артиста:
 * колонка 720px по центру, топбар сверху, навигация снизу.
 * Плотный сайдбар на 212px был рабочим столом для десктопа, но на
 * телефоне съедал больше половины ширины.
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
  return (
    <div className="min-h-screen bg-[#FAFAF9] dark:bg-[#141316]">
      <div className="max-w-[720px] mx-auto px-5 py-7 pb-[92px]">
        {/* Топбар */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link
            href="/label/roster"
            className="font-semibold tracking-[0.16em] text-[17px] dark:text-[#F5F4F2] shrink-0"
          >
            UNIT
          </Link>
          <div className="text-right min-w-0">
            <div className="text-[12.5px] font-medium truncate dark:text-[#F5F4F2]">{org.name}</div>
            <div className="text-[11px] text-[#A6A5AB] dark:text-[#6E6D73]">
              {ROLE_LABEL[org.role] ?? org.role}
            </div>
          </div>
        </div>

        <BackHome homeHref="/label/roster" roots={LABEL_ROOTS} />

        {/* Заголовок страницы. Кнопки уходят под него: в строке с заголовком
            они на узком экране не помещаются. */}
        <div className="mb-4">
          <h1 className="text-[22px] font-medium tracking-[-0.01em] dark:text-[#F5F4F2]">{title}</h1>
          {subtitle && (
            <p className="text-[13.5px] text-[#6E6D73] dark:text-[#9A98A0] mt-[3px]">{subtitle}</p>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2 mt-3">{actions}</div>}
        </div>

        {children}
      </div>

      <LabelNav />
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
 */
export function CardList({
  children,
  empty,
}: {
  children?: React.ReactNode;
  empty?: string | null;
}) {
  return (
    <div className="space-y-2">
      {children}
      {empty && (
        <div
          className={`${panelCls} px-4 py-8 text-center text-[13px] text-[#A6A5AB] dark:text-[#6E6D73]`}
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

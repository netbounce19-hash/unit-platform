"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  Mail,
  Settings,
  LifeBuoy,
  LogOut,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { panelCls } from "@/components/label/LabelShell";
import { getSupabase } from "@/lib/supabase/client";
import type { MyOrg } from "@/lib/supabase/label";

const ITEMS: { href: string; label: string; hint: string; icon: LucideIcon }[] = [
  {
    href: "/label/data-upload",
    label: "Загрузка данных",
    hint: "Стримы по артистам вручную",
    icon: UploadCloud,
  },
  {
    href: "/label/invites",
    label: "Приглашения",
    hint: "Позвать артиста в ростер",
    icon: Mail,
  },
  {
    href: "/label/settings",
    label: "Настройки",
    hint: "Тема, уведомления, чёрный список",
    icon: Settings,
  },
  {
    href: "/label/support",
    label: "Поддержка",
    hint: "Частые вопросы и связь с нами",
    icon: LifeBuoy,
  },
];

function MoreInner({ org }: { org: MyOrg }) {
  const router = useRouter();

  return (
    <LabelShell org={org} title="Ещё" subtitle="Разделы, которые не поместились в навигацию">
      <div className={`${panelCls} overflow-hidden mb-4`}>
        {ITEMS.map((item, i) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-[14px] hover:bg-[#FAFAF9] dark:hover:bg-[#232227] transition ${
                i > 0 ? "border-t-[0.5px] border-[#ECEAE5] dark:border-[#242327]" : ""
              }`}
            >
              <span className="w-9 h-9 rounded-[12px] bg-[#F0EEEA] dark:bg-[#242327] text-[#6E6D73] dark:text-[#9A98A0] flex items-center justify-center shrink-0">
                <Icon className="w-[17px] h-[17px]" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium truncate dark:text-[#F5F4F2]">
                  {item.label}
                </span>
                <span className="block text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] truncate mt-[1px]">
                  {item.hint}
                </span>
              </span>
              <ChevronRight
                className="w-[16px] h-[16px] text-[#C4C3C8] dark:text-[#6E6D73] shrink-0"
                strokeWidth={2}
              />
            </Link>
          );
        })}
      </div>

      <button
        onClick={async () => {
          await getSupabase().auth.signOut();
          router.push("/");
        }}
        className={`${panelCls} w-full flex items-center justify-center gap-[7px] px-4 py-[13px] text-[14px] font-medium text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#A62018] dark:hover:text-[#F3928C] hover:border-[#F3C9C6] dark:hover:border-[#3A2422] transition`}
      >
        <LogOut className="w-[16px] h-[16px]" strokeWidth={1.75} />
        Выйти из аккаунта
      </button>
    </LabelShell>
  );
}

export default function MorePage() {
  return <LabelGate>{({ org }) => <MoreInner org={org} />}</LabelGate>;
}

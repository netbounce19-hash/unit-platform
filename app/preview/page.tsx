"use client";

import { useState } from "react";
import { AppProvider } from "@/components/providers/AppProvider";
import LabelKPIHero from "@/components/label/LabelKPIHero";
import Leaderboard from "@/components/label/Leaderboard";
import FinanceHub from "@/components/label/FinanceHub";
import LabelMessengerWidget from "@/components/label/LabelMessengerWidget";
import TaskConstructor from "@/components/label/TaskConstructor";
import TargetManagement from "@/components/label/TargetManagement";
import PromoInbox from "@/components/label/PromoInbox";
import {
  Users,
  Wallet,
  MessagesSquare,
  BarChart3,
  MoreHorizontal,
} from "lucide-react";

export default function PreviewPage() {
  const [currentTab, setCurrentTab] = useState<"roster" | "budgets" | "messages" | "stats">("roster");

  return (
    <AppProvider>
      <div className="min-h-screen bg-[#FAFAF9]">
        <div className="max-w-[720px] mx-auto px-5 py-7 pb-[92px] flex flex-col gap-6">

          {/* Topbar */}
          <div className="flex items-center justify-between gap-4">
            <span className="font-semibold tracking-[0.16em] text-[17px] text-[#17161A]">
              UNIT
            </span>
            <div className="text-right">
              <div className="text-[12.5px] font-medium text-[#17161A]">UNIT Records</div>
              <div className="text-[11px] text-[#A6A5AB]">Администратор лейбла</div>
            </div>
          </div>

          {/* Greeting / Page Title */}
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.01em] text-[#17161A]">
              Сводка по лейблу
            </h1>
            <p className="text-[14px] text-[#6E6D73] mt-[3px]">
              Динамика стримов, активные заявки, чаты и операционные задачи
            </p>
          </div>

          {/* 1. Hero KPI Cards */}
          <LabelKPIHero />

          {/* 2. Messenger Direct Widget */}
          <LabelMessengerWidget />

          {/* 3. Main Analytics & Leaderboard Chart */}
          <Leaderboard />

          {/* 4. Finance & Budgets Hub */}
          <FinanceHub />

          {/* 5. Operational Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TaskConstructor />
            <TargetManagement />
          </div>

          {/* 6. Promo Inbox */}
          <PromoInbox />

        </div>

        {/* Unified Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t-[0.5px] border-[#ECEAE5]">
          <div className="max-w-[720px] mx-auto px-2 flex items-stretch">
            {[
              { id: "roster", href: "/label/roster", label: "Ростер", icon: Users },
              { id: "budgets", href: "/label/budgets", label: "Заявки", icon: Wallet },
              { id: "messages", href: "/label/messages", label: "Чаты", icon: MessagesSquare },
              { id: "stats", href: "/label/stats", label: "Статистика", icon: BarChart3 },
              { id: "more", href: "/label/more", label: "Ещё", icon: MoreHorizontal },
            ].map(({ id, href, label, icon: Icon }) => (
              <a
                key={id}
                href={href}
                className={`flex-1 flex flex-col items-center gap-[3px] py-[9px] rounded-[12px] transition cursor-pointer ${
                  id === "roster" ? "text-[#17161A]" : "text-[#A6A5AB] hover:text-[#6E6D73]"
                }`}
              >
                <Icon className="w-[19px] h-[19px]" strokeWidth={id === "roster" ? 2 : 1.75} />
                <span className={`text-[11px] ${id === "roster" ? "font-medium" : ""}`}>
                  {label}
                </span>
              </a>
            ))}
          </div>
        </nav>
      </div>
    </AppProvider>
  );
}

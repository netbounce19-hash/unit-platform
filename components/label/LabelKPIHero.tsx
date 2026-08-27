"use client";

import { motion } from "framer-motion";
import { TrendingUp, Disc3, Wallet, Bell } from "lucide-react";
import { NotificationIconControlled } from "@/components/ui/animated-state-icons";
import { useApp } from "@/components/providers/AppProvider";

export default function LabelKPIHero() {
  const { state } = useApp();

  const totalQuarterlyStreams = state.artists.reduce(
    (sum, a) => sum + a.quarterlyStreams,
    0
  );

  const pendingBudgets = state.budgets.filter((b) => b.status === "pending");
  const totalPendingAmount = pendingBudgets.reduce((sum, b) => sum + b.amount, 0);

  const activeReleases = state.releases.filter((r) => r.status !== "released").length;
  const unreviewedPromos = state.promos.filter((p) => !p.reviewed).length;

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return n.toString();
  };

  const formatRub = (n: number) => {
    if (n >= 1000000) return `₽${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `₽${(n / 1000).toFixed(0)}K`;
    return `₽${n}`;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Стримы ростера */}
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
        className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-5 flex flex-col justify-between"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-medium text-[#6E6D73]">Стримы (Q3)</span>
          <div className="w-7 h-7 rounded-[12px] bg-[#F0EEEA] text-[#17161A] flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5" strokeWidth={2.5} />
          </div>
        </div>
        <div>
          <div className="text-[26px] font-semibold tracking-tight text-[#17161A] leading-none mb-1.5">
            {formatNumber(totalQuarterlyStreams)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#1F9D6B] font-medium">
            <span>▲ +14.2%</span>
            <span className="text-[#A6A5AB] font-normal">к прошлому мес.</span>
          </div>
        </div>
      </motion.div>

      {/* 2. Релизы в пайплайне */}
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
        className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-5 flex flex-col justify-between"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-medium text-[#6E6D73]">Релизы в работе</span>
          <div className="w-7 h-7 rounded-[12px] bg-[#F0EEEA] text-[#17161A] flex items-center justify-center">
            <Disc3 className="w-3.5 h-3.5" strokeWidth={2} />
          </div>
        </div>
        <div>
          <div className="text-[26px] font-semibold tracking-tight text-[#17161A] leading-none mb-1.5">
            {activeReleases}
          </div>
          <div className="text-[11px] text-[#6E6D73]">
            <span className="font-medium text-[#17161A]">2</span> на проверке мастера
          </div>
        </div>
      </motion.div>

      {/* 3. Бюджеты в ожидании */}
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
        className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-5 flex flex-col justify-between"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-medium text-[#6E6D73]">Заявки на бюджет</span>
          <div className="w-7 h-7 rounded-[12px] bg-[#FBF1DE] text-[#8A5A16] flex items-center justify-center">
            <Wallet className="w-3.5 h-3.5" strokeWidth={2} />
          </div>
        </div>
        <div>
          <div className="text-[26px] font-semibold tracking-tight text-[#17161A] leading-none mb-1.5">
            {formatRub(totalPendingAmount)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#8A5A16] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] animate-pulse" />
            <span>{pendingBudgets.length} требуют решения</span>
          </div>
        </div>
      </motion.div>

      {/* 4. Промо отчёты */}
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
        className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-5 flex flex-col justify-between"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-medium text-[#6E6D73]">Промо-отчёты</span>
          <div className="w-7 h-7 rounded-[12px] bg-[#F0EEEA] text-[#17161A] flex items-center justify-center">
            <NotificationIconControlled size={16} color="#17161A" hasNotif={unreviewedPromos > 0} />
          </div>
        </div>
        <div>
          <div className="text-[26px] font-semibold tracking-tight text-[#17161A] leading-none mb-1.5">
            {unreviewedPromos}
          </div>
          <div className="text-[11px] text-[#17161A] font-medium">
            {unreviewedPromos > 0 ? "Ожидают проверки" : "Все проверены"}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

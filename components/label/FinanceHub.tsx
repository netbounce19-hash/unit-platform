"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";
import { Wallet, Check, X, Clock, AlertCircle } from "lucide-react";

export default function FinanceHub() {
  const { state, dispatch } = useApp();

  const pendingBudgets = state.budgets.filter((b) => b.status === "pending");
  const processedBudgets = state.budgets.filter(
    (b) => b.status === "approved" || b.status === "declined"
  );

  const getArtistName = (id: string) =>
    state.artists.find((a) => a.id === id)?.name || "—";

  const totalPending = pendingBudgets.reduce((sum, b) => sum + b.amount, 0);

  const formatRub = (n: number) =>
    n >= 1000000
      ? `₽${(n / 1000000).toFixed(1)}M`
      : n >= 1000
      ? `₽${(n / 1000).toFixed(0)}K`
      : `₽${n}`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#6E6D73]" strokeWidth={2} />
          <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[#17161A]">
            Заявки на финансирование
          </h3>
        </div>
        {pendingBudgets.length > 0 ? (
          <span className="px-2.5 py-0.5 bg-[#FBF1DE] text-[#8A5A16] text-[11px] font-medium rounded-full">
            {pendingBudgets.length} ждут · {formatRub(totalPending)}
          </span>
        ) : (
          <span className="px-2.5 py-0.5 bg-[#E9F6EF] text-[#1F9D6B] text-[11px] font-medium rounded-full">
            Все решены
          </span>
        )}
      </div>

      {pendingBudgets.length > 0 ? (
        <div className="space-y-3 mb-4">
          {pendingBudgets.map((budget) => (
            <motion.div
              key={budget.id}
              layout
              className="bg-[#FAFAF9] rounded-[12px] p-4 border-[0.5px] border-[#ECEAE5]"
            >
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-full bg-[#17161A] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      {getArtistName(budget.artistId)[0]}
                    </div>
                    <span className="text-[12px] font-semibold text-[#17161A]">
                      {getArtistName(budget.artistId)}
                    </span>
                    <span className="text-[11px] text-[#A6A5AB]">
                      {budget.createdAt}
                    </span>
                  </div>
                  <p className="text-[13.5px] font-medium text-[#17161A] leading-snug">
                    {budget.purpose}
                  </p>
                </div>
                <span className="text-[16px] font-semibold text-[#17161A] tabular-nums shrink-0 ml-2">
                  {formatRub(budget.amount)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t-[0.5px] border-[#ECEAE5]">
                <button
                  onClick={() =>
                    dispatch({
                      type: "UPDATE_BUDGET_STATUS",
                      payload: { id: budget.id, status: "approved" },
                    })
                  }
                  className="flex-1 py-1.5 bg-[#1F9D6B] text-white text-[12px] font-medium rounded-full hover:brightness-95 transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Одобрить
                </button>
                <button
                  onClick={() =>
                    dispatch({
                      type: "UPDATE_BUDGET_STATUS",
                      payload: { id: budget.id, status: "declined" },
                    })
                  }
                  className="py-1.5 px-3 bg-[#FDEDEB] text-[#A62018] text-[12px] font-medium rounded-full hover:bg-[#FCE2DF] transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Отклонить
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center text-[13px] text-[#A6A5AB]">
          Нет ожидающих заявок
        </div>
      )}

      {/* History */}
      {processedBudgets.length > 0 && (
        <div className="pt-4 border-t-[0.5px] border-[#ECEAE5]">
          <p className="text-[11px] font-medium text-[#A6A5AB] uppercase tracking-wider mb-2">
            История решений
          </p>
          <div className="space-y-2">
            {processedBudgets.slice(0, 3).map((budget) => (
              <div
                key={budget.id}
                className="flex items-center justify-between text-[12.5px] bg-[#FAFAF9] rounded-[12px] px-3 py-2 border-[0.5px] border-[#ECEAE5]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-[#17161A] truncate">
                    {budget.purpose}
                  </span>
                  <span className="text-[#A6A5AB] shrink-0">
                    ({getArtistName(budget.artistId)})
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="font-semibold text-[#17161A]">
                    {formatRub(budget.amount)}
                  </span>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      budget.status === "approved"
                        ? "bg-[#E9F6EF] text-[#166B49]"
                        : "bg-[#FDEDEB] text-[#A62018]"
                    }`}
                  >
                    {budget.status === "approved" ? "Одобрено" : "Отклонено"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, Check } from "lucide-react";
import BudgetRequestModal, { NewBudgetRequest } from "@/components/artist/BudgetRequestModal";
import SwipeToDelete from "@/components/artist/SwipeToDelete";
import {
  listBudgetRequests,
  createBudgetRequest,
  deleteBudgetRequest,
  type BudgetRequestRow,
  type RequestStatus,
} from "@/lib/supabase/cabinet";

const statusLabels: Record<RequestStatus, { label: string; cls: string }> = {
  pending: { label: "На рассмотрении", cls: "bg-[#FBF1DE] text-[#8A5A16]" },
  approved: { label: "Одобрена", cls: "bg-[#E9F6EF] text-[#166B49]" },
  declined: { label: "Отклонена", cls: "bg-[#FDEDEB] text-[#A62018]" },
};

// «отправлена сегодня / вчера / 5 июля»
function formatSince(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const day = 24 * 60 * 60 * 1000;
  const diff = Math.floor(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      day
  );
  if (diff <= 0) return "отправлена сегодня";
  if (diff === 1) return "отправлена вчера";
  return "отправлена " + d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export default function FinancePage() {
  const [requests, setRequests] = useState<BudgetRequestRow[]>([]);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listBudgetRequests()
      .then((rows) => !cancelled && setRequests(rows))
      .catch(() => {
        /* не залогинен или сеть — оставляем пустой список */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const removeRequest = async (id: string) => {
    const prev = requests;
    setRequests((r) => r.filter((x) => x.id !== id)); // оптимистично
    try {
      await deleteBudgetRequest(id);
    } catch {
      setRequests(prev); // откат
      setToast("Не удалось удалить заявку");
    }
  };

  const addRequest = async (req: NewBudgetRequest) => {
    try {
      const row = await createBudgetRequest(req.purpose, req.amount);
      setRequests((prev) => [row, ...prev]);
      setToast(`Заявка отправлена менеджеру · ${req.purpose}`);
    } catch {
      setToast("Не удалось отправить заявку");
    }
  };

  const pending = requests.filter((r) => r.status === "pending").length;

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="text-[22px] font-medium tracking-[-0.01em]">Финансы</div>
          <div className="text-[14px] text-[#6E6D73] mt-[3px]">
            {pending > 0 ? `${pending} на рассмотрении` : "Заявки на финансирование"}
          </div>
        </div>
        <button
          onClick={() => setBudgetOpen(true)}
          className="shrink-0 inline-flex items-center gap-[6px] bg-[#E23A34] text-white font-medium text-[13px] px-[14px] py-[9px] rounded-[10px] hover:brightness-95 transition mt-1"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Сделать заявку
        </button>
      </div>

      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] px-[22px] pt-[6px] pb-[14px]">
        <AnimatePresence initial={false}>
          {requests.map((r, i) => (
            <motion.div
              key={r.id}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <SwipeToDelete
                onDelete={() => removeRequest(r.id)}
                label={`Удалить заявку: ${r.purpose}`}
              >
                <div
                  className={`group flex items-center justify-between gap-3 py-[13px] ${
                    i > 0 ? "border-t-[0.5px] border-[#ECEAE5]" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium truncate">Заявка: {r.purpose}</div>
                    <div className="text-[12px] text-[#A6A5AB] mt-[2px]">
                      {r.amount.toLocaleString("ru-RU")} ₽ · {formatSince(r.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`text-[12px] font-medium px-[10px] py-[4px] rounded-full ${statusLabels[r.status].cls}`}
                    >
                      {statusLabels[r.status].label}
                    </span>
                    <button
                      onClick={() => removeRequest(r.id)}
                      aria-label={`Удалить заявку: ${r.purpose}`}
                      title="Удалить заявку"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[#C4C3C8] hover:text-[#A62018] hover:bg-[#FDEDEB] transition"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              </SwipeToDelete>
            </motion.div>
          ))}
        </AnimatePresence>
        {requests.length === 0 && (
          <div className="py-[26px] text-[13px] text-[#A6A5AB] text-center">
            Заявок нет. Опишите, на что нужен бюджет — менеджер рассмотрит.
          </div>
        )}
      </div>

      <BudgetRequestModal
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        onSubmit={addRequest}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            role="status"
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-[10px] bg-[#17161A] text-white text-[13px] font-medium pl-[14px] pr-[18px] py-[11px] rounded-full max-w-[calc(100vw-2rem)]"
          >
            <span className="w-5 h-5 rounded-full bg-[#1F9D6B] flex items-center justify-center shrink-0">
              <Check className="w-[13px] h-[13px]" strokeWidth={3} />
            </span>
            <span className="truncate">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

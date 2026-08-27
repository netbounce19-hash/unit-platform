"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Wallet, ArrowUp, CalendarDays } from "lucide-react";

/** Просить деньги задним числом нельзя — ограничиваем выбор сегодняшним днём. */
const today = new Date().toISOString().slice(0, 10);

export interface NewBudgetRequest {
  purpose: string;
  amount: number;
  /** к какой дате нужны средства, YYYY-MM-DD; пусто — срок не горит */
  neededBy: string | null;
}

interface BudgetRequestModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (req: NewBudgetRequest) => void;
}

function formatAmount(digits: string) {
  if (!digits) return "";
  return Number(digits).toLocaleString("ru-RU");
}

export default function BudgetRequestModal({
  open,
  onClose,
  onSubmit,
}: BudgetRequestModalProps) {
  const [purpose, setPurpose] = useState("");
  const [amount, setAmount] = useState(""); // только цифры
  const [neededBy, setNeededBy] = useState("");

  // Сброс полей при открытии
  useEffect(() => {
    if (open) {
      setPurpose("");
      setAmount("");
      setNeededBy("");
    }
  }, [open]);

  // Esc закрывает
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const canSubmit = purpose.trim().length > 0 && Number(amount) > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ purpose: purpose.trim(), amount: Number(amount), neededBy: neededBy || null });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Новая заявка на бюджет"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.98, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 24 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="bg-white w-full sm:max-w-[460px] max-h-[90vh] overflow-y-auto rounded-t-[20px] sm:rounded-[16px] border-[0.5px] border-[#ECEAE5] shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-[22px] py-[18px] border-b-[0.5px] border-[#ECEAE5]">
                <div className="flex items-center gap-[10px]">
                  <span className="w-9 h-9 rounded-[12px] bg-[#F0EEEA] text-[#6E6D73] flex items-center justify-center">
                    <Wallet className="w-[18px] h-[18px]" strokeWidth={1.75} />
                  </span>
                  <div>
                    <div className="text-[12px] text-[#A6A5AB]">Финансы</div>
                    <div className="text-[16px] font-medium tracking-[-0.01em]">
                      Новая заявка
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Закрыть"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition"
                >
                  <X className="w-[18px] h-[18px]" strokeWidth={2} />
                </button>
              </div>

              <div className="px-[22px] py-5 space-y-5">
                <label className="block">
                  <span className="block text-[13px] font-medium text-[#6E6D73] mb-[8px]">
                    На что нужен бюджет
                  </span>
                  <textarea
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    rows={3}
                    placeholder="Напр. Сведение и мастеринг трека, съёмка клипа, промо-кампания…"
                    className="w-full resize-none text-[14px] leading-[1.45] rounded-[12px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]"
                  />
                </label>

                <label className="block">
                  <span className="block text-[13px] font-medium text-[#6E6D73] mb-[8px]">
                    Желаемый бюджет
                  </span>
                  <div className="relative">
                    <input
                      value={formatAmount(amount)}
                      onChange={(e) =>
                        setAmount(e.target.value.replace(/\D/g, "").slice(0, 9))
                      }
                      inputMode="numeric"
                      placeholder="0"
                      className="w-full text-[18px] font-medium rounded-[12px] border border-[#E5E3DE] bg-white pl-3 pr-9 py-[11px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8] placeholder:font-normal"
                    />
                    <span className="absolute right-[14px] top-1/2 -translate-y-1/2 text-[16px] text-[#A6A5AB] pointer-events-none">
                      ₽
                    </span>
                  </div>
                </label>

                <label className="block">
                  <span className="flex items-center justify-between mb-[8px]">
                    <span className="text-[13px] font-medium text-[#6E6D73]">
                      Когда нужны средства
                    </span>
                    <span className="text-[11px] text-[#A6A5AB]">необязательно</span>
                  </span>
                  <div className="relative">
                    <CalendarDays
                      className="absolute left-[11px] top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-[#A6A5AB] pointer-events-none"
                      strokeWidth={1.75}
                    />
                    <input
                      type="date"
                      value={neededBy}
                      min={today}
                      onChange={(e) => setNeededBy(e.target.value)}
                      className="w-full text-[14px] rounded-[12px] border border-[#E5E3DE] bg-white pl-[34px] pr-3 py-[11px] outline-none focus:border-[#17161A] transition"
                    />
                  </div>
                  <span className="block text-[12px] text-[#A6A5AB] mt-[6px]">
                    Менеджер увидит срок и успеет согласовать бюджет заранее
                  </span>
                </label>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-[22px] py-[16px] border-t-[0.5px] border-[#ECEAE5]">
                <button
                  onClick={onClose}
                  className="text-[14px] font-medium text-[#6E6D73] px-[18px] py-[10px] rounded-full hover:bg-[#F0EEEA] transition"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-[7px] bg-[#17161A] text-white font-medium text-[14px] px-[18px] py-[10px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Отправить на согласование
                  <ArrowUp className="w-[15px] h-[15px]" strokeWidth={2.5} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";
import { useState } from "react";
import { SuccessIconControlled } from "@/components/ui/animated-state-icons";
import { PlusCircle, Calendar } from "lucide-react";

export default function TaskConstructor() {
  const { state, dispatch } = useApp();
  const [artistId, setArtistId] = useState(state.artists[0]?.id || "");
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [taskType, setTaskType] = useState<
    "upload" | "sign" | "review" | "promo" | "general"
  >("general");
  const [created, setCreated] = useState(false);

  const typeOptions: { value: typeof taskType; label: string }[] = [
    { value: "general", label: "Общая задача" },
    { value: "upload", label: "Загрузка мастер/демо" },
    { value: "sign", label: "Подписание договора" },
    { value: "review", label: "Проверка микса" },
    { value: "promo", label: "Промо-публикация" },
  ];

  const handleCreate = () => {
    if (!title || !deadline || !artistId) return;
    dispatch({
      type: "ADD_TASK",
      payload: { title, artistId, deadline, completed: false, type: taskType },
    });
    setTitle("");
    setDeadline("");
    setCreated(true);
    setTimeout(() => setCreated(false), 2000);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center gap-2 mb-4">
          <PlusCircle className="w-4 h-4 text-[#6E6D73]" strokeWidth={2} />
          <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[#17161A]">
            Назначить задачу
          </h3>
        </div>

        <div className="space-y-3.5">
          {/* Artist select */}
          <div>
            <label className="text-[11px] font-medium text-[#6E6D73] block mb-1">
              Артист
            </label>
            <select
              value={artistId}
              onChange={(e) => setArtistId(e.target.value)}
              className="w-full bg-[#FAFAF9] border border-[#ECEAE5] rounded-[12px] px-3 py-2 text-[13px] text-[#17161A] outline-none focus:border-[#E23A34] transition cursor-pointer"
            >
              {state.artists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="text-[11px] font-medium text-[#6E6D73] block mb-1">
              Суть задачи
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Загрузить финальный мастер"
              className="w-full bg-[#FAFAF9] border border-[#ECEAE5] rounded-[12px] px-3 py-2 text-[13px] text-[#17161A] placeholder:text-[#C4C3C8] outline-none focus:border-[#E23A34] transition"
            />
          </div>

          {/* Type & Deadline */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-medium text-[#6E6D73] block mb-1">
                Тип
              </label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as typeof taskType)}
                className="w-full bg-[#FAFAF9] border border-[#ECEAE5] rounded-[12px] px-2.5 py-2 text-[12.5px] text-[#17161A] outline-none focus:border-[#E23A34] transition cursor-pointer"
              >
                {typeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6E6D73] block mb-1">
                Дедлайн
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-[#FAFAF9] border border-[#ECEAE5] rounded-[12px] px-2.5 py-1.5 text-[12.5px] text-[#17161A] outline-none focus:border-[#E23A34] transition cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={!title || !deadline}
        className={`w-full mt-4 py-2.5 rounded-full text-[13px] font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
          title && deadline
            ? "bg-[#17161A] text-white hover:bg-[#2A292E] active:scale-[0.99]"
            : "bg-[#F0EEEA] text-[#A6A5AB] cursor-not-allowed"
        }`}
      >
        {created ? (
          <>
            <SuccessIconControlled size={16} color="white" done={true} />
            Задача поставлена артисту
          </>
        ) : (
          "Поставить задачу"
        )}
      </button>
    </motion.section>
  );
}

"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";
import { useState } from "react";
import Modal from "@/components/shared/Modal";
import { CheckSquare, Clock, UploadCloud, PenTool, CheckCircle2, Megaphone, FileText } from "lucide-react";

export default function TaskList() {
  const { state, dispatch } = useApp();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  const artistTasks = state.tasks
    .filter((t) => t.artistId === state.currentArtistId)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

  const taskDetail = state.tasks.find((t) => t.id === selectedTask);

  const getDaysUntil = (deadline: string) =>
    Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "upload": return <UploadCloud className="w-3.5 h-3.5 text-[#17161A]" />;
      case "sign": return <PenTool className="w-3.5 h-3.5 text-[#17161A]" />;
      case "review": return <CheckCircle2 className="w-3.5 h-3.5 text-[#1F9D6B]" />;
      case "promo": return <Megaphone className="w-3.5 h-3.5 text-[#8A5A16]" />;
      default: return <FileText className="w-3.5 h-3.5 text-[#6E6D73]" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "upload": return "Загрузка";
      case "sign": return "Подпись";
      case "review": return "Проверка";
      case "promo": return "Промо";
      default: return "Задача";
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 lg:p-7 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-5 pb-3 border-b-[0.5px] border-[#ECEAE5]">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-[#17161A]" />
            <h3 className="text-[14px] font-semibold text-[#17161A] tracking-tight">
              Задачи и дедлайны
            </h3>
          </div>
          <span className="text-[11px] font-mono tracking-wide text-[#6E6D73] bg-[#F0EEEA] px-2.5 py-0.5 rounded-full">
            {artistTasks.filter((t) => !t.completed).length} активных
          </span>
        </div>

        <div className="space-y-2">
          {artistTasks.map((task, i) => {
            const daysLeft = getDaysUntil(task.deadline);
            const isUrgent = daysLeft <= 3 && !task.completed;

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedTask(task.id)}
                className={`
                  flex items-center gap-3 px-3.5 py-3 rounded-[12px] border cursor-pointer
                  transition-all duration-200 group
                  ${task.completed
                    ? "opacity-45 bg-[#FAFAF9] border-transparent"
                    : "bg-[#FAFAF9] hover:bg-white border-[#ECEAE5] hover:border-[#D2D0CB] hover:shadow-xs"
                  }
                `}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: "TOGGLE_TASK", payload: task.id });
                  }}
                  className={`
                    w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0
                    transition-all duration-200 cursor-pointer
                    ${task.completed
                      ? "bg-[#1F9D6B] border-[#1F9D6B] text-white"
                      : "border-[#D2D0CB] group-hover:border-[#17161A]"
                    }
                  `}
                >
                  {task.completed && (
                    <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                <div className="w-5 flex justify-center shrink-0">
                  {getTypeIcon(task.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-medium leading-snug truncate ${task.completed ? "line-through text-[#A6A5AB]" : "text-[#17161A]"}`}>
                    {task.title}
                  </p>
                </div>

                <span className={`
                  text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-full flex-shrink-0
                  ${task.completed
                    ? "bg-[#F0EEEA] text-[#A6A5AB]"
                    : isUrgent
                      ? "bg-[#F0EEEA] text-[#17161A] border border-[#D2D0CB] font-semibold"
                      : "bg-[#F0EEEA] text-[#6E6D73]"
                  }
                `}>
                  {task.completed ? "ГОТОВО" : daysLeft <= 0 ? "! ПРОСРОЧЕНО" : `${daysLeft}Д`}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      <Modal isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} title="Детали задачи">
        {taskDetail && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-mono text-[#A6A5AB] uppercase mb-1">Задача</p>
              <p className="text-[15px] font-medium text-[#17161A] leading-relaxed">{taskDetail.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-[#FAFAF9] p-3 rounded-[12px] border border-[#ECEAE5]">
                <p className="text-[10px] font-mono text-[#A6A5AB] uppercase mb-1">Категория</p>
                <p className="text-[13px] font-medium text-[#17161A]">{getTypeLabel(taskDetail.type)}</p>
              </div>
              <div className="bg-[#FAFAF9] p-3 rounded-[12px] border border-[#ECEAE5]">
                <p className="text-[10px] font-mono text-[#A6A5AB] uppercase mb-1">Дедлайн</p>
                <p className="text-[13px] font-medium text-[#17161A] font-mono">{taskDetail.deadline}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-[12px] text-[#6E6D73]">Статус выполнения:</span>
              <span className={`text-[11px] font-medium px-3 py-1 rounded-full ${
                taskDetail.completed
                  ? "bg-[#E9F6EF] text-[#166B49] border border-[#BDE8D3]"
                  : "bg-[#F0EEEA] text-[#17161A] border border-[#D2D0CB]"
              }`}>
                {taskDetail.completed ? "Выполнено" : "В работе"}
              </span>
            </div>
            <div className="pt-3">
              <button
                onClick={() => {
                  dispatch({ type: "TOGGLE_TASK", payload: taskDetail.id });
                  setSelectedTask(null);
                }}
                className={`w-full py-2.5 rounded-full text-[13px] font-medium transition cursor-pointer ${
                  taskDetail.completed
                    ? "bg-[#F0EEEA] text-[#17161A] hover:bg-[#E5E3DE]"
                    : "bg-[#17161A] text-white hover:bg-[#2A282E]"
                }`}
              >
                {taskDetail.completed ? "Вернуть в работу" : "Отметить как выполненную"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </motion.section>
  );
}

"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";
import { useState } from "react";
import Modal from "@/components/shared/Modal";

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
      case "upload": return "↑";
      case "sign": return "✎";
      case "review": return "◉";
      case "promo": return "◈";
      default: return "○";
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
      transition={{ duration: 0.5, delay: 0.1 }}
      className="bg-navy/30 border border-navy rounded-xl p-7"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-alabaster">
          Задачи и дедлайны
        </h3>
        <span className="text-[9px] tracking-widest uppercase text-alabaster-dim">
          {artistTasks.filter((t) => !t.completed).length} активных
        </span>
      </div>

      <div className="space-y-2.5">
        {artistTasks.map((task, i) => {
          const daysLeft = getDaysUntil(task.deadline);
          const isUrgent = daysLeft <= 3 && !task.completed;

          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedTask(task.id)}
              className={`
                flex items-center gap-3.5 px-4 py-3.5 rounded-lg cursor-pointer
                transition-all duration-200 group
                ${task.completed
                  ? "opacity-40"
                  : "bg-sapphire/40 hover:bg-sapphire/70 border border-transparent hover:border-navy"
                }
              `}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: "TOGGLE_TASK", payload: task.id });
                }}
                className={`
                  w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                  transition-all duration-300 cursor-pointer
                  ${task.completed
                    ? "bg-brass border-brass"
                    : "border-navy group-hover:border-brass/60"
                  }
                `}
              >
                {task.completed && (
                  <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#0D1B2A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              <span className="text-xs text-alabaster-dim w-4 text-center flex-shrink-0">
                {getTypeIcon(task.type)}
              </span>

              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-relaxed truncate ${task.completed ? "line-through text-alabaster-dim" : "text-alabaster"}`}>
                  {task.title}
                </p>
              </div>

              <span className={`
                text-[9px] tracking-wider uppercase px-2.5 py-1 rounded flex-shrink-0
                ${isUrgent
                  ? "bg-error/20 text-[#d4564a]"
                  : task.completed
                    ? "text-alabaster-dim"
                    : "bg-navy/60 text-alabaster-dim"
                }
              `}>
                {task.completed ? "Готово" : daysLeft <= 0 ? "Просрочено" : `${daysLeft}д`}
              </span>
            </motion.div>
          );
        })}
      </div>

      <Modal isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} title="Детали задачи">
        {taskDetail && (
          <div className="space-y-5">
            <div>
              <p className="text-[9px] tracking-widest uppercase text-alabaster-dim mb-2">Задача</p>
              <p className="text-sm text-alabaster leading-relaxed">{taskDetail.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <p className="text-[9px] tracking-widest uppercase text-alabaster-dim mb-2">Тип</p>
                <p className="text-sm text-alabaster">{getTypeLabel(taskDetail.type)}</p>
              </div>
              <div>
                <p className="text-[9px] tracking-widest uppercase text-alabaster-dim mb-2">Дедлайн</p>
                <p className="text-sm text-alabaster">{taskDetail.deadline}</p>
              </div>
            </div>
            <div>
              <p className="text-[9px] tracking-widest uppercase text-alabaster-dim mb-2">Статус</p>
              <span className={`text-xs px-3 py-1.5 rounded-full ${
                taskDetail.completed ? "bg-success/20 text-success" : "bg-brass/20 text-brass"
              }`}>
                {taskDetail.completed ? "Выполнено" : "Ожидание"}
              </span>
            </div>
            {taskDetail.type === "upload" && !taskDetail.completed && (
              <div className="border-t border-navy pt-5">
                <p className="text-[9px] tracking-widest uppercase text-alabaster-dim mb-3">Загрузка файла</p>
                <div className="border-2 border-dashed border-navy rounded-lg p-6 text-center hover:border-brass/50 transition-colors cursor-pointer">
                  <p className="text-xs text-alabaster-dim">Перетащите файл или нажмите для выбора</p>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </motion.section>
  );
}

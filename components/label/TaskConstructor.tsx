"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";
import { useState } from "react";

export default function TaskConstructor() {
  const { state, dispatch } = useApp();
  const [artistId, setArtistId] = useState(state.artists[0]?.id || "");
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [taskType, setTaskType] = useState<"upload" | "sign" | "review" | "promo" | "general">("general");
  const [created, setCreated] = useState(false);

  const typeOptions: { value: typeof taskType; label: string }[] = [
    { value: "general", label: "Общая" },
    { value: "upload", label: "Загрузка" },
    { value: "sign", label: "Подпись" },
    { value: "review", label: "Проверка" },
    { value: "promo", label: "Промо" },
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

  const recentTasks = state.tasks
    .filter((t) => !t.completed)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5);

  const getArtistName = (id: string) =>
    state.artists.find((a) => a.id === id)?.name || "—";

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-navy/30 border border-navy rounded-xl p-7"
    >
      <h3 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-alabaster mb-6">
        Конструктор задач
      </h3>

      <div className="space-y-4">
        <div>
          <label className="text-[9px] tracking-widest uppercase text-alabaster-dim block mb-1.5">
            Артист
          </label>
          <select
            value={artistId}
            onChange={(e) => setArtistId(e.target.value)}
            className="w-full bg-sapphire border border-navy rounded-lg px-4 py-2.5 text-sm text-alabaster focus:outline-none focus:border-brass/50 transition-colors appearance-none cursor-pointer"
          >
            {state.artists.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[9px] tracking-widest uppercase text-alabaster-dim block mb-1.5">
            Задача
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Загрузить финальный мастер"
            className="w-full bg-sapphire border border-navy rounded-lg px-4 py-2.5 text-sm text-alabaster placeholder-alabaster-dim/40 focus:outline-none focus:border-brass/50 transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] tracking-widest uppercase text-alabaster-dim block mb-1.5">
              Тип
            </label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as typeof taskType)}
              className="w-full bg-sapphire border border-navy rounded-lg px-4 py-2.5 text-sm text-alabaster focus:outline-none focus:border-brass/50 transition-colors appearance-none cursor-pointer"
            >
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] tracking-widest uppercase text-alabaster-dim block mb-1.5">
              Дедлайн
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-sapphire border border-navy rounded-lg px-4 py-2.5 text-sm text-alabaster focus:outline-none focus:border-brass/50 transition-colors cursor-pointer [color-scheme:dark]"
            />
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={!title || !deadline}
          className={`
            w-full py-2.5 rounded-lg text-xs font-semibold tracking-widest uppercase transition-all cursor-pointer
            ${title && deadline
              ? "bg-brass text-sapphire hover:bg-brass-dim"
              : "bg-navy/50 text-alabaster-dim cursor-not-allowed"
            }
          `}
        >
          {created ? "✓ Задача создана" : "Назначить задачу"}
        </button>
      </div>

      {recentTasks.length > 0 && (
        <div className="mt-5 pt-5 border-t border-navy/40">
          <p className="text-[9px] tracking-widest uppercase text-alabaster-dim mb-3">
            Ближайшие дедлайны
          </p>
          <div className="space-y-2.5">
            {recentTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 bg-sapphire/40 rounded-lg px-4 py-3">

                <div className="w-5 h-5 rounded-full bg-navy flex items-center justify-center text-[9px] font-bold text-alabaster flex-shrink-0">
                  {getArtistName(task.artistId)[0]}
                </div>
                <span className="text-xs text-alabaster flex-1 truncate">{task.title}</span>
                <span className="text-[9px] text-alabaster-dim flex-shrink-0">{task.deadline}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}

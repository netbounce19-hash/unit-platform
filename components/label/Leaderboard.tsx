"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function Leaderboard() {
  const { state } = useApp();

  const data = state.artists
    .map((a) => ({
      name: a.name,
      streams: a.quarterlyStreams,
      listeners: a.monthlyListeners,
    }))
    .sort((a, b) => b.streams - a.streams);

  const formatStreams = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return n.toString();
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; streams: number; listeners: number } }> }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-sapphire border border-navy rounded-lg p-3 shadow-xl">
          <p className="text-xs font-semibold text-alabaster mb-1">{d.name}</p>
          <p className="text-[10px] text-alabaster-dim">
            Стримы за квартал: <span className="text-brass">{formatStreams(d.streams)}</span>
          </p>
          <p className="text-[10px] text-alabaster-dim">
            Слушателей: <span className="text-brass">{formatStreams(d.listeners)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-navy/30 border border-navy rounded-xl p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[9px] tracking-[0.25em] uppercase text-alabaster-dim mb-1">
            Результаты артистов
          </p>
          <h3 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-alabaster">
            Рейтинг лейбла
          </h3>
        </div>
        <span className="text-[9px] tracking-widest uppercase text-brass">Q3 2026</span>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: "#F7F3E9", fontSize: 11, fontWeight: 500 }}
              axisLine={{ stroke: "#415A77" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatStreams}
              tick={{ fill: "rgba(247,243,233,0.5)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(65,90,119,0.2)" }} />
            <Bar dataKey="streams" radius={[4, 4, 0, 0]} maxBarSize={44}>
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index === 0 ? "#D4AF37" : "#415A77"}
                  opacity={index === 0 ? 1 : 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 space-y-2.5">
        {data.map((artist, i) => (
          <div
            key={artist.name}
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-sapphire/30"
          >
            <span className={`text-sm font-bold w-5 text-center ${i === 0 ? "text-brass" : "text-alabaster-dim"}`}>
              {i + 1}
            </span>
            <div className="w-6 h-6 rounded-full bg-navy flex items-center justify-center text-[10px] font-bold text-alabaster">
              {artist.name[0]}
            </div>
            <span className="text-sm font-medium text-alabaster flex-1">{artist.name}</span>
            <span className="text-xs text-alabaster-dim">{formatStreams(artist.streams)}</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

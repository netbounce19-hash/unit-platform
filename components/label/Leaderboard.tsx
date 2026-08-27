"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { TrendingUp } from "lucide-react";

export default function Leaderboard() {
  const { state } = useApp();
  const [period, setPeriod] = useState<"30d" | "quarter" | "year">("quarter");

  // Sample dynamic multipliers for demonstration of dynamic filtering
  const multiplier = period === "30d" ? 0.35 : period === "quarter" ? 1 : 4.1;

  const data = state.artists
    .map((a, idx) => ({
      name: a.name,
      streams: Math.round(a.quarterlyStreams * multiplier),
      listeners: a.monthlyListeners,
      trend: idx === 0 ? "+18.4%" : idx === 1 ? "+9.2%" : idx === 2 ? "+14.0%" : "-2.1%",
      isPositive: idx !== 3,
    }))
    .sort((a, b) => b.streams - a.streams);

  const formatStreams = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return n.toString();
  };

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{
      payload: {
        name: string;
        streams: number;
        listeners: number;
        trend: string;
        isPositive: boolean;
      };
    }>;
  }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] p-3 shadow-xl min-w-[150px]">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[13px] font-semibold text-[#17161A]">{d.name}</p>
            <span
              className={`text-[10px] font-semibold ${
                d.isPositive ? "text-[#1F9D6B]" : "text-[#A62018]"
              }`}
            >
              {d.trend}
            </span>
          </div>
          <div className="space-y-1 text-[11px] text-[#6E6D73]">
            <div className="flex justify-between">
              <span>Стримы:</span>
              <span className="font-semibold text-[#17161A] tabular-nums">
                {formatStreams(d.streams)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Слушатели:</span>
              <span className="font-semibold text-[#17161A] tabular-nums">
                {formatStreams(d.listeners)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6"
    >
      {/* Header with period switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-[#17161A]">
              Динамика стримов ростера
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1F9D6B] bg-[#E9F6EF] px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3 h-3" strokeWidth={2.5} />
              Рейтинг
            </span>
          </div>
          <p className="text-[13px] text-[#6E6D73] mt-0.5">
            Распределение прослушиваний по артистам
          </p>
        </div>

        {/* Period tabs */}
        <div className="flex items-center bg-[#FAFAF9] border-[0.5px] border-[#ECEAE5] rounded-[12px] p-[3px] self-start sm:self-auto">
          {[
            { key: "30d", label: "30 дней" },
            { key: "quarter", label: "Q3 2026" },
            { key: "year", label: "Год" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setPeriod(t.key as typeof period)}
              className={`px-3 py-1 text-[11.5px] font-medium rounded-full transition-all cursor-pointer ${
                period === t.key
                  ? "bg-white text-[#17161A] shadow-sm font-semibold"
                  : "text-[#A6A5AB] hover:text-[#6E6D73]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bar chart */}
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <XAxis
              dataKey="name"
              tick={{ fill: "#6E6D73", fontSize: 12, fontWeight: 500 }}
              axisLine={{ stroke: "#ECEAE5" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatStreams}
              tick={{ fill: "#A6A5AB", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(23, 22, 26, 0.04)" }}
            />
            <Bar dataKey="streams" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index === 0 ? "#E23A34" : "#17161A"}
                  opacity={index === 0 ? 1 : 0.85 - index * 0.18}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Artists Leaderboard List */}
      <div className="mt-6 pt-5 border-t-[0.5px] border-[#ECEAE5] space-y-2">
        {data.map((artist, i) => (
          <div
            key={artist.name}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] bg-[#FAFAF9] hover:bg-[#F5F4F2] transition"
          >
            <span
              className={`w-6 text-[13px] font-bold text-center ${
                i === 0
                  ? "text-[#E23A34]"
                  : "text-[#6E6D73]"
              }`}
            >
              {i + 1}
            </span>

            <div className="w-8 h-8 rounded-full bg-[#17161A] text-white flex items-center justify-center text-[12px] font-semibold">
              {artist.name[0]}
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-[13.5px] font-semibold text-[#17161A] block truncate">
                {artist.name}
              </span>
              <span className="text-[11px] text-[#A6A5AB]">
                {formatStreams(artist.listeners)} слушателей в мес.
              </span>
            </div>

            <div className="text-right">
              <div className="text-[13.5px] font-semibold text-[#17161A] tabular-nums">
                {formatStreams(artist.streams)}
              </div>
              <div
                className={`text-[10px] font-medium ${
                  artist.isPositive ? "text-[#1F9D6B]" : "text-[#A62018]"
                }`}
              >
                {artist.trend}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

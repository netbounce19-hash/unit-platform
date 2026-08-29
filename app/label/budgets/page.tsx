"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Check,
  X,
  Wallet,
  Clock,
  CheckCircle2,
  Headphones,
  Megaphone,
  Video,
  Newspaper,
  Calendar,
  AlertCircle,
  MessageSquare,
  Sparkles,
  PieChart,
  type LucideIcon,
} from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { panelCls } from "@/components/label/LabelShell";
import {
  fetchBudgets,
  fetchRoster,
  decideBudget,
  budgetStatusLabels,
  formatMoney,
  formatDate,
  type MyOrg,
  type BudgetRow,
  type RosterArtist,
} from "@/lib/supabase/label";
import { SuccessIconControlled } from "@/components/ui/animated-state-icons";

type StatusFilter = "pending" | "approved" | "rejected" | "all";
type CategoryFilter = "all" | "audio" | "promo" | "video" | "pr";

const CATEGORY_MAP: Record<
  string,
  { label: string; icon: LucideIcon; badgeCls: string }
> = {
  audio: {
    label: "Сведение и мастеринг",
    icon: Headphones,
    badgeCls:
      "bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2] border-[#E5E3DE] dark:border-[#33323A]",
  },
  promo: {
    label: "Промо и реклама",
    icon: Megaphone,
    badgeCls:
      "bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2] border-[#D2D0CB] dark:border-[#33323A]",
  },
  video: {
    label: "Музыкальное видео",
    icon: Video,
    badgeCls:
      "bg-[#F4EFFB] dark:bg-[#2D223B] text-[#5E3B8A] dark:text-[#C59BFA] border-[#E6D9F5] dark:border-[#4B3763]",
  },
  pr: {
    label: "PR и пресса",
    icon: Newspaper,
    badgeCls:
      "bg-[#E9F6EF] dark:bg-[#1C3B2E] text-[#166B49] dark:text-[#5FCB9B] border-[#C8EAD8] dark:border-[#2D5A47]",
  },
};

function getCategoryInfo(category: string | null, purpose: string | null) {
  const text = `${category || ""} ${purpose || ""}`.toLowerCase();
  if (text.includes("сведен") || text.includes("мастер") || text.includes("студи")) {
    return CATEGORY_MAP.audio;
  }
  if (text.includes("промо") || text.includes("реклам") || text.includes("таргет") || text.includes("тизер")) {
    return CATEGORY_MAP.promo;
  }
  if (text.includes("видео") || text.includes("клип") || text.includes("съемк") || text.includes("visual")) {
    return CATEGORY_MAP.video;
  }
  if (text.includes("pr") || text.includes("пресс") || text.includes("сми") || text.includes("интервью")) {
    return CATEGORY_MAP.pr;
  }
  return {
    label: category || purpose || "Расходы",
    icon: Wallet,
    badgeCls:
      "bg-[#FAFAF9] dark:bg-[#232227] text-[#6E6D73] dark:text-[#9A98A0] border-[#ECEAE5] dark:border-[#242327]",
  };
}

function getDaysRemaining(neededBy: string | null) {
  if (!neededBy) return null;
  const target = new Date(neededBy);
  const now = new Date();
  const diffTime = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function BudgetsInner({ org }: { org: MyOrg }) {
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [artists, setArtists] = useState<RosterArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [error, setError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, a] = await Promise.all([
        fetchBudgets(org.org_id),
        fetchRoster(org.org_id),
      ]);
      setRows(b);
      setArtists(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить заявки");
    } finally {
      setLoading(false);
    }
  }, [org.org_id]);

  useEffect(() => {
    load();
  }, [load]);

  const nameOf = useMemo(() => {
    const map = new Map(artists.map((a) => [a.id, a.stage_name]));
    return (id: string | null) => (id ? map.get(id) ?? "—" : "—");
  }, [artists]);

  const pendingRows = useMemo(() => rows.filter((r) => r.status === "pending"), [rows]);
  const approvedRows = useMemo(() => rows.filter((r) => r.status === "approved"), [rows]);
  const rejectedRows = useMemo(
    () => rows.filter((r) => r.status === "rejected" || r.status === "declined"),
    [rows]
  );

  const pendingSum = useMemo(
    () => pendingRows.reduce((s, r) => s + Number(r.amount || 0), 0),
    [pendingRows]
  );

  const approvedSum = useMemo(
    () => approvedRows.reduce((s, r) => s + Number(r.amount || 0), 0),
    [approvedRows]
  );

  const totalSum = pendingSum + approvedSum;
  const approvedPct = totalSum > 0 ? Math.round((approvedSum / totalSum) * 100) : 0;

  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === "pending" && r.status !== "pending") return false;
      if (statusFilter === "approved" && r.status !== "approved") return false;
      if (
        statusFilter === "rejected" &&
        r.status !== "rejected" &&
        r.status !== "declined"
      )
        return false;

      if (categoryFilter !== "all") {
        const cat = getCategoryInfo(r.category, r.purpose);
        if (categoryFilter === "audio" && cat.icon !== Headphones) return false;
        if (categoryFilter === "promo" && cat.icon !== Megaphone) return false;
        if (categoryFilter === "video" && cat.icon !== Video) return false;
        if (categoryFilter === "pr" && cat.icon !== Newspaper) return false;
      }

      return true;
    });
  }, [rows, statusFilter, categoryFilter]);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setBusyId(id);
    setError(null);
    try {
      await decideBudget(id, decision, comment);
      if (decision === "approved") {
        setSuccessId(id);
        setTimeout(() => setSuccessId(null), 1500);
      }
      setOpenId(null);
      setComment("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить решение");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <LabelShell
      org={org}
      title="Заявки на финансирование"
      subtitle="Согласование бюджетов на продакшн, маркетинг и промо артистов"
    >
      {error && (
        <div className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] border-[0.5px] border-[#D2D0CB] dark:border-[#33323A] rounded-[12px] px-4 py-3 mb-5 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#E23A34]" />
          <span>{error}</span>
        </div>
      )}

      {/* ── 1. Financial Summary KPI Hero с инфографикой ── */}
      <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[16px] p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* Pending */}
          <div className="bg-[#FAFAF9] dark:bg-[#232227] rounded-[12px] p-3.5 border-[0.5px] border-[#ECEAE5] dark:border-[#2D2C32]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-medium text-[#6E6D73] dark:text-[#9A98A0] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#D97706]" />
                На рассмотрении
              </span>
              <span className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse" />
            </div>
            <div className="text-[22px] font-bold tracking-tight text-[#17161A] dark:text-[#F5F4F2] leading-none mb-1 tabular-nums">
              {formatMoney(pendingSum)}
            </div>
            <div className="text-[11.5px] text-[#8A5A16] dark:text-[#E8B65A] font-medium">
              {pendingRows.length} {pendingRows.length === 1 ? "заявка ждёт" : "заявок ждут"} решения
            </div>
          </div>

          {/* Approved */}
          <div className="bg-[#FAFAF9] dark:bg-[#232227] rounded-[12px] p-3.5 border-[0.5px] border-[#ECEAE5] dark:border-[#2D2C32]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-medium text-[#6E6D73] dark:text-[#9A98A0] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1F9D6B]" />
                Одобрено лейблом
              </span>
              <span className="text-[11px] font-semibold text-[#166B49] dark:text-[#5FCB9B]">
                {approvedPct}%
              </span>
            </div>
            <div className="text-[22px] font-bold tracking-tight text-[#17161A] dark:text-[#F5F4F2] leading-none mb-1 tabular-nums">
              {formatMoney(approvedSum)}
            </div>
            <div className="text-[11.5px] text-[#166B49] dark:text-[#5FCB9B] font-medium">
              {approvedRows.length} профинансировано в ростер
            </div>
          </div>
        </div>

        {/* Инфографическая полоса соотношения бюджетов */}
        {totalSum > 0 && (
          <div className="space-y-1.5 pt-1 border-t-[0.5px] border-[#ECEAE5] dark:border-[#242327]">
            <div className="flex items-center justify-between text-[11px] text-[#6E6D73] dark:text-[#9A98A0]">
              <span>Баланс финансирования ростера</span>
              <span className="font-medium text-[#17161A] dark:text-[#F5F4F2] tabular-nums">
                Всего: {formatMoney(totalSum)}
              </span>
            </div>
            <div className="h-[5px] w-full rounded-full bg-[#ECEAE5] dark:bg-[#242327] overflow-hidden flex">
              <div
                className="h-full bg-[#1F9D6B] dark:bg-[#5FCB9B] transition-all duration-500"
                style={{ width: `${approvedPct}%` }}
                title={`Одобрено: ${approvedPct}%`}
              />
              <div
                className="h-full bg-[#D97706] dark:bg-[#E8B65A] transition-all duration-500"
                style={{ width: `${100 - approvedPct}%` }}
                title={`На рассмотрении: ${100 - approvedPct}%`}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Filters & Status Switcher ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        {/* Status Tabs */}
        <div className="flex items-center bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-[3px] self-start sm:self-auto overflow-x-auto max-w-full">
          {[
            { key: "pending", label: `Ожидают (${pendingRows.length})` },
            { key: "approved", label: `Одобрены (${approvedRows.length})` },
            { key: "rejected", label: `Отклонены (${rejectedRows.length})` },
            { key: "all", label: `Все (${rows.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key as StatusFilter)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-full transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === tab.key
                  ? "bg-[#17161A] text-white dark:bg-[#F5F4F2] dark:text-[#17161A] shadow-xs"
                  : "text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#17161A] dark:hover:text-[#F5F4F2]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: "all", label: "Все статьи", icon: null },
            { key: "audio", label: "Сведение", icon: Headphones },
            { key: "promo", label: "Промо", icon: Megaphone },
            { key: "video", label: "Клипы", icon: Video },
          ].map((cat) => {
            const Icon = cat.icon;
            const isSelected = categoryFilter === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setCategoryFilter(cat.key as CategoryFilter)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full border transition cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? "bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2] border-[#D2D0CB] dark:border-[#33323A]"
                    : "bg-white dark:bg-[#1A191D] text-[#6E6D73] dark:text-[#9A98A0] border-[#ECEAE5] dark:border-[#242327] hover:border-[#D2D0CB]"
                }`}
              >
                {Icon && <Icon className="w-3 h-3" strokeWidth={1.75} />}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. List of Smart Request Cards ── */}
      {loading ? (
        <div className="py-16 flex items-center justify-center text-[#A6A5AB] dark:text-[#6E6D73]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[16px] p-10 text-center text-[13px] text-[#A6A5AB] dark:text-[#6E6D73]">
          {statusFilter === "pending"
            ? "Нет активных заявок, требующих решения"
            : "Заявок по выбранным фильтрам не найдено"}
        </div>
      ) : (
        <div className="space-y-3.5">
          {visible.map((b) => {
            const statusInfo = budgetStatusLabels[b.status] ?? {
              label: b.status,
              cls: "bg-[#F0EEEA] dark:bg-[#232227] text-[#6E6D73] dark:text-[#9A98A0]",
            };
            const categoryInfo = getCategoryInfo(b.category, b.purpose);
            const CategoryIcon = categoryInfo.icon;
            const daysRemaining = getDaysRemaining(b.needed_by);
            const isOpen = openId === b.id;
            const isBusy = busyId === b.id;
            const isSuccess = successId === b.id;

            return (
              <motion.div
                key={b.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[16px] p-5 transition hover:border-[#D2D0CB] dark:hover:border-[#33323A] shadow-xs"
              >
                {/* Header: Artist & Status */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#17161A] dark:bg-[#242327] text-white dark:text-[#F5F4F2] flex items-center justify-center text-[12px] font-semibold shrink-0">
                      {nameOf(b.artist_id)[0]}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/label/artists/${b.artist_id}`}
                        className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] hover:text-[#6E6D73] transition block truncate"
                      >
                        {nameOf(b.artist_id)}
                      </Link>
                      <span className="text-[11px] text-[#A6A5AB] dark:text-[#6E6D73] block">
                        Подана {formatDate(b.created_at)}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0 ${statusInfo.cls}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                    <span>{statusInfo.label}</span>
                  </span>
                </div>

                {/* Body: Amount & Purpose */}
                <div className="bg-[#FAFAF9] dark:bg-[#232227] rounded-[12px] p-3.5 mb-3 border-[0.5px] border-[#ECEAE5] dark:border-[#2D2C32]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="text-[20px] font-semibold text-[#17161A] dark:text-[#F5F4F2] tracking-tight tabular-nums">
                      {formatMoney(b.amount)}
                    </div>
                    <div
                      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border self-start sm:self-auto ${categoryInfo.badgeCls}`}
                    >
                      <CategoryIcon className="w-3 h-3" />
                      <span>{categoryInfo.label}</span>
                    </div>
                  </div>

                  {b.purpose && (
                    <p className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] font-medium leading-snug">
                      {b.purpose}
                    </p>
                  )}

                  {b.comment && (
                    <p className="text-[12px] text-[#6E6D73] dark:text-[#9A98A0] mt-1.5 leading-relaxed">
                      {b.comment}
                    </p>
                  )}
                </div>

                {/* Timing / Urgency info */}
                {b.needed_by && (
                  <div className="flex items-center gap-2 text-[12px] mb-3 px-1">
                    <Calendar className="w-3.5 h-3.5 text-[#6E6D73] dark:text-[#9A98A0]" />
                    <span className="text-[#6E6D73] dark:text-[#9A98A0]">Нужны к: {formatDate(b.needed_by)}</span>
                    {daysRemaining !== null && daysRemaining <= 5 && b.status === "pending" && (
                      <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded bg-[#FDF0EE] dark:bg-[#341B1A] text-[#E23A34] dark:text-[#F87171] flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {daysRemaining <= 0 ? "Срок истёк" : `Осталось ${daysRemaining} дн.`}
                      </span>
                    )}
                  </div>
                )}

                {/* Decision Comment (if already decided) */}
                {b.decision_comment && (
                  <div className="text-[12px] text-[#6E6D73] dark:text-[#9A98A0] bg-[#FAFAF9] dark:bg-[#232227] rounded-[12px] p-2.5 mb-3 border-[0.5px] border-[#ECEAE5] dark:border-[#2D2C32]">
                    <span className="font-semibold text-[#17161A] dark:text-[#F5F4F2]">Решение лейбла: </span>
                    {b.decision_comment}
                  </div>
                )}

                {/* ── Actions for Pending Requests ── */}
                {b.status === "pending" && (
                  <div className="pt-2 border-t-[0.5px] border-[#ECEAE5] dark:border-[#242327]">
                    {isOpen ? (
                      <div className="space-y-2.5">
                        <textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          rows={2}
                          autoFocus
                          placeholder="Комментарий или условия одобрения (опционально)…"
                          className="w-full resize-none text-[12.5px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-2 outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]"
                        />

                        {/* Quick Reason Chips for Rejection */}
                        <div className="flex flex-wrap gap-1.5">
                          {["Лимит квартала", "Нужна доработка демо", "Уточнить смету"].map(
                            (chip) => (
                              <button
                                key={chip}
                                onClick={() => setComment(chip)}
                                className="text-[10.5px] text-[#6E6D73] dark:text-[#9A98A0] bg-[#FAFAF9] dark:bg-[#232227] hover:bg-[#F0EEEA] px-2 py-0.5 rounded-md border border-[#ECEAE5] dark:border-[#33323A] transition cursor-pointer"
                              >
                                {chip}
                              </button>
                            )
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => decide(b.id, "approved")}
                            disabled={isBusy}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 text-[12.5px] font-medium bg-[#1F9D6B] text-white px-[14px] py-[8px] rounded-full hover:brightness-95 transition disabled:opacity-40 cursor-pointer"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                            )}
                            Одобрить финансирование
                          </button>

                          <button
                            onClick={() => decide(b.id, "rejected")}
                            disabled={isBusy}
                            className="inline-flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] border border-[#D2D0CB] dark:border-[#33323A] px-[14px] py-[8px] rounded-full hover:bg-[#E5E3DE] transition disabled:opacity-40 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                            Отклонить
                          </button>

                          <button
                            onClick={() => {
                              setOpenId(null);
                              setComment("");
                            }}
                            className="text-[12px] text-[#A6A5AB] hover:text-[#17161A] px-2 py-2 transition cursor-pointer"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => decide(b.id, "approved")}
                          disabled={isBusy}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 text-[12.5px] font-medium bg-[#17161A] text-white py-2 rounded-full hover:bg-[#2A292E] active:scale-[0.99] transition cursor-pointer"
                        >
                          {isSuccess ? (
                            <>
                              <SuccessIconControlled size={14} color="white" done={true} />
                              Одобрено
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#1F9D6B]" strokeWidth={3} />
                              Быстро одобрить
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setOpenId(b.id);
                            setComment("");
                          }}
                          className="inline-flex items-center justify-center gap-1 text-[12.5px] font-medium text-[#6E6D73] dark:text-[#9A98A0] border border-[#E5E3DE] dark:border-[#33323A] px-[14px] py-[8px] rounded-full hover:bg-[#FAFAF9] dark:hover:bg-[#232227] hover:text-[#17161A] transition cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          С комментарием
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </LabelShell>
  );
}

export default function BudgetsPage() {
  return <LabelGate>{({ org }) => <BudgetsInner org={org} />}</LabelGate>;
}

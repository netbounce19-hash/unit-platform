"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { panelCls } from "@/components/label/LabelShell";
import { fetchRoster, type MyOrg, type RosterArtist } from "@/lib/supabase/label";
import { createStatement, quarterRange } from "@/lib/supabase/royalties";

const inputCls =
  "w-full text-[14px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[10px] outline-none focus:border-[#17161A] transition";
const labelCls = "block text-[12.5px] font-medium text-[#6E6D73] dark:text-[#9A98A0] mb-[6px]";

/** Прошлый квартал — чаще всего отчитываются именно за него. */
function previousQuarter(): { year: number; quarter: number } {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return q === 1 ? { year: d.getFullYear() - 1, quarter: 4 } : { year: d.getFullYear(), quarter: q - 1 };
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function NewStatementInner({ org }: { org: MyOrg }) {
  const router = useRouter();
  const [artists, setArtists] = useState<RosterArtist[]>([]);
  const prev = previousQuarter();
  const [artistId, setArtistId] = useState("");
  const [year, setYear] = useState(prev.year);
  const [quarter, setQuarter] = useState(prev.quarter);
  const [share, setShare] = useState("50");
  const [dueDate, setDueDate] = useState(addDays(quarterRange(prev.year, prev.quarter)[1], 45));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRoster(org.org_id).then(setArtists).catch(() => {});
  }, [org.org_id]);

  // Доля по умолчанию — из условий договора артиста
  const pickArtist = (id: string) => {
    setArtistId(id);
    const pct = artists.find((a) => a.id === id)?.terms?.royalty_pct;
    if (typeof pct === "number") setShare(String(pct));
  };

  const pickPeriod = (y: number, q: number) => {
    setYear(y);
    setQuarter(q);
    setDueDate(addDays(quarterRange(y, q)[1], 45));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sharePct = Number(share.replace(",", "."));
    if (!artistId || !(sharePct >= 0 && sharePct <= 100)) return;
    setBusy(true);
    setError(null);
    try {
      const [start, end] = quarterRange(year, quarter);
      const s = await createStatement({ orgId: org.org_id, artistId, periodStart: start, periodEnd: end, sharePct, dueDate });
      router.push(`/label/royalties/${s.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать отчёт");
      setBusy(false);
    }
  };

  const years = [prev.year + 1, prev.year, prev.year - 1, prev.year - 2];

  return (
    <LabelShell org={org} title="Новый отчёт по роялти" subtitle="Период и доля артиста. Доходы по площадкам добавите на следующем шаге">
      <form onSubmit={submit} className={`${panelCls} p-5 space-y-4 lg:max-w-[560px]`}>
        <label className="block">
          <span className={labelCls}>Артист</span>
          <select value={artistId} onChange={(e) => pickArtist(e.target.value)} className={`${inputCls} cursor-pointer`}>
            <option value="">Выберите артиста</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>{a.stage_name}</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Квартал</span>
            <select value={quarter} onChange={(e) => pickPeriod(year, Number(e.target.value))} className={`${inputCls} cursor-pointer`}>
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>{["I", "II", "III", "IV"][q - 1]} квартал</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Год</span>
            <select value={year} onChange={(e) => pickPeriod(Number(e.target.value), quarter)} className={`${inputCls} cursor-pointer`}>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Доля артиста, %</span>
            <input inputMode="decimal" value={share} onChange={(e) => setShare(e.target.value)} className={inputCls} />
            <span className="block text-[11.5px] text-[#A6A5AB] mt-1">Подставляется из условий договора</span>
          </label>
          <label className="block">
            <span className={labelCls}>Срок выплаты</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </label>
        </div>

        {error && (
          <div className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] rounded-[12px] px-3 py-[9px]">{error}</div>
        )}

        <button
          type="submit"
          disabled={busy || !artistId}
          className="inline-flex items-center justify-center gap-2 bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] font-medium text-[14px] px-[18px] py-[10px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Создать черновик
        </button>
      </form>
    </LabelShell>
  );
}

export default function NewStatementPage() {
  return <LabelGate>{({ org }) => <NewStatementInner org={org} />}</LabelGate>;
}

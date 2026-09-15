import type { MyOrg, ObligationStat } from "@/lib/supabase/label";
import type { StreamStat } from "@/lib/supabase/streamStats";
import type { ArtistScore, Metric } from "@/lib/label/ranking";

/**
 * Отчёт по статистике лейбла в PDF.
 *
 * Собирается в браузере из тех же строк, что показывает /label/stats, —
 * чтобы файл не расходился с экраном. jsPDF грузится только по клику:
 * библиотека тяжёлая, а отчёт нужен не каждый визит.
 *
 * Стандартные шрифты PDF не знают кириллицы, поэтому в документ
 * встраивается Geist (OFL) из /public/fonts — тот же, что в интерфейсе.
 */

const METRIC_LABEL: Record<Metric, string> = {
  efficiency: "эффективности",
  streams: "стримам",
  obligation: "обязательности",
};

const INK: [number, number, number] = [23, 22, 26];
const INK2: [number, number, number] = [110, 109, 115];
const INK3: [number, number, number] = [166, 165, 171];
const LINE: [number, number, number] = [236, 234, 229];
const TINT: [number, number, number] = [250, 250, 249];

async function fontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не удалось загрузить шрифт ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

const fmtInt = (n: number) => n.toLocaleString("ru-RU");

export async function downloadStatsPdf(args: {
  org: MyOrg;
  rows: ArtistScore[];
  obligations: ObligationStat[];
  streams: Map<string, StreamStat>;
  metric: Metric;
}): Promise<void> {
  const { org, rows, obligations, streams, metric } = args;
  const [{ jsPDF }, regular, semibold] = await Promise.all([
    import("jspdf"),
    fontBase64("/fonts/Geist-Regular.ttf"),
    fontBase64("/fonts/Geist-SemiBold.ttf"),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("Geist-Regular.ttf", regular);
  doc.addFont("Geist-Regular.ttf", "Geist", "normal");
  doc.addFileToVFS("Geist-SemiBold.ttf", semibold);
  doc.addFont("Geist-SemiBold.ttf", "Geist", "bold");

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  const now = new Date();
  const dateStr = now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  const text = (
    s: string,
    x: number,
    y: number,
    o: { size?: number; bold?: boolean; color?: [number, number, number]; align?: "left" | "right" | "center" } = {}
  ) => {
    doc.setFont("Geist", o.bold ? "bold" : "normal");
    doc.setFontSize(o.size ?? 9);
    doc.setTextColor(...(o.color ?? INK));
    doc.text(s, x, y, { align: o.align ?? "left" });
  };

  // ── Шапка
  let y = M + 4;
  text("UNIT", M, y, { size: 11, bold: true });
  text(dateStr, W - M, y, { size: 9, color: INK2, align: "right" });
  y += 10;
  text("Статистика артистов", M, y, { size: 18, bold: true });
  y += 6;
  text(`${org.name} · рейтинг по ${METRIC_LABEL[metric]}`, M, y, { size: 10, color: INK2 });
  y += 9;

  // ── Сводка
  const oblByArtist = new Map(obligations.map((o) => [o.artistId, o]));
  const totalStreams = rows.reduce((s, r) => s + r.streams, 0);
  const totalListeners = rows.reduce((s, r) => s + (streams.get(r.artist.id)?.listeners ?? 0), 0);
  const withObl = rows.filter((r) => r.obligationScore !== null);
  const avgObl = withObl.length
    ? Math.round(withObl.reduce((s, r) => s + (r.obligationScore ?? 0), 0) / withObl.length)
    : null;
  const avgEff = rows.length ? Math.round(rows.reduce((s, r) => s + r.efficiency, 0) / rows.length) : 0;

  const tiles: [string, string][] = [
    ["Артистов", String(rows.length)],
    ["Стримы, всего", fmtInt(totalStreams)],
    ["Слушатели в месяц", fmtInt(totalListeners)],
    ["Обязательность, ср.", avgObl === null ? "—" : `${avgObl}%`],
    ["Эффективность, ср.", String(avgEff)],
  ];
  const gap = 3;
  const tw = (W - 2 * M - gap * (tiles.length - 1)) / tiles.length;
  tiles.forEach(([label, value], i) => {
    const x = M + i * (tw + gap);
    doc.setFillColor(...TINT);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, y, tw, 17, 2, 2, "FD");
    text(label, x + 3, y + 5.5, { size: 7, color: INK3 });
    text(value, x + 3, y + 13, { size: 12, bold: true });
  });
  y += 26;

  // ── Таблица рейтинга
  const cols = [
    { title: "#", w: 8, align: "left" as const },
    { title: "Артист", w: 50, align: "left" as const },
    { title: "Стримы", w: 24, align: "right" as const },
    { title: "Слушатели", w: 24, align: "right" as const },
    { title: "Задачи", w: 18, align: "right" as const },
    { title: "Обязат.", w: 18, align: "right" as const },
    { title: "Эффект.", w: 18, align: "right" as const },
    { title: "Просроч.", w: 18, align: "right" as const },
  ];
  const tableW = cols.reduce((s, c) => s + c.w, 0);
  const scale = (W - 2 * M) / tableW;
  cols.forEach((c) => (c.w *= scale));

  const header = () => {
    let x = M;
    cols.forEach((c) => {
      text(c.title, c.align === "right" ? x + c.w - 2 : x + 2, y, { size: 7.5, color: INK3, align: c.align });
      x += c.w;
    });
    y += 2.5;
    doc.setDrawColor(...LINE);
    doc.line(M, y, W - M, y);
    y += 5.5;
  };
  header();

  const ROW_H = 8;
  rows.forEach((r, i) => {
    if (y > H - M - 22) {
      doc.addPage();
      y = M + 6;
      header();
    }
    const o = oblByArtist.get(r.artist.id);
    const listeners = streams.get(r.artist.id)?.listeners;
    const name = doc.splitTextToSize(r.artist.stage_name, cols[1].w - 4)[0] as string;
    const cells = [
      String(i + 1),
      name,
      streams.has(r.artist.id) ? fmtInt(r.streams) : "—",
      listeners === undefined ? "—" : fmtInt(listeners),
      o ? `${o.done} из ${o.total}` : "—",
      r.obligationScore === null ? "—" : `${r.obligationScore}%`,
      String(r.efficiency),
      r.artist.overdueTasks ? String(r.artist.overdueTasks) : "—",
    ];
    let x = M;
    cells.forEach((cell, ci) => {
      const c = cols[ci];
      text(cell, c.align === "right" ? x + c.w - 2 : x + 2, y, {
        size: 9,
        bold: ci === 1 || ci === 6,
        color: ci === 0 ? INK3 : INK,
        align: c.align,
      });
      x += c.w;
    });
    doc.setDrawColor(...LINE);
    doc.line(M, y + 3, W - M, y + 3);
    y += ROW_H;
  });

  if (rows.length === 0) {
    text("В ростере пока нет артистов", M, y, { color: INK3 });
    y += ROW_H;
  }

  // ── Как считается
  y += 6;
  if (y > H - M - 24) {
    doc.addPage();
    y = M + 6;
  }
  text("Как считается", M, y, { size: 9, bold: true });
  y += 5;
  const notes = [
    "Стримы и слушатели — цифры, которые менеджер внёс в «Загрузке данных».",
    "Обязательность — доля выполненных задач от всех, поставленных артисту.",
    "Эффективность — 60% стримов, нормированных по лучшему артисту ростера, и 40% обязательности; без задач — только стримы.",
  ];
  notes.forEach((n) => {
    const lines = doc.splitTextToSize(n, W - 2 * M) as string[];
    lines.forEach((l) => {
      text(l, M, y, { size: 8, color: INK2 });
      y += 4;
    });
  });

  // ── Номера страниц
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    text(`${org.name} · UNIT`, M, H - 8, { size: 7, color: INK3 });
    text(`${p} / ${pages}`, W - M, H - 8, { size: 7, color: INK3, align: "right" });
  }

  const slug = now.toISOString().slice(0, 10);
  doc.save(`unit-stats-${slug}.pdf`);
}

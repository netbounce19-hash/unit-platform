import type { MyOrg, ObligationStat } from "@/lib/supabase/label";
import type { StreamStat } from "@/lib/supabase/streamStats";
import type { ArtistScore, Metric } from "@/lib/label/ranking";
import { createPdf, fmtInt, INK, INK2, INK3, LINE, TINT } from "@/lib/pdf/base";

/**
 * Отчёт по статистике лейбла в PDF.
 *
 * Собирается в браузере из тех же строк, что показывает /label/stats, —
 * чтобы файл не расходился с экраном.
 */

const METRIC_LABEL: Record<Metric, string> = {
  efficiency: "эффективности",
  streams: "стримам",
  obligation: "выполнению задач",
};

export async function downloadStatsPdf(args: {
  org: MyOrg;
  rows: ArtistScore[];
  obligations: ObligationStat[];
  streams: Map<string, StreamStat>;
  metric: Metric;
}): Promise<void> {
  const { org, rows, obligations, streams, metric } = args;
  const { doc, W, H, M, text, footer } = await createPdf();
  const now = new Date();
  const dateStr = now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

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
    ["Выполнение задач, ср.", avgObl === null ? "—" : `${avgObl}%`],
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
    { title: "Выполн.", w: 18, align: "right" as const },
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
    "Выполнение задач — доля закрытых задач от всех, поставленных артисту.",
    "Эффективность — 60% стримов, нормированных по лучшему артисту ростера, и 40% выполнения задач; без задач — только стримы.",
  ];
  notes.forEach((n) => {
    const lines = doc.splitTextToSize(n, W - 2 * M) as string[];
    lines.forEach((l) => {
      text(l, M, y, { size: 8, color: INK2 });
      y += 4;
    });
  });

  footer(`${org.name} · UNIT`);

  const slug = now.toISOString().slice(0, 10);
  doc.save(`unit-stats-${slug}.pdf`);
}

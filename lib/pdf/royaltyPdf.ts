import { createPdf, fmtInt, INK, INK2, INK3, LINE, TINT } from "@/lib/pdf/base";
import { fmtPeriod, fmtRub, statementLabels, type RoyaltyLine, type RoyaltyStatement } from "@/lib/supabase/royalties";

/**
 * Отчёт по роялти за период — один и тот же файл у лейбла и у артиста.
 * Цифры берутся из строки отчёта, посчитанной базой, а не пересчитываются
 * здесь: иначе PDF мог бы разойтись с кабинетом.
 */
export async function downloadRoyaltyPdf(args: {
  statement: RoyaltyStatement;
  lines: RoyaltyLine[];
  artistName: string;
  labelName: string;
  advanceRemaining?: number;
}): Promise<void> {
  const { statement: s, lines, artistName, labelName, advanceRemaining } = args;
  const { doc, W, H, M, text, footer } = await createPdf();

  const period = fmtPeriod(s.period_start, s.period_end);
  const dateStr = (iso: string) =>
    new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  // ── Шапка
  let y = M + 4;
  text("UNIT", M, y, { size: 11, bold: true });
  text(statementLabels[s.status].label, W - M, y, { size: 9, color: INK2, align: "right" });
  y += 10;
  text("Отчёт по роялти", M, y, { size: 18, bold: true });
  y += 6;
  text(`${artistName} · ${labelName} · ${period}`, M, y, { size: 10, color: INK2 });
  y += 10;

  // ── Итог к выплате
  doc.setFillColor(...TINT);
  doc.setDrawColor(...LINE);
  doc.roundedRect(M, y, W - 2 * M, 22, 2, 2, "FD");
  text("К выплате артисту", M + 5, y + 8, { size: 8, color: INK3 });
  text(fmtRub(s.payout), M + 5, y + 17, { size: 16, bold: true });
  const right = [
    s.due_date ? `Срок выплаты: ${dateStr(s.due_date)}` : "Срок выплаты не указан",
    s.paid_at ? `Выплачено: ${dateStr(s.paid_at)}` : s.published_at ? `Опубликован: ${dateStr(s.published_at)}` : "",
  ].filter(Boolean);
  right.forEach((l, i) => text(l, W - M - 5, y + 9 + i * 6, { size: 8.5, color: INK2, align: "right" }));
  y += 32;

  // ── Доходы по площадкам
  text("Доходы по площадкам", M, y, { size: 10, bold: true });
  y += 7;
  const cols = [
    { title: "Площадка", x: M + 2, align: "left" as const },
    { title: "Прослушивания", x: W - M - 50, align: "right" as const },
    { title: "Доход", x: W - M - 2, align: "right" as const },
  ];
  cols.forEach((c) => text(c.title, c.x, y, { size: 7.5, color: INK3, align: c.align }));
  y += 2.5;
  doc.setDrawColor(...LINE);
  doc.line(M, y, W - M, y);
  y += 5.5;

  lines.forEach((l) => {
    if (y > H - M - 60) {
      doc.addPage();
      y = M + 6;
    }
    text(l.source, cols[0].x, y, { size: 9 });
    text(l.streams ? fmtInt(l.streams) : "—", cols[1].x, y, { size: 9, align: "right" });
    text(fmtRub(l.revenue), cols[2].x, y, { size: 9, align: "right" });
    doc.line(M, y + 3, W - M, y + 3);
    y += 8;
  });
  if (lines.length === 0) {
    text("Строк дохода нет", M + 2, y, { size: 9, color: INK3 });
    y += 8;
  }

  // ── Расчёт
  y += 6;
  if (y > H - M - 60) {
    doc.addPage();
    y = M + 6;
  }
  text("Расчёт", M, y, { size: 10, bold: true });
  y += 8;
  const rows: [string, string, boolean?][] = [
    ["Доход за период", fmtRub(s.gross)],
    [`Доля артиста, ${String(s.share_pct).replace(".", ",")}%`, fmtRub(s.royalty)],
    ["Удержания", s.deductions ? `− ${fmtRub(s.deductions)}` : "—"],
    ["Зачёт аванса", s.recouped ? `− ${fmtRub(s.recouped)}` : "—"],
    ["К выплате", fmtRub(s.payout), true],
  ];
  rows.forEach(([label, value, strong]) => {
    if (strong) {
      doc.setDrawColor(...INK);
      doc.line(M, y - 5, W - M, y - 5);
    }
    text(label, M + 2, y, { size: strong ? 10 : 9, bold: strong, color: strong ? INK : INK2 });
    text(value, W - M - 2, y, { size: strong ? 10 : 9, bold: strong, align: "right" });
    y += 7;
  });

  if (advanceRemaining !== undefined) {
    y += 2;
    text(`Остаток аванса после зачёта: ${fmtRub(advanceRemaining)}`, M + 2, y, { size: 8.5, color: INK2 });
    y += 6;
  }

  if (s.note) {
    y += 4;
    text("Комментарий лейбла", M, y, { size: 9, bold: true });
    y += 5;
    (doc.splitTextToSize(s.note, W - 2 * M) as string[]).forEach((l) => {
      text(l, M, y, { size: 8.5, color: INK2 });
      y += 4.5;
    });
  }

  footer(`${artistName} · ${labelName} · UNIT`);
  doc.save(`royalty-${artistName.replace(/[^\p{L}\p{N}]+/gu, "-")}-${s.period_start}.pdf`);
}

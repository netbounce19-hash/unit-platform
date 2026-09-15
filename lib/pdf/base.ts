import type { jsPDF as JsPDF } from "jspdf";

/**
 * Общая основа PDF-документов UNIT: A4, шрифт Geist с кириллицей, палитра
 * интерфейса и помощник для текста.
 *
 * jsPDF грузится только при вызове — библиотека тяжёлая, а документы нужны
 * не каждый визит. Стандартные шрифты PDF не знают кириллицы, поэтому Geist
 * (OFL, лицензия рядом) встраивается из /public/fonts.
 */

export type Rgb = [number, number, number];

export const INK: Rgb = [23, 22, 26];
export const INK2: Rgb = [110, 109, 115];
export const INK3: Rgb = [166, 165, 171];
export const LINE: Rgb = [236, 234, 229];
export const TINT: Rgb = [250, 250, 249];

export interface TextOpts {
  size?: number;
  bold?: boolean;
  color?: Rgb;
  align?: "left" | "right" | "center";
}

export interface PdfCanvas {
  doc: JsPDF;
  /** ширина и высота страницы, поле */
  W: number;
  H: number;
  M: number;
  text: (s: string, x: number, y: number, o?: TextOpts) => void;
  /** Номера страниц и подпись внизу каждой. */
  footer: (caption: string) => void;
}

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

export async function createPdf(): Promise<PdfCanvas> {
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

  const text = (s: string, x: number, y: number, o: TextOpts = {}) => {
    doc.setFont("Geist", o.bold ? "bold" : "normal");
    doc.setFontSize(o.size ?? 9);
    doc.setTextColor(...(o.color ?? INK));
    doc.text(s, x, y, { align: o.align ?? "left" });
  };

  const footer = (caption: string) => {
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      text(caption, M, H - 8, { size: 7, color: INK3 });
      text(`${p} / ${pages}`, W - M, H - 8, { size: 7, color: INK3, align: "right" });
    }
  };

  return { doc, W, H, M, text, footer };
}

export const fmtInt = (n: number) => n.toLocaleString("ru-RU");

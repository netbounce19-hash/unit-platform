export type ArtistStatus = "contract" | "independent";

export interface ArtistProfile {
  name: string;
  photo: string | null; // object URL или путь
  bio: string;
  listeners: number; // ежемесячные слушатели
  status: ArtistStatus;
}

export const defaultProfile: ArtistProfile = {
  name: "Артист",
  photo: null,
  bio: "",
  listeners: 0,
  status: "contract",
};

/** Дата окончания договора */
export const CONTRACT_UNTIL = "31.12.2030";
export const CONTRACT_PDF = "/docs/unit-artist-agreement-kxde.pdf";

/** Цель по слушателям из утверждённой стратегии */
export const LISTENERS_GOAL = 100_000;

/** 65000 → «65k», 1200000 → «1.2M» */
export function formatListeners(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

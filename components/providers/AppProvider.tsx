"use client";

import React, { createContext, useContext, useReducer, ReactNode } from "react";

// ── Types ──────────────────────────────────────────────────

export type Role = "artist" | "label";

export interface Artist {
  id: string;
  name: string;
  avatar: string;
  monthlyListeners: number;
  quarterlyStreams: number;
}

export interface Release {
  id: string;
  title: string;
  artistId: string;
  deadline: string;
  status: "demos" | "production" | "promo" | "released";
  genre: string;
}

export interface Task {
  id: string;
  title: string;
  artistId: string;
  releaseId?: string;
  deadline: string;
  completed: boolean;
  type: "upload" | "sign" | "review" | "promo" | "general";
}

export interface DopamineTarget {
  artistId: string;
  metric: string;
  current: number;
  goal: number;
}

export type BudgetStatus = "locked" | "pending" | "approved" | "declined";

export interface BudgetRequest {
  id: string;
  artistId: string;
  amount: number;
  purpose: string;
  status: BudgetStatus;
  tier: "low" | "mid" | "high";
  unlockThreshold: number;
  createdAt: string;
}

export interface UploadedFile {
  id: string;
  artistId: string;
  name: string;
  type: "demo" | "master" | "cover" | "lyric";
  uploadedAt: string;
  depositionHash?: string;
  size: string;
}

export interface PromoSubmission {
  id: string;
  artistId: string;
  platform: string;
  link: string;
  screenshotName: string;
  submittedAt: string;
  reviewed: boolean;
}

export interface AppState {
  role: Role;
  currentArtistId: string;
  artists: Artist[];
  releases: Release[];
  tasks: Task[];
  targets: DopamineTarget[];
  budgets: BudgetRequest[];
  uploads: UploadedFile[];
  promos: PromoSubmission[];
}

// ── Actions ────────────────────────────────────────────────

type Action =
  | { type: "SET_ROLE"; payload: Role }
  | { type: "TOGGLE_TASK"; payload: string }
  | { type: "ADD_TASK"; payload: Omit<Task, "id"> }
  | { type: "ADD_UPLOAD"; payload: Omit<UploadedFile, "id"> }
  | { type: "REQUEST_BUDGET"; payload: Omit<BudgetRequest, "id" | "createdAt"> }
  | { type: "UPDATE_BUDGET_STATUS"; payload: { id: string; status: BudgetStatus } }
  | { type: "SET_TARGET"; payload: { artistId: string; goal: number } }
  | { type: "MOVE_RELEASE"; payload: { id: string; status: Release["status"] } }
  | { type: "ADD_PROMO"; payload: Omit<PromoSubmission, "id"> }
  | { type: "REVIEW_PROMO"; payload: string };

// ── Mock Data ──────────────────────────────────────────────

const mockArtists: Artist[] = [
  { id: "a1", name: "KXDE", avatar: "K", monthlyListeners: 65000, quarterlyStreams: 1200000 },
  { id: "a2", name: "NOVA", avatar: "N", monthlyListeners: 42000, quarterlyStreams: 890000 },
  { id: "a3", name: "ZEPHYR", avatar: "Z", monthlyListeners: 98000, quarterlyStreams: 2100000 },
  { id: "a4", name: "MRVL", avatar: "M", monthlyListeners: 23000, quarterlyStreams: 450000 },
];


const mockReleases: Release[] = [
  { id: "r1", title: "MIDNIGHT PROTOCOL", artistId: "a1", deadline: "2026-07-15", status: "production", genre: "Electronic" },
  { id: "r2", title: "STATIC BLOOM", artistId: "a2", deadline: "2026-07-22", status: "demos", genre: "Alt R&B" },
  { id: "r3", title: "THERMAL", artistId: "a3", deadline: "2026-08-01", status: "promo", genre: "Hyperpop" },
  { id: "r4", title: "PHANTOM SIGNAL", artistId: "a1", deadline: "2026-08-10", status: "demos", genre: "Electronic" },
  { id: "r5", title: "LOW ORBIT", artistId: "a4", deadline: "2026-07-30", status: "production", genre: "Ambient" },
  { id: "r6", title: "SEROTONIN", artistId: "a3", deadline: "2026-06-20", status: "released", genre: "Hyperpop" },
];

const mockTasks: Task[] = [
  { id: "t1", title: "Загрузить демо для MIDNIGHT PROTOCOL", artistId: "a1", releaseId: "r1", deadline: "2026-07-10", completed: false, type: "upload" },
  { id: "t2", title: "Подписать дистрибьюторский договор", artistId: "a1", deadline: "2026-07-12", completed: false, type: "sign" },
  { id: "t3", title: "Проверить финальный мастер", artistId: "a1", releaseId: "r1", deadline: "2026-07-14", completed: true, type: "review" },
  { id: "t4", title: "Загрузить обложку альбома", artistId: "a1", releaseId: "r4", deadline: "2026-07-20", completed: false, type: "upload" },
  { id: "t5", title: "Загрузить вокальные стемы", artistId: "a2", releaseId: "r2", deadline: "2026-07-18", completed: false, type: "upload" },
  { id: "t6", title: "Утвердить финальный микс", artistId: "a3", releaseId: "r3", deadline: "2026-07-25", completed: false, type: "review" },
  { id: "t7", title: "Опубликовать промо-ролик в TikTok", artistId: "a1", deadline: "2026-07-11", completed: false, type: "promo" },
  { id: "t8", title: "Сдать тексты на регистрацию", artistId: "a4", releaseId: "r5", deadline: "2026-07-28", completed: false, type: "upload" },
];

const mockTargets: DopamineTarget[] = [
  { artistId: "a1", metric: "Слушатели в месяц", current: 65000, goal: 100000 },
  { artistId: "a2", metric: "Слушатели в месяц", current: 42000, goal: 75000 },
  { artistId: "a3", metric: "Слушатели в месяц", current: 98000, goal: 150000 },
  { artistId: "a4", metric: "Слушатели в месяц", current: 23000, goal: 50000 },
];

const mockBudgets: BudgetRequest[] = [
  { id: "b1", artistId: "a1", amount: 25000, purpose: "Сведение и мастеринг", status: "pending", tier: "low", unlockThreshold: 0, createdAt: "2026-07-01" },
  { id: "b2", artistId: "a1", amount: 350000, purpose: "Музыкальное видео", status: "locked", tier: "high", unlockThreshold: 100000, createdAt: "2026-07-02" },
  { id: "b3", artistId: "a1", amount: 80000, purpose: "Промо-кампания", status: "approved", tier: "mid", unlockThreshold: 50000, createdAt: "2026-06-28" },
  { id: "b4", artistId: "a3", amount: 200000, purpose: "Музыкальное видео", status: "pending", tier: "mid", unlockThreshold: 0, createdAt: "2026-07-03" },
  { id: "b5", artistId: "a2", amount: 25000, purpose: "Сведение и мастеринг", status: "pending", tier: "low", unlockThreshold: 0, createdAt: "2026-07-04" },
];

const mockUploads: UploadedFile[] = [
  { id: "u1", artistId: "a1", name: "midnight_protocol_demo_v2.wav", type: "demo", uploadedAt: "2026-07-05T14:30:00Z", size: "24.3 MB" },
  { id: "u2", artistId: "a1", name: "midnight_cover_final.png", type: "cover", uploadedAt: "2026-07-04T10:15:00Z", size: "4.1 MB" },
];

const mockPromos: PromoSubmission[] = [
  { id: "p1", artistId: "a1", platform: "TikTok", link: "https://tiktok.com/@kxde/video/123456", screenshotName: "tiktok_promo_01.png", submittedAt: "2026-07-05T16:00:00Z", reviewed: false },
  { id: "p2", artistId: "a3", platform: "Instagram Reels", link: "https://instagram.com/reel/abc123", screenshotName: "ig_reel_thermal.png", submittedAt: "2026-07-04T12:00:00Z", reviewed: true },
];

// ── Initial State ──────────────────────────────────────────

const initialState: AppState = {
  role: "artist",
  currentArtistId: "a1",
  artists: mockArtists,
  releases: mockReleases,
  tasks: mockTasks,
  targets: mockTargets,
  budgets: mockBudgets,
  uploads: mockUploads,
  promos: mockPromos,
};

// ── Reducer ────────────────────────────────────────────────

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_ROLE":
      return { ...state, role: action.payload };

    case "TOGGLE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload ? { ...t, completed: !t.completed } : t
        ),
      };

    case "ADD_TASK":
      return {
        ...state,
        tasks: [...state.tasks, { ...action.payload, id: `t${Date.now()}` }],
      };

    case "ADD_UPLOAD": {
      const newUpload: UploadedFile = {
        ...action.payload,
        id: `u${Date.now()}`,
      };
      return { ...state, uploads: [...state.uploads, newUpload] };
    }

    case "REQUEST_BUDGET":
      return {
        ...state,
        budgets: [
          ...state.budgets,
          { ...action.payload, id: `b${Date.now()}`, createdAt: new Date().toISOString().split("T")[0] },
        ],
      };

    case "UPDATE_BUDGET_STATUS":
      return {
        ...state,
        budgets: state.budgets.map((b) =>
          b.id === action.payload.id ? { ...b, status: action.payload.status } : b
        ),
      };

    case "SET_TARGET":
      return {
        ...state,
        targets: state.targets.map((t) =>
          t.artistId === action.payload.artistId
            ? { ...t, goal: action.payload.goal }
            : t
        ),
      };

    case "MOVE_RELEASE":
      return {
        ...state,
        releases: state.releases.map((r) =>
          r.id === action.payload.id ? { ...r, status: action.payload.status } : r
        ),
      };

    case "ADD_PROMO":
      return {
        ...state,
        promos: [...state.promos, { ...action.payload, id: `p${Date.now()}` }],
      };

    case "REVIEW_PROMO":
      return {
        ...state,
        promos: state.promos.map((p) =>
          p.id === action.payload ? { ...p, reviewed: true } : p
        ),
      };

    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────────

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}

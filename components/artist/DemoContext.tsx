"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export interface DemoTrack {
  id: string;
  title: string;
  src: string; // audio URL (путь или blob)
  gradient: string; // запасная обложка
  image: string | null; // обложка-изображение
}

const GRADIENTS = [
  "linear-gradient(135deg,#E23A34,#8b1e1a)",
  "linear-gradient(135deg,#415A77,#17161A)",
  "linear-gradient(135deg,#8A5A16,#3a2606)",
  "linear-gradient(135deg,#1F9D6B,#0d3d2a)",
  "linear-gradient(135deg,#6E4AA6,#241640)",
  "linear-gradient(135deg,#4e6a8a,#17161A)",
];

// У нового артиста демо ещё нет — добавляются на странице «Редактировать».
const defaultDemos: DemoTrack[] = [];

interface DemoContextValue {
  demos: DemoTrack[];
  addDemo: (file: File, title?: string) => void;
  removeDemo: (id: string) => void;
  replaceAudio: (id: string, file: File) => void;
  setImage: (id: string, file: File) => void;
  updateTitle: (id: string, title: string) => void;
  moveDemo: (id: string, dir: -1 | 1) => void;
}

const DemoContext = createContext<DemoContextValue | undefined>(undefined);

let seq = 100;
const nextId = () => `d${++seq}`;

export function DemoProvider({ children }: { children: ReactNode }) {
  const [demos, setDemos] = useState<DemoTrack[]>(defaultDemos);

  const addDemo = (file: File, title?: string) =>
    setDemos((prev) => [
      {
        id: nextId(),
        title: title?.trim() || file.name.replace(/\.[^.]+$/, ""),
        src: URL.createObjectURL(file),
        gradient: GRADIENTS[prev.length % GRADIENTS.length],
        image: null,
      },
      ...prev,
    ]);

  const removeDemo = (id: string) =>
    setDemos((prev) => prev.filter((d) => d.id !== id));

  const replaceAudio = (id: string, file: File) =>
    setDemos((prev) =>
      prev.map((d) => (d.id === id ? { ...d, src: URL.createObjectURL(file) } : d))
    );

  const setImage = (id: string, file: File) =>
    setDemos((prev) =>
      prev.map((d) => (d.id === id ? { ...d, image: URL.createObjectURL(file) } : d))
    );

  const updateTitle = (id: string, title: string) =>
    setDemos((prev) => prev.map((d) => (d.id === id ? { ...d, title } : d)));

  const moveDemo = (id: string, dir: -1 | 1) =>
    setDemos((prev) => {
      const i = prev.findIndex((d) => d.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  return (
    <DemoContext.Provider
      value={{ demos, addDemo, removeDemo, replaceAudio, setImage, updateTitle, moveDemo }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemos() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemos must be used within DemoProvider");
  return ctx;
}

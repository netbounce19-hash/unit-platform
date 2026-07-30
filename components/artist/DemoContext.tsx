"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { getSupabase } from "@/lib/supabase/client";
import {
  listDemos,
  addDemo as addDemoApi,
  removeDemo as removeDemoApi,
  renameDemo,
  replaceDemoAudio,
  setDemoCover,
  moveDemo as moveDemoApi,
  type Demo,
} from "@/lib/supabase/demos";

// Тип оставляем совместимым с прежним (image зарезервирован, сейчас всегда null).
export type DemoTrack = Demo;

interface DemoContextValue {
  demos: DemoTrack[];
  loading: boolean;
  refresh: () => Promise<void>;
  addDemo: (file: File, onProgress?: (p: number) => void) => Promise<void>;
  removeDemo: (id: string) => Promise<void>;
  replaceAudio: (id: string, file: File) => Promise<void>;
  updateTitle: (id: string, title: string) => Promise<void>;
  setImage: (id: string, file: File) => Promise<void>;
  moveDemo: (id: string, dir: -1 | 1) => Promise<void>;
}

const DemoContext = createContext<DemoContextValue | undefined>(undefined);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [demos, setDemos] = useState<DemoTrack[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setDemos(await listDemos());
    } catch {
      /* не залогинен / сеть — оставляем пусто */
    } finally {
      setLoading(false);
    }
  }, []);

  // Провайдер живёт в корневом layout и монтируется до входа, поэтому
  // перезапрашиваем список при каждой смене сессии, а не только на маунте.
  useEffect(() => {
    refresh();

    let supabase;
    try {
      supabase = getSupabase();
    } catch {
      return; // Supabase не настроен — списка просто не будет
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [refresh]);

  const addDemo = useCallback(
    async (file: File, onProgress?: (p: number) => void) => {
      await addDemoApi(file, onProgress);
      await refresh();
    },
    [refresh]
  );

  const removeDemo = useCallback(
    async (id: string) => {
      setDemos((prev) => prev.filter((d) => d.id !== id)); // оптимистично
      try {
        await removeDemoApi(id);
      } finally {
        await refresh();
      }
    },
    [refresh]
  );

  const replaceAudio = useCallback(
    async (id: string, file: File) => {
      await replaceDemoAudio(id, file);
      await refresh();
    },
    [refresh]
  );

  const updateTitle = useCallback(
    async (id: string, title: string) => {
      // оптимистично, чтобы поле не «моргало»
      setDemos((prev) => prev.map((d) => (d.id === id ? { ...d, title } : d)));
      await renameDemo(id, title);
    },
    []
  );

  const setImage = useCallback(
    async (id: string, file: File) => {
      await setDemoCover(id, file);
      await refresh();
    },
    [refresh]
  );

  const moveDemo = useCallback(
    async (id: string, dir: -1 | 1) => {
      // оптимистично меняем местами, чтобы не ждать круг до сервера
      setDemos((prev) => {
        const i = prev.findIndex((d) => d.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
      await moveDemoApi(id, dir);
      await refresh();
    },
    [refresh]
  );

  return (
    <DemoContext.Provider
      value={{ demos, loading, refresh, addDemo, removeDemo, replaceAudio, updateTitle, setImage, moveDemo }}
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

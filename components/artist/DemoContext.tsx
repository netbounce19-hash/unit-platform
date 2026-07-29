"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { getSupabase } from "@/lib/supabase/client";
import {
  listDemos,
  addDemo as addDemoApi,
  removeDemo as removeDemoApi,
  renameDemo,
  replaceDemoAudio,
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

  return (
    <DemoContext.Provider
      value={{ demos, loading, refresh, addDemo, removeDemo, replaceAudio, updateTitle }}
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

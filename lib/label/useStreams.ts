"use client";

import { useSyncExternalStore } from "react";
import { getAllStreams, subscribeStreams } from "./mockStreams";

/** Реактивная подписка на mock-хранилище стримов (см. mockStreams.ts). */
export function useStreams() {
  return useSyncExternalStore(
    subscribeStreams,
    () => getAllStreams(),
    () => getAllStreams()
  );
}

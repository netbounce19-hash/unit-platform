"use client";

import { useSyncExternalStore } from "react";
import { getBlacklist, subscribeBlacklist } from "./mockBlacklist";

export function useBlacklist(): Set<string> {
  return useSyncExternalStore(subscribeBlacklist, getBlacklist, getBlacklist);
}

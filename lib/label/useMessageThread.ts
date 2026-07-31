"use client";

import { useSyncExternalStore } from "react";
import { getThread, subscribeMessages, type Message } from "./mockMessages";

const EMPTY: Message[] = [];

export function useMessageThread(artistId: string | null): Message[] {
  return useSyncExternalStore(
    subscribeMessages,
    () => (artistId ? getThread(artistId) : EMPTY),
    () => (artistId ? getThread(artistId) : EMPTY)
  );
}

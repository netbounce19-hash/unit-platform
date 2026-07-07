"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";

export default function RoleToggle() {
  const { state, dispatch } = useApp();

  return (
    <div className="flex items-center gap-1 bg-navy/40 rounded-lg p-1">
      {(["artist", "label"] as const).map((role) => (
        <button
          key={role}
          onClick={() => dispatch({ type: "SET_ROLE", payload: role })}
          className="relative px-5 py-2 rounded-md text-xs font-semibold tracking-[0.2em] uppercase transition-colors cursor-pointer"
        >
          {state.role === role && (
            <motion.div
              layoutId="role-indicator"
              className="absolute inset-0 bg-brass rounded-md"
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            />
          )}
          <span
            className={`relative z-10 text-xs font-semibold tracking-[0.15em] uppercase ${
              state.role === role ? "text-sapphire" : "text-alabaster-dim hover:text-alabaster"
            }`}
          >
            {role === "artist" ? "Артист" : "Лейбл"}
          </span>

        </button>
      ))}
    </div>
  );
}

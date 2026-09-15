"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";

export default function RoleToggle() {
  const { state, dispatch } = useApp();

  return (
    <div className="flex items-center gap-1 bg-[#F0EEEA] rounded-full p-1 border border-[#ECEAE5]">
      {(["artist", "label"] as const).map((role) => (
        <button
          key={role}
          onClick={() => dispatch({ type: "SET_ROLE", payload: role })}
          className="relative px-4 py-1.5 rounded-full text-xs font-medium tracking-wide transition-colors cursor-pointer"
        >
          {state.role === role && (
            <motion.div
              layoutId="role-indicator"
              className="absolute inset-0 bg-white rounded-full shadow-sm"
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            />
          )}
          <span
            className={`relative z-10 text-[12px] font-medium transition-colors ${
              state.role === role ? "text-[#17161A] font-semibold" : "text-[#6E6D73] hover:text-[#17161A]"
            }`}
          >
            {role === "artist" ? "Артист" : "Лейбл"}
          </span>
        </button>
      ))}
    </div>
  );
}

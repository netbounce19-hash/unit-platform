"use client";

import { useApp } from "@/components/providers/AppProvider";
import RoleToggle from "@/components/shared/RoleToggle";
import ArtistDashboard from "@/components/artist/ArtistDashboard";
import LabelDashboard from "@/components/label/LabelDashboard";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const { state } = useApp();
  const currentArtist = state.artists.find((a) => a.id === state.currentArtistId);

  return (
    <div className="min-h-screen bg-sapphire">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-sapphire/95 backdrop-blur-md border-b border-navy/40">
        <div className="layout-container">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold tracking-[0.35em] text-alabaster">
                UNIT
              </h1>
              <div className="hidden sm:block h-3.5 w-px bg-navy" />
              <span className="hidden sm:block text-[9px] tracking-[0.25em] uppercase text-alabaster-dim">
                {state.role === "artist" ? "Режим фокуса" : "Центр управления"}
              </span>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* Artist indicator */}
              {state.role === "artist" && currentArtist && (
                <div className="hidden md:flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-brass flex items-center justify-center text-[10px] font-bold text-sapphire">
                    {currentArtist.avatar}
                  </div>
                  <span className="text-xs text-alabaster-dim">{currentArtist.name}</span>
                </div>
              )}
              <RoleToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="layout-container py-7">
        <AnimatePresence mode="wait">
          {state.role === "artist" ? (
            <motion.div
              key="artist"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.25 }}
            >
              <ArtistDashboard />
            </motion.div>
          ) : (
            <motion.div
              key="label"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
            >
              <LabelDashboard />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-navy/20 py-5 mt-8">
        <div className="layout-container flex items-center justify-between">
          <span className="text-[9px] tracking-[0.25em] uppercase text-alabaster-dim/30">
            UNIT — Label × Artist Operations
          </span>
          <span className="text-[9px] tracking-[0.25em] uppercase text-alabaster-dim/30">
            MVP v0.1
          </span>
        </div>
      </footer>
    </div>
  );
}

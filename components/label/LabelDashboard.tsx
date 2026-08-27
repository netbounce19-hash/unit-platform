"use client";

import LabelKPIHero from "./LabelKPIHero";
import Leaderboard from "./Leaderboard";
import FinanceHub from "./FinanceHub";
import TaskConstructor from "./TaskConstructor";
import TargetManagement from "./TargetManagement";
import PromoInbox from "./PromoInbox";

export default function LabelDashboard() {
  return (
    <div className="space-y-6">
      {/* 1. Hero KPI Cards */}
      <LabelKPIHero />

      {/* 2. Main Stream Dynamics & Ranking */}
      <Leaderboard />

      {/* 3. Finance & Requests Hub */}
      <FinanceHub />

      {/* 4. Operational Grid (Tasks + Targets) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TaskConstructor />
        <TargetManagement />
      </div>

      {/* 5. Promo inbox */}
      <PromoInbox />
    </div>
  );
}

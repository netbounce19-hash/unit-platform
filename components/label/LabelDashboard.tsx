"use client";

import Leaderboard from "./Leaderboard";
import ReleasePipeline from "./ReleasePipeline";
import TaskConstructor from "./TaskConstructor";
import TargetManagement from "./TargetManagement";
import FinanceHub from "./FinanceHub";
import PromoInbox from "./PromoInbox";

export default function LabelDashboard() {
  return (
    <div className="space-y-8">
      <Leaderboard />
      <ReleasePipeline />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskConstructor />
        <TargetManagement />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FinanceHub />
        <PromoInbox />
      </div>
    </div>
  );
}

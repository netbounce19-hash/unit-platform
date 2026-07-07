"use client";

import DopamineTarget from "./DopamineTarget";
import TaskList from "./TaskList";
import UploadHub from "./UploadHub";
import FinanceBudgets from "./FinanceBudgets";
import PromoReports from "./PromoReports";

export default function ArtistDashboard() {
  return (
    <div className="space-y-8">
      <DopamineTarget />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskList />
        <UploadHub />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FinanceBudgets />
        <PromoReports />
      </div>
    </div>
  );
}

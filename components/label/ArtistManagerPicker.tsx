"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import type { ArtistRow, MyOrg } from "@/lib/supabase/label";
import { fetchTeam, memberName, setArtistManager, type TeamMember } from "@/lib/supabase/team";

/**
 * Кто ведёт артиста. Назначают администратор и менеджер; остальные видят
 * имя. Кандидаты — те, кто работает с артистами напрямую.
 */
const CAN_LEAD = ["label_admin", "label_manager", "project"];

export default function ArtistManagerPicker({
  org,
  artist,
  onChanged,
}: {
  org: MyOrg;
  artist: ArtistRow;
  onChanged: (managerId: string | null) => void;
}) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchTeam(org.org_id).then(setTeam).catch(() => setTeam([]));
  }, [org.org_id]);

  const canAssign = org.role === "label_admin" || org.role === "label_manager";
  const current = team.find((m) => m.user_id === artist.manager_id);
  const candidates = team.filter((m) => CAN_LEAD.includes(m.role));

  if (!canAssign) {
    return current ? (
      <span className="inline-flex items-center gap-[6px] text-[13px] text-[#6E6D73] dark:text-[#9A98A0] px-[14px] py-[8px]">
        <UserRound className="w-4 h-4" strokeWidth={1.75} />
        Ведёт: {memberName(current)}
      </span>
    ) : null;
  }

  return (
    <label className="inline-flex items-center gap-[6px] text-[13px] text-[#6E6D73] dark:text-[#9A98A0] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] rounded-full pl-[12px] pr-[6px] py-[4px]">
      <UserRound className="w-4 h-4 shrink-0" strokeWidth={1.75} />
      <span className="shrink-0">Ведёт</span>
      <select
        value={artist.manager_id ?? ""}
        disabled={busy}
        onChange={async (e) => {
          const v = e.target.value || null;
          setBusy(true);
          try {
            await setArtistManager(artist.id, v);
            onChanged(v);
          } finally {
            setBusy(false);
          }
        }}
        aria-label="Ответственный за артиста"
        className="bg-transparent text-[13px] font-medium text-[#17161A] dark:text-[#F5F4F2] outline-none cursor-pointer max-w-[180px] py-[4px]"
      >
        <option value="">никто</option>
        {candidates.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {memberName(m)}
          </option>
        ))}
      </select>
    </label>
  );
}

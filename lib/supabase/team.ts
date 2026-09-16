"use client";

import { getSupabase } from "./client";
import type { TeamRole } from "@/lib/label/roles";

/**
 * Команда лейбла: состав, роли, приглашения сотрудников.
 * Менять состав может только администратор — это проверяет база.
 */

export interface TeamMember {
  user_id: string;
  email: string;
  full_name: string | null;
  role: TeamRole;
  joined_at: string;
}

export interface TeamInvite {
  id: string;
  org_id: string;
  email: string;
  role: TeamRole;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export const memberName = (m: Pick<TeamMember, "full_name" | "email">) => m.full_name?.trim() || m.email;

export async function fetchTeam(orgId: string): Promise<TeamMember[]> {
  const { data, error } = await getSupabase().rpc("org_team", { p_org: orgId });
  if (error) throw error;
  return (data ?? []) as TeamMember[];
}

export async function setMemberRole(orgId: string, userId: string, role: TeamRole): Promise<void> {
  const { data, error } = await getSupabase()
    .from("memberships")
    .update({ role })
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) throw error;
  if (!data?.length) throw new Error("Менять роли может только администратор");
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  const { data, error } = await getSupabase()
    .from("memberships")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) throw error;
  if (!data?.length) throw new Error("Убрать сотрудника может только администратор");
}

export async function fetchTeamInvites(orgId: string): Promise<TeamInvite[]> {
  const { data, error } = await getSupabase()
    .from("team_invites")
    .select("*")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TeamInvite[];
}

export async function createTeamInvite(orgId: string, email: string, role: TeamRole): Promise<TeamInvite> {
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) throw new Error("Проверьте почту");
  const { data, error } = await getSupabase()
    .from("team_invites")
    .insert({ org_id: orgId, email: clean, role })
    .select()
    .single();
  if (error) throw error;
  return data as TeamInvite;
}

export async function revokeTeamInvite(id: string): Promise<void> {
  const { error } = await getSupabase().from("team_invites").delete().eq("id", id);
  if (error) throw error;
}

export const teamInviteLink = (token: string) =>
  `${typeof window !== "undefined" ? window.location.origin : ""}/join/${token}`;

export async function fetchTeamInviteInfo(
  token: string
): Promise<{ org_name: string; role: TeamRole; expired: boolean; accepted: boolean } | null> {
  const { data, error } = await getSupabase().rpc("team_invite_info", { p_token: token });
  if (error) throw error;
  return (data as { org_name: string; role: TeamRole; expired: boolean; accepted: boolean }[])?.[0] ?? null;
}

export async function acceptTeamInvite(token: string): Promise<void> {
  const { error } = await getSupabase().rpc("accept_team_invite", { p_token: token });
  if (error) throw new Error(error.message);
}

/** Ответственный за артиста в команде. */
export async function setArtistManager(artistId: string, managerId: string | null): Promise<void> {
  const { error } = await getSupabase().from("artists").update({ manager_id: managerId }).eq("id", artistId);
  if (error) throw error;
}

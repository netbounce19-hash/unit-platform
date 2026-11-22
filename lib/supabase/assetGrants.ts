"use client";

import { getSupabase } from "./client";

export type AssetPermission = "view" | "manage";

/** Sharing always goes through an owner-checked RPC; grantor is never client input. */
export async function grantAssetToOrg(assetId: string, orgId: string, permission: AssetPermission = "view"): Promise<string> {
  const { data, error } = await getSupabase().rpc("grant_asset_to_org", {
    p_asset_id: assetId,
    p_org_id: orgId,
    p_permission: permission,
  });
  if (error) throw error;
  return data as string;
}

export async function revokeAssetOrgGrant(assetId: string, orgId: string): Promise<void> {
  const { error } = await getSupabase().rpc("revoke_asset_org_grant", {
    p_asset_id: assetId,
    p_org_id: orgId,
  });
  if (error) throw error;
}

/** Owner intentionally submits this file to this release and shares it with its label. */
export async function attachAssetToRelease(assetId: string, releaseId: string, clean = false): Promise<void> {
  const { error } = await getSupabase().rpc("attach_asset_to_release", {
    p_asset_id: assetId,
    p_release_id: releaseId,
    p_clean: clean,
  });
  if (error) throw error;
}

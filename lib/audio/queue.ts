import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PlaybackRequest {
  job_id: string;
  variant_id: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error_code: string | null;
}

/** Internal only: pass a user-scoped server client, never a service-role client.
 * Explicit calls only. No upload hook, public route, stream URL or player UI.
 * The database independently verifies ownership and audio kind.
 */
export async function requestPlaybackVariant(supabase: SupabaseClient, assetId: string): Promise<PlaybackRequest> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Authentication required');
  const result = await supabase.rpc('request_playback_variant', { p_asset_id: assetId });
  if (result.error) throw result.error;
  return result.data as PlaybackRequest;
}

-- Trusted operator, READ ONLY. Aggregates only; no paths, keys, titles or users.
begin read only;
select status,count(*) as jobs,sum(attempt_count) as attempts,
  sum(request_count) as requests,sum(cache_hit_count) as ready_cache_hits,
  count(*) filter(where reused_variant) as content_hash_reuses,
  sum(downloaded_bytes) as known_download_bytes,sum(uploaded_bytes) as known_upload_bytes,
  sum(cpu_ms)/1000.0 as recorded_cpu_seconds,sum(processing_ms)/1000.0 as recorded_worker_seconds,
  avg(processing_ms::numeric/nullif(duration_ms,0)) filter(where status='completed') as processing_ratio,
  avg(output_bytes::numeric/nullif(input_bytes,0)) filter(where status='completed') as compression_ratio
from private_audio.media_jobs group by status order by status;
select status,count(*) as variants,sum(size_bytes) as recorded_playback_bytes,
  sum(size_bytes) filter(where cleanup_after is not null) as retired_bytes
from private_audio.audio_playback_variants group by status order by status;
select count(*) as retained_exact_path_tombstones,
  count(*) filter(where checked_at is null) as never_swept,
  count(*) filter(where locked_until>clock_timestamp()) as active_cleanup_leases
from private_audio.media_cleanup;
commit;

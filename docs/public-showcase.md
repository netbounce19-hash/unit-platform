# Public showcase

The normal `/dashboard` and `/label/*` pages and components are reused unchanged.
For the public demonstration deployment, build with `NEXT_PUBLIC_UNIT_PUBLIC_DEMO=1`.
This selects an entirely local synthetic data transport, not an authenticated Supabase user.
The flag never grants backend privileges. No real keys, passwords, user rows or original files are supplied.

Local table changes are held only in module memory. Local uploads use blob URLs; they are not uploaded to any server. Refresh resets the sample dataset. Server-only operations such as accepting invitations are explicitly unavailable. Existing backend authorizers/RLS are unchanged. The banner discloses these limitations.

Without this build-time flag the original Supabase client and login requirements remain active. Do not remove AuthGate/LabelGate or weaken database policies to enable showcase navigation.

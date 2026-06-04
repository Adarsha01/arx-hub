
-- Profile stats: block self-inflation by revoking column-level UPDATE
REVOKE UPDATE (wins, losses, kills, mvp_count, matches_played, total_earnings)
  ON public.profiles FROM authenticated, anon;

-- Tournament registrations: block client-side payment bypass
REVOKE INSERT (payment_status, status, payment_ref, checked_in_at)
  ON public.tournament_registrations FROM authenticated, anon;
REVOKE UPDATE (payment_status, status, payment_ref, checked_in_at)
  ON public.tournament_registrations FROM authenticated, anon;
-- service_role retains ALL via prior GRANT ALL; admins act via server functions using service role.

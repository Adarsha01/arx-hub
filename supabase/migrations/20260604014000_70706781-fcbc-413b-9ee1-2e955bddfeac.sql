
-- 1) profiles: hide email/phone from public via column-level privileges
REVOKE SELECT (email, phone) ON public.profiles FROM anon, authenticated;
-- service_role retains full access via GRANT ALL

-- 2) matches: hide room credentials from public via column-level privileges
REVOKE SELECT (room_id, room_password) ON public.matches FROM anon, authenticated;

-- Secure accessor: only registered participants (or admins) can read credentials,
-- and only after credentials_release_at (or immediately for admins).
CREATE OR REPLACE FUNCTION public.get_match_credentials(_match_id uuid)
RETURNS TABLE(room_id text, room_password text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tournament_id uuid;
  v_release timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT m.tournament_id, m.credentials_release_at
    INTO v_tournament_id, v_release
  FROM public.matches m
  WHERE m.id = _match_id;

  IF v_tournament_id IS NULL THEN
    RETURN;
  END IF;

  -- Admins always see
  IF public.is_admin(v_uid) THEN
    RETURN QUERY SELECT m.room_id, m.room_password FROM public.matches m WHERE m.id = _match_id;
    RETURN;
  END IF;

  -- Non-admins only after release time
  IF v_release IS NULL OR now() < v_release THEN
    RETURN;
  END IF;

  -- Must be a registered participant of that tournament (solo or via team)
  IF EXISTS (
    SELECT 1
    FROM public.tournament_registrations r
    LEFT JOIN public.team_members tm ON tm.team_id = r.team_id
    WHERE r.tournament_id = v_tournament_id
      AND r.status IN ('approved','confirmed','checked_in')
      AND (r.user_id = v_uid OR tm.user_id = v_uid)
  ) THEN
    RETURN QUERY SELECT m.room_id, m.room_password FROM public.matches m WHERE m.id = _match_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_match_credentials(uuid) TO authenticated;

-- 3) tournament_registrations: restrict SELECT to registrant, team captain, admins
DROP POLICY IF EXISTS "Registrations viewable by everyone" ON public.tournament_registrations;

CREATE POLICY "Registrations viewable by stakeholders"
ON public.tournament_registrations
FOR SELECT
TO authenticated
USING (
  registered_by = auth.uid()
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = tournament_registrations.team_id AND t.captain_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = tournament_registrations.team_id AND tm.user_id = auth.uid()
  )
  OR public.is_admin(auth.uid())
);

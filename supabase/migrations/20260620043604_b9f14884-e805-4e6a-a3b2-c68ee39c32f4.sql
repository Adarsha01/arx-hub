
-- 1) user_roles: status + audit
DO $$ BEGIN
  CREATE TYPE role_status AS ENUM ('active','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS status role_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS granted_by uuid,
  ADD COLUMN IF NOT EXISTS granted_at timestamptz NOT NULL DEFAULT now();

-- 2) profiles: forced password change + last login
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- 3) Update role helpers to ignore suspended roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND status = 'active'
      AND role IN ('super_admin','tournament_admin','finance_admin','moderator')
  );
$$;

-- 4) Tighten get_match_credentials: only checked_in participants (admins always)
CREATE OR REPLACE FUNCTION public.get_match_credentials(_match_id uuid)
RETURNS TABLE(room_id text, room_password text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tournament_id uuid;
  v_release timestamptz;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT m.tournament_id, m.credentials_release_at
    INTO v_tournament_id, v_release
  FROM public.matches m WHERE m.id = _match_id;
  IF v_tournament_id IS NULL THEN RETURN; END IF;

  IF public.is_admin(v_uid) THEN
    RETURN QUERY SELECT m.room_id, m.room_password FROM public.matches m WHERE m.id = _match_id;
    RETURN;
  END IF;

  IF v_release IS NULL OR now() < v_release THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tournament_registrations r
    LEFT JOIN public.team_members tm ON tm.team_id = r.team_id
    WHERE r.tournament_id = v_tournament_id
      AND r.status = 'checked_in'
      AND (r.user_id = v_uid OR tm.user_id = v_uid)
  ) THEN
    RETURN QUERY SELECT m.room_id, m.room_password FROM public.matches m WHERE m.id = _match_id;
  END IF;
END;
$$;

-- 5) checkin_self: append credentials-ready notification
CREATE OR REPLACE FUNCTION public.checkin_self(_tournament_id uuid, _team_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_opens timestamptz; v_closes timestamptz; v_status tournament_status;
  v_reg_id uuid; v_pay payment_status; v_reg_status registration_status; v_fee numeric;
  v_slug text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT checkin_opens_at, checkin_closes_at, status, entry_fee, slug
    INTO v_opens, v_closes, v_status, v_fee, v_slug
  FROM public.tournaments WHERE id = _tournament_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  IF v_status NOT IN ('checkin_open','registration_closed') THEN
    RAISE EXCEPTION 'Check-in is not open';
  END IF;
  IF v_opens IS NOT NULL AND now() < v_opens THEN RAISE EXCEPTION 'Check-in has not opened yet'; END IF;
  IF v_closes IS NOT NULL AND now() > v_closes THEN RAISE EXCEPTION 'Check-in window has closed'; END IF;

  IF _team_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND captain_id = v_uid) THEN
      RAISE EXCEPTION 'Only the team captain can check in the team';
    END IF;
    SELECT id, payment_status, status INTO v_reg_id, v_pay, v_reg_status
      FROM public.tournament_registrations
      WHERE tournament_id = _tournament_id AND team_id = _team_id;
  ELSE
    SELECT id, payment_status, status INTO v_reg_id, v_pay, v_reg_status
      FROM public.tournament_registrations
      WHERE tournament_id = _tournament_id AND user_id = v_uid;
  END IF;

  IF v_reg_id IS NULL THEN RAISE EXCEPTION 'No registration found'; END IF;
  IF v_reg_status NOT IN ('pending','confirmed') THEN
    RAISE EXCEPTION 'Registration is not eligible for check-in (status: %)', v_reg_status;
  END IF;
  IF v_fee > 0 AND v_pay <> 'success' THEN
    RAISE EXCEPTION 'Payment must be completed before check-in';
  END IF;

  UPDATE public.tournament_registrations
    SET status = 'checked_in', checked_in_at = now(), checked_in_by = v_uid, updated_at = now()
    WHERE id = v_reg_id;

  PERFORM public.log_audit('tournament.checkin', 'tournament_registration', v_reg_id,
    jsonb_build_object('tournament_id', _tournament_id, 'team_id', _team_id));

  -- Notify the captain/solo player that credentials are unlocked
  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (v_uid, 'match', 'Check-In Successful',
    'Match credentials are now available.',
    '/tournaments/' || COALESCE(v_slug, _tournament_id::text));

  -- Also notify all team members if applicable
  IF _team_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    SELECT tm.user_id, 'match', 'Check-In Successful',
      'Match credentials are now available.',
      '/tournaments/' || COALESCE(v_slug, _tournament_id::text)
    FROM public.team_members tm
    WHERE tm.team_id = _team_id AND tm.user_id <> v_uid;
  END IF;

  RETURN v_reg_id;
END $$;

-- 6) Admin: regenerate match credentials
CREATE OR REPLACE FUNCTION public.regenerate_match_credentials(_match_id uuid, _room_id text, _room_password text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.matches
    SET room_id = _room_id, room_password = _room_password, updated_at = now()
    WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  PERFORM public.log_audit('match.credentials_regenerated', 'match', _match_id, '{}'::jsonb);
END $$;

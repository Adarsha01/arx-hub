
-- 1. Auto-assign waitlist_position on insert/update to 'waitlisted'
CREATE OR REPLACE FUNCTION public.assign_waitlist_position()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next int;
BEGIN
  IF NEW.status = 'waitlisted' AND (NEW.waitlist_position IS NULL OR NEW.waitlist_position = 0) THEN
    SELECT COALESCE(MAX(waitlist_position), 0) + 1
      INTO v_next
      FROM public.tournament_registrations
      WHERE tournament_id = NEW.tournament_id AND status = 'waitlisted';
    NEW.waitlist_position := v_next;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_assign_waitlist_position ON public.tournament_registrations;
CREATE TRIGGER trg_assign_waitlist_position
BEFORE INSERT OR UPDATE OF status ON public.tournament_registrations
FOR EACH ROW EXECUTE FUNCTION public.assign_waitlist_position();

-- 2. Promote next waitlisted registration when a confirmed reg becomes cancelled
CREATE OR REPLACE FUNCTION public.promote_from_waitlist(_tournament_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity int;
  v_active int;
  v_next_id uuid;
  v_user uuid;
BEGIN
  SELECT max_teams INTO v_capacity FROM public.tournaments WHERE id = _tournament_id;
  IF v_capacity IS NULL THEN RETURN NULL; END IF;

  SELECT COUNT(*) INTO v_active
    FROM public.tournament_registrations
    WHERE tournament_id = _tournament_id
      AND status IN ('pending','confirmed','checked_in');
  IF v_active >= v_capacity THEN RETURN NULL; END IF;

  SELECT id, user_id INTO v_next_id, v_user
    FROM public.tournament_registrations
    WHERE tournament_id = _tournament_id AND status = 'waitlisted'
    ORDER BY waitlist_position ASC NULLS LAST, created_at ASC
    LIMIT 1;

  IF v_next_id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.tournament_registrations
    SET status = 'pending', payment_status = 'created', waitlist_position = NULL, updated_at = now()
    WHERE id = v_next_id;

  IF v_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_user, 'tournament', 'A slot opened up!',
      'You have been promoted from the waitlist. Complete your payment to confirm your spot.',
      '/tournaments');
  END IF;

  RETURN v_next_id;
END
$$;

-- 3. Auto-promote on cancellation
CREATE OR REPLACE FUNCTION public.trg_auto_promote_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE')
     AND OLD.status IN ('pending','confirmed','checked_in')
     AND NEW.status = 'cancelled' THEN
    PERFORM public.promote_from_waitlist(NEW.tournament_id);
  ELSIF (TG_OP = 'DELETE')
     AND OLD.status IN ('pending','confirmed','checked_in') THEN
    PERFORM public.promote_from_waitlist(OLD.tournament_id);
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS trg_promote_waitlist ON public.tournament_registrations;
CREATE TRIGGER trg_promote_waitlist
AFTER UPDATE OR DELETE ON public.tournament_registrations
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_promote_waitlist();

-- 4. Mark no-shows (admin/cron)
CREATE OR REPLACE FUNCTION public.mark_no_shows(_tournament_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_close timestamptz;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT checkin_closes_at INTO v_close FROM public.tournaments WHERE id = _tournament_id;
  IF v_close IS NULL OR now() < v_close THEN
    RAISE EXCEPTION 'Check-in window has not closed yet';
  END IF;

  WITH updated AS (
    UPDATE public.tournament_registrations
      SET status = 'no_show', updated_at = now()
      WHERE tournament_id = _tournament_id
        AND status = 'confirmed'
      RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  PERFORM public.log_audit('tournament.mark_no_shows', 'tournament', _tournament_id,
    jsonb_build_object('count', v_count));
  RETURN v_count;
END
$$;

-- 5. Safe tournament state transitions (admin only)
CREATE OR REPLACE FUNCTION public.admin_set_tournament_status(
  _tournament_id uuid, _new_status tournament_status
) RETURNS tournament_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old tournament_status;
  v_allowed boolean := false;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'tournament_admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT status INTO v_old FROM public.tournaments WHERE id = _tournament_id;
  IF v_old IS NULL THEN RAISE EXCEPTION 'Tournament not found'; END IF;

  v_allowed := CASE v_old
    WHEN 'draft' THEN _new_status IN ('scheduled','registration_open','cancelled')
    WHEN 'scheduled' THEN _new_status IN ('registration_open','cancelled','draft')
    WHEN 'registration_open' THEN _new_status IN ('registration_closed','cancelled')
    WHEN 'registration_closed' THEN _new_status IN ('checkin_open','cancelled','live')
    WHEN 'checkin_open' THEN _new_status IN ('checkin_closed','cancelled')
    WHEN 'checkin_closed' THEN _new_status IN ('live','cancelled')
    WHEN 'live' THEN _new_status IN ('under_review','completed','cancelled')
    WHEN 'under_review' THEN _new_status IN ('completed','live')
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid status transition: % -> %', v_old, _new_status;
  END IF;

  UPDATE public.tournaments
    SET status = _new_status, updated_at = now()
    WHERE id = _tournament_id;

  PERFORM public.log_audit('tournament.status_changed', 'tournament', _tournament_id,
    jsonb_build_object('from', v_old, 'to', _new_status));
  RETURN _new_status;
END
$$;

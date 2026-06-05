
-- Extend dispute_status enum
ALTER TYPE public.dispute_status ADD VALUE IF NOT EXISTS 'request_info';

-- =====================================================================
-- Column extensions on existing tables
-- =====================================================================
ALTER TABLE public.tournament_registrations
  ADD COLUMN IF NOT EXISTS checked_in_by uuid,
  ADD COLUMN IF NOT EXISTS dq_reason text,
  ADD COLUMN IF NOT EXISTS dq_by uuid,
  ADD COLUMN IF NOT EXISTS dq_at timestamptz;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS winner_team_id uuid,
  ADD COLUMN IF NOT EXISTS winner_user_id uuid,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

ALTER TABLE public.match_results
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS evidence_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS verdict text,
  ADD COLUMN IF NOT EXISTS verdict_action text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now();

-- =====================================================================
-- tournament_status_history
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.tournament_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  from_status public.tournament_status,
  to_status public.tournament_status NOT NULL,
  changed_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tsh_tournament ON public.tournament_status_history(tournament_id, created_at DESC);

GRANT SELECT ON public.tournament_status_history TO authenticated;
GRANT ALL ON public.tournament_status_history TO service_role;
ALTER TABLE public.tournament_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view status history" ON public.tournament_status_history
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.trg_log_tournament_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.tournament_status_history(tournament_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.tournament_status_history(tournament_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.trg_log_tournament_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tournaments_log_status ON public.tournaments;
CREATE TRIGGER tournaments_log_status
  AFTER INSERT OR UPDATE OF status ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_tournament_status();

-- =====================================================================
-- match_result_evidence
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.match_result_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_result_id uuid NOT NULL REFERENCES public.match_results(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mre_result ON public.match_result_evidence(match_result_id);

GRANT SELECT, INSERT ON public.match_result_evidence TO authenticated;
GRANT ALL ON public.match_result_evidence TO service_role;
ALTER TABLE public.match_result_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants and admins view evidence" ON public.match_result_evidence
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.match_results mr
      LEFT JOIN public.teams t ON t.id = mr.team_id
      LEFT JOIN public.team_members tm ON tm.team_id = mr.team_id
      WHERE mr.id = match_result_evidence.match_result_id
        AND (mr.user_id = auth.uid() OR t.captain_id = auth.uid() OR tm.user_id = auth.uid())
    )
  );

CREATE POLICY "Uploader inserts evidence" ON public.match_result_evidence
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

-- Keep evidence_count in sync
CREATE OR REPLACE FUNCTION public.trg_evidence_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.match_results SET evidence_count = evidence_count + 1, updated_at = now()
      WHERE id = NEW.match_result_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.match_results SET evidence_count = GREATEST(evidence_count - 1, 0), updated_at = now()
      WHERE id = OLD.match_result_id;
  END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.trg_evidence_count() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS match_result_evidence_count ON public.match_result_evidence;
CREATE TRIGGER match_result_evidence_count
  AFTER INSERT OR DELETE ON public.match_result_evidence
  FOR EACH ROW EXECUTE FUNCTION public.trg_evidence_count();

-- =====================================================================
-- dispute_messages
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.dispute_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  internal boolean NOT NULL DEFAULT false,
  attachments jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dm_dispute ON public.dispute_messages(dispute_id, created_at);

GRANT SELECT, INSERT ON public.dispute_messages TO authenticated;
GRANT ALL ON public.dispute_messages TO service_role;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispute participants and mods view messages" ON public.dispute_messages
  FOR SELECT TO authenticated
  USING (
    (NOT internal AND EXISTS (SELECT 1 FROM public.disputes d WHERE d.id = dispute_messages.dispute_id AND d.raised_by = auth.uid()))
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Participants and mods insert messages" ON public.dispute_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      (NOT internal AND EXISTS (SELECT 1 FROM public.disputes d WHERE d.id = dispute_id AND d.raised_by = auth.uid()))
      OR public.is_admin(auth.uid())
    )
  );

-- =====================================================================
-- check-in
-- =====================================================================
CREATE OR REPLACE FUNCTION public.checkin_self(_tournament_id uuid, _team_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_opens timestamptz; v_closes timestamptz; v_status tournament_status;
  v_reg_id uuid; v_pay payment_status; v_reg_status registration_status; v_fee numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT checkin_opens_at, checkin_closes_at, status, entry_fee
    INTO v_opens, v_closes, v_status, v_fee
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
  RETURN v_reg_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.checkin_self(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkin_self(uuid, uuid) TO authenticated;

-- Extended no-show + auto DQ
CREATE OR REPLACE FUNCTION public.auto_disqualify_no_shows(_tournament_id uuid, _grace_minutes integer DEFAULT 0)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int; v_close timestamptz;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT checkin_closes_at INTO v_close FROM public.tournaments WHERE id = _tournament_id;
  IF v_close IS NULL OR now() < (v_close + make_interval(mins => COALESCE(_grace_minutes,0))) THEN
    RAISE EXCEPTION 'Check-in grace window has not elapsed';
  END IF;

  WITH updated AS (
    UPDATE public.tournament_registrations
      SET status = 'disqualified',
          dq_reason = COALESCE(dq_reason, 'No-show after check-in window'),
          dq_by = auth.uid(),
          dq_at = now(),
          updated_at = now()
      WHERE tournament_id = _tournament_id AND status IN ('pending','confirmed')
      RETURNING id, COALESCE(user_id, registered_by) AS uid
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  -- Trigger waitlist promotion attempts
  PERFORM public.promote_from_waitlist(_tournament_id);

  PERFORM public.log_audit('tournament.auto_dq', 'tournament', _tournament_id,
    jsonb_build_object('count', v_count, 'grace_minutes', _grace_minutes));
  RETURN v_count;
END $$;
REVOKE EXECUTE ON FUNCTION public.auto_disqualify_no_shows(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_disqualify_no_shows(uuid, integer) TO authenticated;

-- =====================================================================
-- Match result workflow
-- =====================================================================
CREATE OR REPLACE FUNCTION public.submit_match_result(
  _match_id uuid, _team_id uuid, _user_id uuid,
  _placement integer, _kills integer, _points integer, _screenshot_url text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tournament uuid;
  v_id uuid;
  v_ok boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT tournament_id INTO v_tournament FROM public.matches WHERE id = _match_id;
  IF v_tournament IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;

  -- Caller must be captain of team or the solo participant or an admin
  IF public.is_admin(v_uid) THEN
    v_ok := true;
  ELSIF _team_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND captain_id = v_uid) THEN
    v_ok := true;
  ELSIF _user_id = v_uid THEN
    v_ok := true;
  END IF;
  IF NOT v_ok THEN RAISE EXCEPTION 'Only captain/participant may submit a result'; END IF;

  INSERT INTO public.match_results(match_id, team_id, user_id, placement, kills, points, screenshot_url, submitted_by, status)
  VALUES (_match_id, _team_id, _user_id, _placement, COALESCE(_kills,0), COALESCE(_points,0), _screenshot_url, v_uid, 'submitted')
  RETURNING id INTO v_id;

  PERFORM public.log_audit('match.result_submitted', 'match_result', v_id,
    jsonb_build_object('match_id', _match_id, 'team_id', _team_id));

  -- Notify other participants in this match
  INSERT INTO public.notifications(user_id, type, title, body, link)
  SELECT DISTINCT COALESCE(r.user_id, tm.user_id), 'match', 'A result has been submitted',
    'Review and confirm or dispute the submitted result.',
    '/matches/' || _match_id
  FROM public.tournament_registrations r
  LEFT JOIN public.team_members tm ON tm.team_id = r.team_id
  WHERE r.tournament_id = v_tournament
    AND COALESCE(r.user_id, tm.user_id) IS NOT NULL
    AND COALESCE(r.user_id, tm.user_id) <> v_uid;

  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_match_result(uuid,uuid,uuid,integer,integer,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_match_result(uuid,uuid,uuid,integer,integer,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_match_result(_result_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_match uuid; v_team uuid; v_user uuid; v_submitter uuid; v_tournament uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT match_id, team_id, user_id, submitted_by INTO v_match, v_team, v_user, v_submitter
    FROM public.match_results WHERE id = _result_id;
  IF v_match IS NULL THEN RAISE EXCEPTION 'Result not found'; END IF;
  IF v_submitter = v_uid AND NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Submitter cannot confirm their own result';
  END IF;
  SELECT tournament_id INTO v_tournament FROM public.matches WHERE id = v_match;

  -- Caller must be participant of the same match (different team/user) or admin
  IF NOT public.is_admin(v_uid) AND NOT EXISTS (
    SELECT 1 FROM public.tournament_registrations r
    LEFT JOIN public.team_members tm ON tm.team_id = r.team_id
    WHERE r.tournament_id = v_tournament
      AND (r.user_id = v_uid OR tm.user_id = v_uid OR EXISTS (
        SELECT 1 FROM public.teams t WHERE t.id = r.team_id AND t.captain_id = v_uid
      ))
  ) THEN
    RAISE EXCEPTION 'Not authorized to confirm this result';
  END IF;

  UPDATE public.match_results
    SET status = 'confirmed', verified = true, confirmed_by = v_uid, confirmed_at = now(), updated_at = now()
    WHERE id = _result_id;

  UPDATE public.matches
    SET winner_team_id = v_team, winner_user_id = v_user, finalized_at = now(), status = 'completed', updated_at = now()
    WHERE id = v_match;

  PERFORM public.log_audit('match.result_confirmed', 'match_result', _result_id,
    jsonb_build_object('match_id', v_match));

  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (v_submitter, 'match', 'Result confirmed', 'Your submitted match result was confirmed.', '/matches/' || v_match);
END $$;
REVOKE EXECUTE ON FUNCTION public.confirm_match_result(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_match_result(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.dispute_match_result(_result_id uuid, _category text, _description text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_match uuid; v_tournament uuid; v_dispute_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT match_id INTO v_match FROM public.match_results WHERE id = _result_id;
  IF v_match IS NULL THEN RAISE EXCEPTION 'Result not found'; END IF;
  SELECT tournament_id INTO v_tournament FROM public.matches WHERE id = v_match;

  UPDATE public.match_results SET status = 'disputed', updated_at = now() WHERE id = _result_id;

  INSERT INTO public.disputes(tournament_id, match_id, raised_by, description, category, status, last_activity_at)
  VALUES (v_tournament, v_match, v_uid, COALESCE(_description,''), _category, 'open', now())
  RETURNING id INTO v_dispute_id;

  PERFORM public.log_audit('dispute.opened', 'dispute', v_dispute_id,
    jsonb_build_object('result_id', _result_id, 'category', _category));
  RETURN v_dispute_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.dispute_match_result(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispute_match_result(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_dispute(
  _dispute_id uuid, _verdict_action text, _verdict text, _new_status dispute_status DEFAULT 'resolved'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_admin(v_uid) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE public.disputes
    SET status = _new_status,
        verdict = _verdict,
        verdict_action = _verdict_action,
        resolved_by = v_uid,
        resolution = COALESCE(_verdict, resolution),
        last_activity_at = now(),
        updated_at = now()
    WHERE id = _dispute_id;

  PERFORM public.log_audit('dispute.resolved', 'dispute', _dispute_id,
    jsonb_build_object('action', _verdict_action, 'status', _new_status));

  -- Notify raiser
  INSERT INTO public.notifications(user_id, type, title, body, link)
  SELECT raised_by, 'match', 'Dispute ' || _new_status::text,
    COALESCE(_verdict, 'Your dispute has been updated.'),
    '/disputes'
  FROM public.disputes WHERE id = _dispute_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.resolve_dispute(uuid, text, text, dispute_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_dispute(uuid, text, text, dispute_status) TO authenticated;

-- =====================================================================
-- Tighten disputes UPDATE: split into user (raiser limited) + admin (full)
-- Existing policy "Admin updates dispute" stays. Allow raiser to add evidence_urls only via messages, so no user UPDATE policy needed.
-- =====================================================================

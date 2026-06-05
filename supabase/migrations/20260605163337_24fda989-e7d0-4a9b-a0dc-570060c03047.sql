
REVOKE SELECT (email, phone) ON public.profiles FROM anon, authenticated;
REVOKE SELECT (room_id, room_password) ON public.matches FROM anon, authenticated;

ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
ALTER PUBLICATION supabase_realtime DROP TABLE public.tournament_registrations;

CREATE OR REPLACE FUNCTION public.wallet_ledger_block_mutations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'wallet_ledger entries are immutable';
END $function$;

REVOKE EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_wallet_balance(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_tournament_escrow(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.promote_from_waitlist(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_no_shows(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_tournament_status(uuid, tournament_status) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_match_credentials(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_wallet_ledger_entry() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_registration_payment() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_waitlist_position() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_auto_promote_waitlist() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wallet_ledger_block_mutations() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, PUBLIC;

DROP POLICY IF EXISTS "User updates own kyc" ON public.kyc_records;
CREATE POLICY "User updates own kyc"
ON public.kyc_records
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND status = ANY (ARRAY['not_submitted'::kyc_status, 'pending'::kyc_status])
)
WITH CHECK (
  user_id = auth.uid()
  AND status = ANY (ARRAY['not_submitted'::kyc_status, 'pending'::kyc_status])
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
);

DROP POLICY IF EXISTS "Admin updates kyc" ON public.kyc_records;
CREATE POLICY "Admin updates kyc"
ON public.kyc_records
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'finance_admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'finance_admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);


-- 1. Withdrawal status: add 'paid'
ALTER TYPE withdrawal_status ADD VALUE IF NOT EXISTS 'paid';

-- 2. Payments hardening
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS registration_id uuid,
  ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_key_uidx
  ON public.payments (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_order_uidx
  ON public.payments (provider_order_id) WHERE provider_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_uidx
  ON public.payments (provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_user_status_idx ON public.payments (user_id, status);

-- 3. Wallet ledger immutability + balance trigger
CREATE OR REPLACE FUNCTION public.wallet_ledger_block_mutations()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'wallet_ledger entries are immutable';
END $$;

DROP TRIGGER IF EXISTS wallet_ledger_no_update ON public.wallet_ledger;
CREATE TRIGGER wallet_ledger_no_update
  BEFORE UPDATE OR DELETE ON public.wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION public.wallet_ledger_block_mutations();

CREATE OR REPLACE FUNCTION public.apply_wallet_ledger_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_delta numeric;
BEGIN
  IF NEW.entry_type NOT IN ('credit','debit') THEN
    RAISE EXCEPTION 'invalid entry_type: %', NEW.entry_type;
  END IF;
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;
  v_delta := CASE WHEN NEW.entry_type = 'credit' THEN NEW.amount ELSE -NEW.amount END;

  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wallets
    SET balance = balance + v_delta, updated_at = now()
    WHERE user_id = NEW.user_id;

  IF (SELECT balance FROM public.wallets WHERE user_id = NEW.user_id) < 0 THEN
    RAISE EXCEPTION 'insufficient wallet balance';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS wallet_ledger_apply ON public.wallet_ledger;
CREATE TRIGGER wallet_ledger_apply
  AFTER INSERT ON public.wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION public.apply_wallet_ledger_entry();

-- Ensure wallets.user_id is unique
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='wallets_user_id_key') THEN
    ALTER TABLE public.wallets ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_wallet_balance(_user_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0)
  FROM public.wallet_ledger WHERE user_id = _user_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_wallet_balance(uuid) TO authenticated;

-- 4. Tournament escrow
CREATE TABLE IF NOT EXISTS public.tournament_escrow_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  user_id uuid,
  team_id uuid,
  entry_type text NOT NULL CHECK (entry_type IN ('fee_in','prize_out','refund','platform_fee','adjustment')),
  amount numeric NOT NULL,
  reference_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournament_escrow_entries TO authenticated;
GRANT ALL ON public.tournament_escrow_entries TO service_role;
ALTER TABLE public.tournament_escrow_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Escrow viewable by finance/admin" ON public.tournament_escrow_entries;
CREATE POLICY "Escrow viewable by finance/admin"
  ON public.tournament_escrow_entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'finance_admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'tournament_admin'));

CREATE INDEX IF NOT EXISTS escrow_tournament_idx ON public.tournament_escrow_entries (tournament_id);
CREATE INDEX IF NOT EXISTS escrow_entry_type_idx ON public.tournament_escrow_entries (entry_type);

CREATE OR REPLACE FUNCTION public.get_tournament_escrow(_tournament_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(CASE WHEN entry_type='fee_in' THEN amount
                           WHEN entry_type IN ('prize_out','platform_fee','refund') THEN -amount
                           ELSE amount END), 0)
  FROM public.tournament_escrow_entries WHERE tournament_id = _tournament_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_tournament_escrow(uuid) TO authenticated;

-- 5. Tournaments: platform fee + settlement
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS platform_fee_percent numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS settlement_status text NOT NULL DEFAULT 'pending'
    CHECK (settlement_status IN ('pending','partial','completed')),
  ADD COLUMN IF NOT EXISTS prize_distributed_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkin_opens_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkin_closes_at timestamptz;

-- 6. Registration finalization trigger
CREATE OR REPLACE FUNCTION public.enforce_registration_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fee numeric;
BEGIN
  IF NEW.status IN ('confirmed','checked_in') THEN
    SELECT entry_fee INTO v_fee FROM public.tournaments WHERE id = NEW.tournament_id;
    IF v_fee IS NOT NULL AND v_fee > 0 AND NEW.payment_status <> 'success' THEN
      RAISE EXCEPTION 'Registration cannot be confirmed without verified payment';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_registration_payment_trg ON public.tournament_registrations;
CREATE TRIGGER enforce_registration_payment_trg
  BEFORE INSERT OR UPDATE ON public.tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_registration_payment();

-- 7. Withdrawals RLS: user can insert pending requests for self
DROP POLICY IF EXISTS "User creates own withdrawal" ON public.withdrawals;
CREATE POLICY "User creates own withdrawal"
  ON public.withdrawals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Admin updates withdrawal" ON public.withdrawals;
CREATE POLICY "Admin updates withdrawal"
  ON public.withdrawals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'finance_admin') OR public.has_role(auth.uid(),'super_admin'));

-- Block user from changing privileged columns
REVOKE INSERT (status, reviewed_by, reviewed_at) ON public.withdrawals FROM authenticated, anon;

-- 8. KYC: allow user to insert/update own pending record
DROP POLICY IF EXISTS "User upserts own kyc" ON public.kyc_records;
CREATE POLICY "User inserts own kyc"
  ON public.kyc_records FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status IN ('not_submitted','pending'));
CREATE POLICY "User updates own kyc"
  ON public.kyc_records FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('not_submitted','pending'))
  WITH CHECK (user_id = auth.uid());

-- 9. Audit log helper
CREATE OR REPLACE FUNCTION public.log_audit(_action text, _entity_type text, _entity_id uuid, _metadata jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), _action, _entity_type, _entity_id, _metadata);
$$;
-- Audit logging is server-only (called from server functions via service role)
REVOKE EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb) TO service_role;

CREATE INDEX IF NOT EXISTS audit_entity_idx ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_actor_idx ON public.audit_logs (actor_id);

-- 10. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_registrations;


DROP POLICY IF EXISTS "Registrant or admin can update" ON public.tournament_registrations;
CREATE POLICY "Admins can update registrations" ON public.tournament_registrations
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

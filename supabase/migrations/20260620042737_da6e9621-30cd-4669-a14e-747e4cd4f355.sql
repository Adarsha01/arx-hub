
-- 1) Profiles: revoke email/phone from anon/authenticated
REVOKE SELECT (email, phone) ON public.profiles FROM anon;
REVOKE SELECT (email, phone) ON public.profiles FROM authenticated;

-- 2) KYC: ensure users cannot update a row that has been reviewed
DROP POLICY IF EXISTS "User updates own kyc" ON public.kyc_records;
CREATE POLICY "User updates own kyc" ON public.kyc_records
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND status IN ('not_submitted','pending')
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('not_submitted','pending')
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

-- 3) Storage: restrict UPDATE/DELETE on match-evidence to uploader or admin
DROP POLICY IF EXISTS "match-evidence uploader or admin update" ON storage.objects;
DROP POLICY IF EXISTS "match-evidence uploader or admin delete" ON storage.objects;

CREATE POLICY "match-evidence uploader or admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'match-evidence'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin(auth.uid())
    )
  )
  WITH CHECK (
    bucket_id = 'match-evidence'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin(auth.uid())
    )
  );

CREATE POLICY "match-evidence uploader or admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'match-evidence'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin(auth.uid())
    )
  );

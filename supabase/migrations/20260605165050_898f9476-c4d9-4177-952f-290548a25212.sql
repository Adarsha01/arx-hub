
CREATE POLICY "Users upload to own folder (match-evidence)" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'match-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins read match-evidence" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'match-evidence' AND public.is_admin(auth.uid()));

CREATE POLICY "Uploader reads own match-evidence" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'match-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

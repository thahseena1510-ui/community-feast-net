
CREATE POLICY "Authenticated read donation images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'donation-images');
CREATE POLICY "Users upload own donation image" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'donation-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own donation image" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'donation-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own donation image" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'donation-images' AND auth.uid()::text = (storage.foldername(name))[1]);

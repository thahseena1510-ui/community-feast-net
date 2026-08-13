ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ngo_doc_path text,
  ADD COLUMN IF NOT EXISTS ngo_doc_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS ngo_doc_note text;

CREATE POLICY "NGO uploads own document"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ngo-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "NGO updates own document"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ngo-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'ngo-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "NGO deletes own document"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ngo-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner or admin reads ngo document"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ngo-documents'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Members can read company documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-documents'
    AND private.is_company_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "Members can upload company documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-documents'
    AND auth.uid() = owner
    AND private.is_company_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "Uploader or admins update company documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-documents'
    AND (
      auth.uid() = owner
      OR private.has_company_any_role(
        (storage.foldername(name))[1]::uuid, auth.uid(),
        ARRAY['owner'::app_role, 'admin'::app_role]
      )
    )
  );

CREATE POLICY "Uploader or admins delete company documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-documents'
    AND (
      auth.uid() = owner
      OR private.has_company_any_role(
        (storage.foldername(name))[1]::uuid, auth.uid(),
        ARRAY['owner'::app_role, 'admin'::app_role]
      )
    )
  );

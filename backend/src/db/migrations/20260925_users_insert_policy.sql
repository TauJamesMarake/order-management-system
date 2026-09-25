CREATE OR REPLACE FUNCTION public.current_user_business_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT business_id
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_active_business_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users AS actor
    JOIN public.businesses AS business ON business.id = actor.business_id
    WHERE actor.id = auth.uid()
      AND actor.role = 'admin'
      AND actor.is_active
      AND business.is_active
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_business_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_business_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_business_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_business_admin() TO authenticated;

DROP POLICY IF EXISTS "users_select_own_business" ON public.users;
CREATE POLICY "users_select_own_business"
  ON public.users FOR SELECT
  TO authenticated
  USING (business_id = public.current_user_business_id());

DROP POLICY IF EXISTS "users_update_own_business" ON public.users;
CREATE POLICY "users_update_own_business"
  ON public.users FOR UPDATE
  TO authenticated
  USING (business_id = public.current_user_business_id());

DROP POLICY IF EXISTS "users_insert_admin_own_business" ON public.users;
CREATE POLICY "users_insert_admin_own_business"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id = public.current_user_business_id()
    AND public.is_active_business_admin()
  );
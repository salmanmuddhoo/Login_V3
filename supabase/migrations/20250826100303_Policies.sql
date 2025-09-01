
-- ======= Enable RLS on target tables =======
ALTER TABLE IF EXISTS public.permissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users             ENABLE ROW LEVEL SECURITY;

-- ======= Create helper function to check admin role =======
-- SECURITY DEFINER so it can check users/roles without being blocked by RLS
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = uid
      AND r.name = 'admin'
  );
$$;

-- (Optional) Make sure the function owner is the DB owner (typical in Supabase):
-- ALTER FUNCTION public.is_admin(uuid) OWNER TO postgres;

-- ======= Policies =======
-- Users can read permissions
DROP POLICY IF EXISTS "Users can read permissions" ON public.permissions;
CREATE POLICY "Users can read permissions"
  ON public.permissions
  FOR SELECT
  TO authenticated
  USING ( true );

-- Users can read role permissions
DROP POLICY IF EXISTS "Users can read role permissions" ON public.role_permissions;
CREATE POLICY "Users can read role permissions"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING ( true );

-- Users can read roles
DROP POLICY IF EXISTS "Users can read roles" ON public.roles;
CREATE POLICY "Users can read roles"
  ON public.roles
  FOR SELECT
  TO authenticated
  USING ( true );

-- Admin users can manage all users
DROP POLICY IF EXISTS "Admin users can manage all users" ON public.users;
CREATE POLICY "Admin users can manage all users"
  ON public.users
  FOR ALL
  TO authenticated
  USING ( is_admin(auth.uid()) )
  WITH CHECK ( is_admin(auth.uid()) );

-- Users can read own data
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
CREATE POLICY "Users can read own data"
  ON public.users
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);
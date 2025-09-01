/*
  # Add user_roles table for multiple roles per user

  1. New Tables
    - `user_roles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `role_id` (uuid, foreign key to roles)
      - `created_at` (timestamp)
  
  2. Data Migration
    - Migrate existing single role assignments from users.role_id to user_roles table
    - Preserve all existing user-role relationships
  
  3. Schema Changes
    - Remove role_id column from users table after migration
    - Add unique constraint to prevent duplicate user-role assignments
  
  4. Security
    - Enable RLS on user_roles table
    - Add policies for authenticated users to read their own role assignments
    - Add policies for admin users to manage all role assignments
*/

-- Step 1: Create the user_roles join table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now()
);

-- Add a unique constraint to prevent duplicate user-role assignments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_roles_user_id_role_id_key' 
    AND table_name = 'user_roles'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_id_key UNIQUE (user_id, role_id);
  END IF;
END $$;

-- Step 2: Migrate existing single role assignments to the new user_roles table
-- This ensures that any user who currently has a role_id in the 'users' table
-- will have that role preserved in the new 'user_roles' table.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'role_id'
  ) THEN
    INSERT INTO public.user_roles (user_id, role_id)
    SELECT id, role_id FROM public.users WHERE role_id IS NOT NULL
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;
END $$;

-- Step 3: Remove the role_id column from the users table
-- This step is now safe because existing role data has been migrated.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'role_id'
  ) THEN
    ALTER TABLE public.users DROP COLUMN role_id;
  END IF;
END $$;

-- Step 4: Enable RLS and add policies for user_roles table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own role assignments
CREATE POLICY "Users can read own role assignments"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for admin users to manage all role assignments
CREATE POLICY "Admin users can manage all role assignments"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
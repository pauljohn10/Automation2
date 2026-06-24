-- ============================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) FIX FOR USER_PROFILES TABLE
-- Resolves "500 (Internal Server Error)" caused by infinite recursion.
-- Run this script in your Supabase SQL Editor.
-- ============================================================================

-- 1. Automatically identify and drop all existing policies on user_profiles
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'user_profiles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY %I ON user_profiles', pol.policyname);
        RAISE NOTICE 'Dropped policy % on user_profiles', pol.policyname;
    END LOOP;
END $$;

-- 2. Ensure Row Level Security is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create a SECURITY DEFINER helper function to bypass RLS checks.
-- This function runs with creator privileges, preventing infinite recursion.
CREATE OR REPLACE FUNCTION public.check_is_super_admin(user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE id = user_id AND role = 'SUPER_ADMIN'
  );
END;
$$;

-- 4. Re-establish clean, recursion-free RLS policies

-- SELECT: Allow users to view their own profile, or SUPER_ADMINs to view all profiles
CREATE POLICY "user_profiles_select" ON user_profiles
FOR SELECT
USING (
  auth.uid() = id 
  OR public.check_is_super_admin(auth.uid())
);

-- INSERT: Allow users to create their own profile row
CREATE POLICY "user_profiles_insert" ON user_profiles
FOR INSERT
WITH CHECK (
  auth.uid() = id
);

-- UPDATE: Allow users to update their own profile, or SUPER_ADMINs to update any profile
CREATE POLICY "user_profiles_update" ON user_profiles
FOR UPDATE
USING (
  auth.uid() = id 
  OR public.check_is_super_admin(auth.uid())
)
WITH CHECK (
  auth.uid() = id 
  OR public.check_is_super_admin(auth.uid())
);

-- DELETE: Allow only SUPER_ADMINs to delete profile rows
CREATE POLICY "user_profiles_delete" ON user_profiles
FOR DELETE
USING (
  public.check_is_super_admin(auth.uid())
);

-- ============================================================================
-- ALTERNATIVE OPTION: JWT METADATA BASED ROLE CHECK
-- If you do not want to use database functions, you can read the role directly 
-- from the authenticated user's JWT metadata (which has zero table lookups and 
-- is 100% immune to infinite recursion).
--
-- To use this alternative, delete the policies above and run these instead:
--
-- CREATE POLICY "user_profiles_select" ON user_profiles FOR SELECT
-- USING (auth.uid() = id OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'SUPER_ADMIN');
--
-- CREATE POLICY "user_profiles_insert" ON user_profiles FOR INSERT
-- WITH CHECK (auth.uid() = id);
--
-- CREATE POLICY "user_profiles_update" ON user_profiles FOR UPDATE
-- USING (auth.uid() = id OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'SUPER_ADMIN')
-- WITH CHECK (auth.uid() = id OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'SUPER_ADMIN');
--
-- CREATE POLICY "user_profiles_delete" ON user_profiles FOR DELETE
-- USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'SUPER_ADMIN');
-- ============================================================================

RAISE NOTICE 'Successfully applied clean RLS policies to user_profiles.';

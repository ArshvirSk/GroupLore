-- Migration: move the users table from the old auth provider to Supabase Auth ids.
-- Safe to run on a fresh schema as well as an existing project.
-- Run this in the Supabase SQL editor before deploying the Supabase Auth build.

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'clerk_id'
  ) THEN
    -- Keep the old id as a temporary link. The next /api/users/sync replaces
    -- it with the Supabase auth user id for the matching email.
    UPDATE public.users
    SET auth_user_id = clerk_id
    WHERE auth_user_id IS NULL AND clerk_id IS NOT NULL;

    ALTER TABLE public.users DROP COLUMN clerk_id;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_key
  ON users(auth_user_id);

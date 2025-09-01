/*
  # Add password reset column to users table

  1. New Columns
    - `needs_password_reset` (boolean, default false)
      - Flags users who need to change their password on first login
      - Used for admin-created accounts with temporary passwords

  2. Security
    - Column has appropriate default value
    - Maintains existing RLS policies
*/

-- Add needs_password_reset column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS needs_password_reset BOOLEAN DEFAULT FALSE NOT NULL;

-- Update existing users to not require password reset (optional, for safety)
UPDATE public.users 
SET needs_password_reset = FALSE 
WHERE needs_password_reset IS NULL;
/*
  # Add modules_access column to user_permissions

  ## Overview
  This migration adds support for module-level access control to the user_permissions table.
  Allows storing which modules each user can access (reports, evidence, updates, users, system, admin).

  ## Changes
  - Add modules_access JSONB column to user_permissions
  - Set default access for all modules
  - Add index for performance
*/

-- Add modules_access column if it doesn't exist
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS modules_access JSONB DEFAULT '{"reports":true,"evidence":true,"updates":true,"users":false,"system":false,"admin":false}'::jsonb;

-- Update existing records with default module access
UPDATE public.user_permissions 
SET modules_access = '{"reports":true,"evidence":true,"updates":true,"users":false,"system":false,"admin":false}'::jsonb
WHERE modules_access IS NULL;

-- Add constraint to ensure it's not null
ALTER TABLE public.user_permissions
ALTER COLUMN modules_access SET NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.user_permissions.modules_access IS 'JSONB object storing module access level for each user. Keys: reports, evidence, updates, users, system, admin';

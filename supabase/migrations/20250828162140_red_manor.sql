/*
  # Optimize User Profile Query Performance

  1. Indexes
    - Add composite index on user_roles for faster joins
    - Add index on users.is_active for filtering
    - Ensure proper indexing for role lookups

  2. Performance
    - These indexes will speed up the fetchUserProfile query
    - Composite index on (user_id, role_id) for user_roles table
    - Index on frequently queried user fields
*/

-- Create composite index on user_roles for faster user-role lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role_id 
ON user_roles (user_id, role_id);

-- Create index on users.is_active for filtering active users
CREATE INDEX IF NOT EXISTS idx_users_is_active 
ON users (is_active) WHERE is_active = true;

-- Create index on users.needs_password_reset for filtering
CREATE INDEX IF NOT EXISTS idx_users_needs_password_reset 
ON users (needs_password_reset) WHERE needs_password_reset = true;

-- Create index on roles.name for faster role name lookups
CREATE INDEX IF NOT EXISTS idx_roles_name 
ON roles (name);

-- Analyze tables to update statistics for query planner
ANALYZE users;
ANALYZE user_roles;
ANALYZE roles;
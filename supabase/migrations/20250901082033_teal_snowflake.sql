/*
  # Seed default permissions for RBAC system

  1. Default Permissions
    - Creates comprehensive set of permissions for common resources
    - Covers admin, dashboard, users, roles, permissions, reports, transactions
    - Each resource has appropriate CRUD operations

  2. Admin Role Setup
    - Ensures admin role has all permissions
    - Creates role_permissions entries for admin role

  3. Member and Viewer Roles
    - Assigns appropriate permissions to existing member and viewer roles
    - Member: dashboard access, reports view, transactions create
    - Viewer: dashboard access, reports view only
*/

-- Insert default permissions if they don't exist
INSERT INTO permissions (resource, action, description) VALUES
  ('admin', 'access', 'Access admin panel and administrative features'),
  ('dashboard', 'access', 'Access main dashboard'),
  ('users', 'manage', 'Full user management (create, read, update, delete)'),
  ('users', 'read', 'View user information'),
  ('roles', 'manage', 'Full role management (create, read, update, delete)'),
  ('roles', 'read', 'View role information'),
  ('permissions', 'manage', 'Full permission management (create, read, update, delete)'),
  ('permissions', 'read', 'View permission information'),
  ('reports', 'view', 'View and access reports'),
  ('reports', 'export', 'Export reports to various formats'),
  ('reports', 'create', 'Create new reports'),
  ('transactions', 'create', 'Create new transactions'),
  ('transactions', 'approve', 'Approve pending transactions'),
  ('transactions', 'view', 'View transaction details'),
  ('analytics', 'view', 'Access analytics and insights'),
  ('settings', 'manage', 'Manage system settings')
ON CONFLICT (resource, action) DO NOTHING;

-- Get the admin role ID
DO $$
DECLARE
  admin_role_id uuid;
  member_role_id uuid;
  viewer_role_id uuid;
  perm_record RECORD;
BEGIN
  -- Get role IDs
  SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';
  SELECT id INTO member_role_id FROM roles WHERE name = 'member';
  SELECT id INTO viewer_role_id FROM roles WHERE name = 'viewer';

  -- Assign ALL permissions to admin role
  IF admin_role_id IS NOT NULL THEN
    FOR perm_record IN SELECT id FROM permissions LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (admin_role_id, perm_record.id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
  END IF;

  -- Assign specific permissions to member role
  IF member_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT member_role_id, p.id
    FROM permissions p
    WHERE (p.resource = 'dashboard' AND p.action = 'access')
       OR (p.resource = 'reports' AND p.action IN ('view', 'export'))
       OR (p.resource = 'transactions' AND p.action IN ('create', 'view'))
       OR (p.resource = 'analytics' AND p.action = 'view')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Assign specific permissions to viewer role
  IF viewer_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT viewer_role_id, p.id
    FROM permissions p
    WHERE (p.resource = 'dashboard' AND p.action = 'access')
       OR (p.resource = 'reports' AND p.action = 'view')
       OR (p.resource = 'transactions' AND p.action = 'view')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;
END $$;
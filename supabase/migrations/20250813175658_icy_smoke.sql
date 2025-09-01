/*
  # Insert test users and sample data

  1. Test Users
    - Admin user: admin@example.com (password: password123)
    - Member user: member@example.com (password: password123)
    - Viewer user: viewer@example.com (password: password123)

  2. Sample Permissions
    - Basic permissions for different resources and actions

  3. Role Assignments
    - Link roles with appropriate permissions
    - Assign users to their respective roles

  Note: Users will need to be created through Supabase Auth UI or API separately,
  but their profiles will be automatically created here.
*/

-- Insert sample permissions
INSERT INTO permissions (resource, action, description) VALUES
  ('users', 'create', 'Create new users'),
  ('users', 'read', 'View user information'),
  ('users', 'update', 'Update user information'),
  ('users', 'delete', 'Delete users'),
  ('reports', 'read', 'View reports'),
  ('reports', 'create', 'Create reports'),
  ('transactions', 'read', 'View transactions'),
  ('transactions', 'create', 'Create transactions'),
  ('dashboard', 'access', 'Access dashboard')
ON CONFLICT (resource, action) DO NOTHING;

-- Link admin role with all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  r.id,
  p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Link member role with limited permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  r.id,
  p.id
FROM roles r
JOIN permissions p ON p.resource IN ('reports', 'transactions', 'dashboard')
WHERE r.name = 'member'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Link viewer role with read-only permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  r.id,
  p.id
FROM roles r
JOIN permissions p ON p.action = 'read' OR (p.resource = 'dashboard' AND p.action = 'access')
WHERE r.name = 'viewer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Insert test user profiles (these will be linked when users sign up through Supabase Auth)
-- Note: The actual auth users need to be created through Supabase Auth API or dashboard

-- Admin user profile
INSERT INTO users (
  id, 
  email, 
  full_name, 
  role_id, 
  menu_access, 
  sub_menu_access, 
  component_access, 
  is_active
)
SELECT 
  gen_random_uuid(),
  'admin@example.com',
  'System Administrator',
  r.id,
  '["dashboard", "users", "reports", "settings"]'::jsonb,
  '{"users": ["create", "edit", "delete"], "reports": ["view", "export"]}'::jsonb,
  '["user-management", "admin-panel", "reports-dashboard"]'::jsonb,
  true
FROM roles r 
WHERE r.name = 'admin'
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role_id = EXCLUDED.role_id,
  menu_access = EXCLUDED.menu_access,
  sub_menu_access = EXCLUDED.sub_menu_access,
  component_access = EXCLUDED.component_access,
  is_active = EXCLUDED.is_active;

-- Member user profile
INSERT INTO users (
  id, 
  email, 
  full_name, 
  role_id, 
  menu_access, 
  sub_menu_access, 
  component_access, 
  is_active
)
SELECT 
  gen_random_uuid(),
  'member@example.com',
  'Staff Member',
  r.id,
  '["dashboard", "reports"]'::jsonb,
  '{"reports": ["view"]}'::jsonb,
  '["reports-dashboard"]'::jsonb,
  true
FROM roles r 
WHERE r.name = 'member'
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role_id = EXCLUDED.role_id,
  menu_access = EXCLUDED.menu_access,
  sub_menu_access = EXCLUDED.sub_menu_access,
  component_access = EXCLUDED.component_access,
  is_active = EXCLUDED.is_active;

-- Viewer user profile
INSERT INTO users (
  id, 
  email, 
  full_name, 
  role_id, 
  menu_access, 
  sub_menu_access, 
  component_access, 
  is_active
)
SELECT 
  gen_random_uuid(),
  'viewer@example.com',
  'Report Viewer',
  r.id,
  '["dashboard"]'::jsonb,
  '{}'::jsonb,
  '["basic-dashboard"]'::jsonb,
  true
FROM roles r 
WHERE r.name = 'viewer'
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role_id = EXCLUDED.role_id,
  menu_access = EXCLUDED.menu_access,
  sub_menu_access = EXCLUDED.sub_menu_access,
  component_access = EXCLUDED.component_access,
  is_active = EXCLUDED.is_active;
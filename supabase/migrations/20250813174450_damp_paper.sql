/*
  # Create users and role management system

  1. New Tables
    - `users` - User profiles with role and access permissions
    - `roles` - Available system roles
    - `permissions` - System permissions
    - `role_permissions` - Many-to-many relationship between roles and permissions

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to read their own data
    - Add policies for admin users to manage other users

  3. Sample Data
    - Create default roles (admin, member, viewer)
    - Create default permissions
    - Create sample admin user
*/

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource text NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(resource, action)
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role_id uuid REFERENCES roles(id),
  menu_access jsonb DEFAULT '[]'::jsonb,
  sub_menu_access jsonb DEFAULT '{}'::jsonb,
  component_access jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles
CREATE POLICY "Users can read roles"
  ON roles
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for permissions
CREATE POLICY "Users can read permissions"
  ON permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for role_permissions
CREATE POLICY "Users can read role permissions"
  ON role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for users
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admin users can manage all users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'admin'
    )
  );

-- Insert default roles
INSERT INTO roles (name, description) VALUES
  ('admin', 'Full system administrator access'),
  ('member', 'Standard member access'),
  ('viewer', 'Read-only access')
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (resource, action, description) VALUES
  ('users', 'create', 'Create new users'),
  ('users', 'read', 'View user information'),
  ('users', 'update', 'Update user information'),
  ('users', 'delete', 'Delete users'),
  ('dashboard', 'access', 'Access dashboard'),
  ('admin', 'access', 'Access admin panel'),
  ('reports', 'view', 'View financial reports'),
  ('reports', 'export', 'Export financial reports'),
  ('transactions', 'create', 'Create transactions'),
  ('transactions', 'approve', 'Approve transactions')
ON CONFLICT (resource, action) DO NOTHING;

-- Assign permissions to roles
DO $$
DECLARE
  admin_role_id uuid;
  member_role_id uuid;
  viewer_role_id uuid;
BEGIN
  SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';
  SELECT id INTO member_role_id FROM roles WHERE name = 'member';
  SELECT id INTO viewer_role_id FROM roles WHERE name = 'viewer';
  
  -- Admin gets all permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT admin_role_id, id FROM permissions
  ON CONFLICT DO NOTHING;
  
  -- Member gets limited permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT member_role_id, id FROM permissions 
  WHERE (resource = 'dashboard' AND action = 'access')
     OR (resource = 'reports' AND action = 'view')
     OR (resource = 'transactions' AND action = 'create')
  ON CONFLICT DO NOTHING;
  
  -- Viewer gets read-only permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT viewer_role_id, id FROM permissions 
  WHERE (resource = 'dashboard' AND action = 'access')
     OR (resource = 'reports' AND action = 'view')
  ON CONFLICT DO NOTHING;
END $$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
import type { User } from '../types/auth'

export function hasMenuAccess(user: User | null, menuId: string): boolean {
  if (!user || !user.is_active) return false
  return user.menu_access.includes(menuId)
}

export function hasSubMenuAccess(user: User | null, menuId: string, subMenuId: string): boolean {
  if (!user || !user.is_active) return false
  return user.sub_menu_access[menuId]?.includes(subMenuId) || false
}

export function hasComponentAccess(user: User | null, componentId: string): boolean {
  if (!user || !user.is_active) return false
  return user.component_access.includes(componentId)
}

export function hasPermission(user: User | null, resource: string, action: string): boolean {
  if (!user || !user.is_active) return false
  
  // Check if user has admin role - admin has all permissions
  if (user.roles?.some(role => role.name === 'admin')) return true
  
  // Get all role names for the user
  const roleNames = user.roles?.map(role => role.name) || []
  
  switch (resource) {
    case 'admin':
      return roleNames.includes('admin')
    case 'dashboard':
      return roleNames.some(name => ['admin', 'member', 'viewer'].includes(name))
    case 'users':
      return roleNames.includes('admin')
    case 'reports':
      if (action === 'view') return roleNames.some(name => ['admin', 'member', 'viewer'].includes(name))
      if (action === 'export') return roleNames.some(name => ['admin', 'member'].includes(name))
      return false
    case 'transactions':
      if (action === 'create') return roleNames.some(name => ['admin', 'member'].includes(name))
      if (action === 'approve') return roleNames.includes('admin')
      return false
    default:
      return false
  }
}

export function isAdmin(user: User | null): boolean {
  return user?.roles?.some(role => role.name === 'admin') || false
}

export function canAccessAdminPanel(user: User | null): boolean {
  return hasPermission(user, 'admin', 'access')
}
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
  
  // Check if user has the specific permission through their roles
  return user.permissions?.some(permission => 
    permission.resource === resource && permission.action === action
  ) || false
}

export function isAdmin(user: User | null): boolean {
  return user?.roles?.some(role => role.name === 'admin') || false
}

export function canAccessAdminPanel(user: User | null): boolean {
  return hasPermission(user, 'admin', 'access')
}
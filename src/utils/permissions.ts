import type { User } from '../types/auth'

// Cache for permission checks to avoid repeated calculations
const permissionCache = new Map<string, boolean>()
const CACHE_EXPIRY = 5 * 60 * 1000 // 5 minutes
let lastCacheClean = Date.now()

// Clean expired cache entries periodically
function cleanPermissionCache() {
  const now = Date.now()
  if (now - lastCacheClean > CACHE_EXPIRY) {
    permissionCache.clear()
    lastCacheClean = now
  }
}

// Generate cache key for permission checks
function getCacheKey(userId: string, resource: string, action: string): string {
  return `${userId}:${resource}:${action}`
}

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
  
  // Clean expired cache entries
  cleanPermissionCache()
  
  // Check cache first for performance
  const cacheKey = getCacheKey(user.id, resource, action)
  if (permissionCache.has(cacheKey)) {
    return permissionCache.get(cacheKey)!
  }
  
  let hasAccess = false
  
  // Check if user has admin role - admin has all permissions
  if (user.roles?.some(role => role.name === 'admin')) {
    hasAccess = true
  } else {
    // Check if user has the specific permission through their roles
    hasAccess = user.permissions?.some(permission => 
      permission.resource === resource && permission.action === action
    ) || false
  }
  
  // Cache the result
  permissionCache.set(cacheKey, hasAccess)
  
  return hasAccess
}

export function isAdmin(user: User | null): boolean {
  if (!user || !user.is_active) return false
  
  // Clean expired cache entries
  cleanPermissionCache()
  
  // Check cache first
  const cacheKey = getCacheKey(user.id, 'admin', 'check')
  if (permissionCache.has(cacheKey)) {
    return permissionCache.get(cacheKey)!
  }
  
  const isUserAdmin = user.roles?.some(role => role.name === 'admin') || false
  
  // Cache the result
  permissionCache.set(cacheKey, isUserAdmin)
  
  return isUserAdmin
}

export function canAccessAdminPanel(user: User | null): boolean {
  return hasPermission(user, 'admin', 'access')
}

// Clear permission cache when user data changes (call this from AuthContext)
export function clearPermissionCache(): void {
  permissionCache.clear()
  lastCacheClean = Date.now()
}
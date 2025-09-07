// src/lib/dataFetching.ts
import { supabase } from './supabase'
import type { User, Role, Permission, CreateUserData, UpdateUserData, CreateRoleData, UpdateRoleData, CreatePermissionData, UpdatePermissionData, PasswordValidationResult } from '../types/auth'

const API_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function handleResponse(response: Response) {
  const data = await response.json()
  if (!response.ok) {
    throw new ApiError(response.status, data.error || 'Request failed')
  }
  return data
}

// Auth headers
export const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('No active session. Please log in again.')
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

// -------------------- User Profile API --------------------
export const userProfileApi = {
  async fetchUserProfile(userId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id, email, full_name, is_active, needs_password_reset,
        menu_access, sub_menu_access, component_access,
        created_at, updated_at,
        user_roles(
          roles!inner(
            id, name, description,
            role_permissions(
              permissions!inner(
                id, resource, action, description
              )
            )
          )
        )
      `)
      .eq('id', userId)
      .single()
    if (error) throw error
    const roles = data.user_roles?.map(ur => ur.roles).filter(Boolean) || []
    const allPermissions = roles.flatMap(role => role.role_permissions?.map(rp => rp.permissions).filter(Boolean) || [])
    const uniquePermissions = allPermissions.filter((permission, index, array) =>
      array.findIndex(p => p.resource === permission.resource && p.action === permission.action) === index
    )
    return { ...data, roles, role_ids: roles.map(r => r.id), permissions: uniquePermissions }
  }
}

// -------------------- Dashboard API --------------------
export const dashboardApi = {
  async getRecentActivity(): Promise<any[]> {
    return [
      { id: '1', type: 'user_registered', description: 'New user registered', timestamp: new Date().toISOString(), status: 'success' },
      { id: '2', type: 'transaction_approved', description: 'Transaction approved', timestamp: new Date().toISOString(), status: 'info' },
    ]
  },
  async getStats(): Promise<any[]> {
    return [
      { name: 'Total Users', value: '2,847', change: '+4.75%', changeType: 'positive' as const },
      { name: 'Active Transactions', value: '₹1,31,42,000', change: '+8.2%', changeType: 'positive' as const },
    ]
  }
}

// -------------------- Admin Users API --------------------
export const adminUsersApi = {
  async getUsers(): Promise<{ users: User[] }> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/admin-users`, { method: 'GET', headers })
    return handleResponse(response)
  },
  async createUser(userData: CreateUserData): Promise<{ user: User }> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/admin-users`, { method: 'POST', headers, body: JSON.stringify(userData) })
    return handleResponse(response)
  },
  async updateUser(userId: string, userData: UpdateUserData): Promise<{ user: User }> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/admin-users/${userId}`, { method: 'PUT', headers, body: JSON.stringify(userData) })
    return handleResponse(response)
  },
  async deleteUser(userId: string): Promise<{ message: string }> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/admin-users/${userId}`, { method: 'DELETE', headers })
    return handleResponse(response)
  }
}

// -------------------- Roles API --------------------
export const rolesApi = {
  async getRoles(): Promise<Role[]> {
    const { data, error } = await supabase
      .from('roles')
      .select(`*, role_permissions(permissions(id, resource, action, description))`)
      .order('name')
    if (error) throw error
    return data?.map(role => ({ ...role, permissions: role.role_permissions?.map(rp => rp.permissions).filter(Boolean) || [] })) || []
  }
}

// -------------------- Admin Roles API --------------------
export const adminRolesApi = {
  async getRoles(): Promise<Role[]> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/admin-roles`, { method: 'GET', headers })
    const result = await handleResponse(response)
    return result.roles
  },
  async createRole(roleData: CreateRoleData) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/admin-roles`, { method: 'POST', headers, body: JSON.stringify(roleData) })
    return handleResponse(response)
  },
  async updateRole(roleId: string, roleData: UpdateRoleData) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/admin-roles/${roleId}`, { method: 'PUT', headers, body: JSON.stringify(roleData) })
    return handleResponse(response)
  },
  async deleteRole(roleId: string) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/admin-roles/${roleId}`, { method: 'DELETE', headers })
    return handleResponse(response)
  }
}

// -------------------- Admin Permissions API --------------------
export const adminPermissionsApi = {
  async getPermissions(): Promise<Permission[]> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/admin-permissions`, { method: 'GET', headers })
    const result = await handleResponse(response)
    return result.permissions
  },
  async createPermission(permissionData: CreatePermissionData) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/admin-permissions`, { method: 'POST', headers, body: JSON.stringify(permissionData) })
    return handleResponse(response)
  },
  async updatePermission(permissionId: string, permissionData: UpdatePermissionData) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/admin-permissions/${permissionId}`, { method: 'PUT', headers, body: JSON.stringify(permissionData) })
    return handleResponse(response)
  },
  async deletePermission(permissionId: string) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/admin-permissions/${permissionId}`, { method: 'DELETE', headers })
    return handleResponse(response)
  }
}

// -------------------- Password Validation API --------------------
export const passwordValidationApi = {
  async validatePassword(password: string): Promise<PasswordValidationResult> {
    const response = await fetch(`${API_BASE_URL}/validate-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
    if (!response.ok) {
      const errorData = await response.json()
      throw new ApiError(response.status, errorData.message || 'Server-side validation failed')
    }
    return handleResponse(response)
  }
}

// -------------------- Auth API --------------------
export const authApi = {
  async updatePassword(newPassword: string, clearNeedsPasswordReset = false) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/update-password`, { method: 'POST', headers, body: JSON.stringify({ newPassword, clearNeedsPasswordReset }) })
    return handleResponse(response)
  }
}

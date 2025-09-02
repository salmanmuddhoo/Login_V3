import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryClient'
import { Plus, Search, Edit, Trash2, Shield, Users } from 'lucide-react'
import { adminRolesApi, adminPermissionsApi, ApiError } from '../lib/dataFetching'
import type { Role, Permission, CreateRoleData, UpdateRoleData } from '../types/auth'

export function AdminRoles() {
  const queryClient = useQueryClient()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch roles and permissions
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: queryKeys.adminRoles(),
    queryFn: adminRolesApi.getRoles,
  })

  const { data: permissions = [] } = useQuery({
    queryKey: queryKeys.adminPermissions(),
    queryFn: adminPermissionsApi.getPermissions,
  })

  // Mutations for role operations
  const createRoleMutation = useMutation({
    mutationFn: adminRolesApi.createRole,
    onSuccess: () => {
      setSuccess('Role created successfully')
      setShowCreateModal(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.adminRoles() })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers() })
    },
    onError: (error) => {
      setError(error instanceof ApiError ? error.message : 'Failed to create role')
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ roleId, roleData }: { roleId: string; roleData: UpdateRoleData }) =>
      adminRolesApi.updateRole(roleId, roleData),
    onSuccess: () => {
      setSuccess('Role updated successfully')
      setShowEditModal(false)
      setSelectedRole(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.adminRoles() })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers() })
    },
    onError: (error) => {
      setError(error instanceof ApiError ? error.message : 'Failed to update role')
    },
  })

  const deleteRoleMutation = useMutation({
    mutationFn: adminRolesApi.deleteRole,
    onSuccess: () => {
      setSuccess('Role deleted successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.adminRoles() })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers() })
    },
    onError: (error) => {
      setError(error instanceof ApiError ? error.message : 'Failed to delete role')
    },
  })

  const handleCreateRole = (roleData: CreateRoleData) => {
    createRoleMutation.mutate(roleData)
  }

  const handleUpdateRole = (roleData: UpdateRoleData) => {
    if (!selectedRole) return
    updateRoleMutation.mutate({ roleId: selectedRole.id, roleData })
  }

  const handleDeleteRole = (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role? This action cannot be undone.')) return
    deleteRoleMutation.mutate(roleId)
  }

  const loading = rolesLoading || createRoleMutation.isPending || updateRoleMutation.isPending || deleteRoleMutation.isPending

  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6 pt-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Shield className="h-7 w-7 text-emerald-600 mr-2" />
            Role Management
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Create and manage system roles with granular permissions
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Role
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          placeholder="Search roles..."
        />
      </div>

      {/* Roles Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredRoles.map((role) => (
              <li key={role.id}>
                <div className="px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                          <Shield className="h-5 w-5 text-emerald-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {role.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {role.description || 'No description'}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {role.permissions?.length || 0} permissions assigned
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedRole(role)
                          setShowEditModal(true)
                        }}
                        className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {role.name !== 'admin' && (
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Permissions List */}
                  {role.permissions && role.permissions.length > 0 && (
                    <div className="mt-3 ml-14">
                      <div className="flex flex-wrap gap-2">
                        {role.permissions.map((permission) => (
                          <span
                            key={permission.id}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {permission.resource}.{permission.action}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateRoleModal
          permissions={permissions}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateRole}
        />
      )}
      {showEditModal && selectedRole && (
        <EditRoleModal
          role={selectedRole}
          permissions={permissions}
          onClose={() => {
            setShowEditModal(false)
            setSelectedRole(null)
          }}
          onSubmit={handleUpdateRole}
        />
      )}
    </div>
  )
}

// Create Role Modal Component
function CreateRoleModal({ 
  permissions, 
  onClose, 
  onSubmit 
}: { 
  permissions: Permission[]
  onClose: () => void
  onSubmit: (roleData: CreateRoleData) => void
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permission_ids: [] as string[]
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permission_ids: checked 
        ? [...new Set([...prev.permission_ids, permissionId])]
        : prev.permission_ids.filter(id => id !== permissionId)
    }))
  }

  // Group permissions by resource
  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.resource]) {
      acc[permission.resource] = []
    }
    acc[permission.resource].push(permission)
    return acc
  }, {} as Record<string, Permission[]>)

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-[600px] shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Role</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Role Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g., IT Officer, Finance Manager"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                rows={3}
                placeholder="Describe the role's responsibilities"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md p-3">
                {Object.entries(groupedPermissions).map(([resource, resourcePermissions]) => (
                  <div key={resource} className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2 capitalize">{resource}</h4>
                    <div className="space-y-2 ml-4">
                      {resourcePermissions.map((permission) => (
                        <label key={permission.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.permission_ids.includes(permission.id)}
                            onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            {permission.action}
                            {permission.description && (
                              <span className="text-gray-500"> - {permission.description}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
              >
                Create Role
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Edit Role Modal Component
function EditRoleModal({ 
  role, 
  permissions, 
  onClose, 
  onSubmit 
}: { 
  role: Role
  permissions: Permission[]
  onClose: () => void
  onSubmit: (roleData: UpdateRoleData) => void
}) {
  const [formData, setFormData] = useState({
    name: role.name,
    description: role.description || '',
    permission_ids: role.permissions?.map(p => p.id) || []
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permission_ids: checked 
        ? [...new Set([...prev.permission_ids, permissionId])]
        : prev.permission_ids.filter(id => id !== permissionId)
    }))
  }

  // Group permissions by resource
  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.resource]) {
      acc[permission.resource] = []
    }
    acc[permission.resource].push(permission)
    return acc
  }, {} as Record<string, Permission[]>)

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-[600px] shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Role</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Role Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                disabled={role.name === 'admin'}
              />
              {role.name === 'admin' && (
                <p className="text-xs text-gray-500 mt-1">Admin role name cannot be changed</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md p-3">
                {Object.entries(groupedPermissions).map(([resource, resourcePermissions]) => (
                  <div key={resource} className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2 capitalize">{resource}</h4>
                    <div className="space-y-2 ml-4">
                      {resourcePermissions.map((permission) => (
                        <label key={permission.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.permission_ids.includes(permission.id)}
                            onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            {permission.action}
                            {permission.description && (
                              <span className="text-gray-500"> - {permission.description}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
              >
                Update Role
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
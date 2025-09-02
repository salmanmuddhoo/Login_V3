import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryClient'
import { Plus, Search, Edit, Trash2, Key, Shield } from 'lucide-react'
import { adminPermissionsApi, ApiError } from '../lib/dataFetching'
import type { Permission, CreatePermissionData, UpdatePermissionData } from '../types/auth'

export function AdminPermissions() {
  const queryClient = useQueryClient()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch permissions
  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: queryKeys.adminPermissions(),
    queryFn: adminPermissionsApi.getPermissions,
  })

  // Mutations for permission operations
  const createPermissionMutation = useMutation({
    mutationFn: adminPermissionsApi.createPermission,
    onSuccess: () => {
      setSuccess('Permission created successfully')
      setShowCreateModal(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPermissions() })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminRoles() })
    },
    onError: (error) => {
      setError(error instanceof ApiError ? error.message : 'Failed to create permission')
    },
  })

  const updatePermissionMutation = useMutation({
    mutationFn: ({ permissionId, permissionData }: { permissionId: string; permissionData: UpdatePermissionData }) =>
      adminPermissionsApi.updatePermission(permissionId, permissionData),
    onSuccess: () => {
      setSuccess('Permission updated successfully')
      setShowEditModal(false)
      setSelectedPermission(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPermissions() })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminRoles() })
    },
    onError: (error) => {
      setError(error instanceof ApiError ? error.message : 'Failed to update permission')
    },
  })

  const deletePermissionMutation = useMutation({
    mutationFn: adminPermissionsApi.deletePermission,
    onSuccess: () => {
      setSuccess('Permission deleted successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPermissions() })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminRoles() })
    },
    onError: (error) => {
      setError(error instanceof ApiError ? error.message : 'Failed to delete permission')
    },
  })

  const handleCreatePermission = (permissionData: CreatePermissionData) => {
    createPermissionMutation.mutate(permissionData)
  }

  const handleUpdatePermission = (permissionData: UpdatePermissionData) => {
    if (!selectedPermission) return
    updatePermissionMutation.mutate({ permissionId: selectedPermission.id, permissionData })
  }

  const handleDeletePermission = (permissionId: string) => {
    if (!confirm('Are you sure you want to delete this permission? This action cannot be undone.')) return
    deletePermissionMutation.mutate(permissionId)
  }

  const loading = permissionsLoading || createPermissionMutation.isPending || updatePermissionMutation.isPending || deletePermissionMutation.isPending

  const filteredPermissions = permissions.filter(permission =>
    permission.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
    permission.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (permission.description && permission.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Group filtered permissions by resource
  const groupedPermissions = filteredPermissions.reduce((acc, permission) => {
    if (!acc[permission.resource]) {
      acc[permission.resource] = []
    }
    acc[permission.resource].push(permission)
    return acc
  }, {} as Record<string, Permission[]>)

  return (
    <div className="space-y-6 pt 24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Key className="h-7 w-7 text-emerald-600 mr-2" />
            Permission Management
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Create and manage system permissions for granular access control
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Permission
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
          placeholder="Search permissions..."
        />
      </div>

      {/* Permissions Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <div className="space-y-6 p-6">
            {Object.entries(groupedPermissions).map(([resource, resourcePermissions]) => (
              <div key={resource} className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4 capitalize flex items-center">
                  <Shield className="h-5 w-5 text-emerald-600 mr-2" />
                  {resource} Permissions
                </h3>
                <div className="space-y-3">
                  {resourcePermissions.map((permission) => (
                    <div key={permission.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {permission.resource}.{permission.action}
                        </div>
                        <div className="text-sm text-gray-500">
                          {permission.description || 'No description'}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedPermission(permission)
                            setShowEditModal(true)
                          }}
                          className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePermission(permission.id)}
                          className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreatePermissionModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreatePermission}
        />
      )}
      {showEditModal && selectedPermission && (
        <EditPermissionModal
          permission={selectedPermission}
          onClose={() => {
            setShowEditModal(false)
            setSelectedPermission(null)
          }}
          onSubmit={handleUpdatePermission}
        />
      )}
    </div>
  )
}

// Create Permission Modal Component
function CreatePermissionModal({ 
  onClose, 
  onSubmit 
}: { 
  onClose: () => void
  onSubmit: (permissionData: CreatePermissionData) => void
}) {
  const [formData, setFormData] = useState({
    resource: '',
    action: '',
    description: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Permission</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Resource</label>
              <input
                type="text"
                required
                value={formData.resource}
                onChange={(e) => setFormData(prev => ({ ...prev, resource: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g., users, reports, transactions"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Action</label>
              <input
                type="text"
                required
                value={formData.action}
                onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g., create, read, update, delete"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                rows={3}
                placeholder="Describe what this permission allows"
              />
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
                Create Permission
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Edit Permission Modal Component
function EditPermissionModal({ 
  permission, 
  onClose, 
  onSubmit 
}: { 
  permission: Permission
  onClose: () => void
  onSubmit: (permissionData: UpdatePermissionData) => void
}) {
  const [formData, setFormData] = useState({
    resource: permission.resource,
    action: permission.action,
    description: permission.description || ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Permission</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Resource</label>
              <input
                type="text"
                required
                value={formData.resource}
                onChange={(e) => setFormData(prev => ({ ...prev, resource: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Action</label>
              <input
                type="text"
                required
                value={formData.action}
                onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
              />
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
                Update Permission
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
import React, { useState, useEffect } from 'react'
import { useLoaderData } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryClient'
import { Plus, Search, Edit, Trash2, Shield } from 'lucide-react'
import { adminUsersApi, adminRolesApi, ApiError } from '../lib/dataFetching'
import { generateTemporaryPassword } from '../utils/validation'
import type { User, Role, CreateUserData, UpdateUserData } from '../types/auth'

export function AdminUsers() {
  const queryClient = useQueryClient()
  const loaderData = useLoaderData() as { users: User[]; roles: Role[] }
  
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Use React Query with initial data from loader
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: queryKeys.adminUsers(),
    queryFn: adminUsersApi.getUsers,
    initialData: { users: loaderData.users },
  })

  const { data: roles } = useQuery({
    queryKey: queryKeys.adminRoles(),
    queryFn: adminRolesApi.getRoles,
    initialData: loaderData.roles,
  })

  // Mutations for user operations
  const createUserMutation = useMutation({
    mutationFn: adminUsersApi.createUser,
    onSuccess: () => {
      setSuccess('User created successfully')
      setShowCreateModal(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers() })
    },
    onError: (error) => {
      setError(error instanceof ApiError ? error.message : 'Failed to create user')
    },
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, userData }: { userId: string; userData: UpdateUserData }) =>
      adminUsersApi.updateUser(userId, userData),
    onSuccess: () => {
      setSuccess('User updated successfully')
      setShowEditModal(false)
      setSelectedUser(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers() })
    },
    onError: (error) => {
      setError(error instanceof ApiError ? error.message : 'Failed to update user')
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: adminUsersApi.deleteUser,
    onSuccess: () => {
      setSuccess('User deleted successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers() })
    },
    onError: (error) => {
      setError(error instanceof ApiError ? error.message : 'Failed to delete user')
    },
  })

  const handleCreateUser = (userData: CreateUserData) => {
    createUserMutation.mutate(userData)
  }

  const handleUpdateUser = (userData: UpdateUserData) => {
    if (!selectedUser) return
    updateUserMutation.mutate({ userId: selectedUser.id, userData })
  }

  const handleDeleteUser = (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    deleteUserMutation.mutate(userId)
  }

  const users = usersData?.users || []
  const loading = usersLoading || createUserMutation.isPending || updateUserMutation.isPending || deleteUserMutation.isPending

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6 pt-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
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
          placeholder="Search users..."
        />
      </div>

      {/* Users Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <li key={user.id}>
                <div className="px-4 py-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-emerald-600" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900">
                          {user.full_name || 'No name'}
                        </div>
                        <div className="ml-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {user.needs_password_reset && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Password Reset Required
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                      <div className="text-sm text-gray-500">
                        Roles: {user.roles?.map(role => role.name).join(', ') || 'No roles'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedUser(user)
                        setShowEditModal(true)
                      }}
                      className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateUserModal
          roles={roles || []}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateUser}
        />
      )}
      {showEditModal && selectedUser && (
        <EditUserModal
          user={selectedUser}
          roles={roles || []}
          onClose={() => {
            setShowEditModal(false)
            setSelectedUser(null)
          }}
          onSubmit={handleUpdateUser}
        />
      )}
    </div>
  )
}

// Create User Modal Component
function CreateUserModal({ 
  roles, 
  onClose, 
  onSubmit 
}: { 
  roles: Role[]
  onClose: () => void
  onSubmit: (userData: CreateUserData) => void
}) {
  const [formData, setFormData] = useState({
    email: '',
    password: generateTemporaryPassword(),
    full_name: '',
    role_ids: [] as string[],
    menu_access: [] as string[],
    sub_menu_access: {} as Record<string, string[]>,
    component_access: [] as string[]
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.role_ids.length === 0) {
      alert('Please select at least one role')
      return
    }
    onSubmit(formData)
  }

  const handleRoleChange = (roleId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      role_ids: checked 
        ? [...new Set([...prev.role_ids, roleId])]
        : prev.role_ids.filter(id => id !== roleId)
    }))
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New User</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Temporary Password</label>
              <input
                type="text"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="text-xs text-gray-500 mt-1">User will be required to change this password on first login</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Roles</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.role_ids.includes(role.id)}
                      onChange={(e) => handleRoleChange(role.id, e.target.checked)}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{role.name}</span>
                  </label>
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
                Create User
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Edit User Modal Component
function EditUserModal({ 
  user, 
  roles, 
  onClose, 
  onSubmit 
}: { 
  user: User
  roles: Role[]
  onClose: () => void
  onSubmit: (userData: UpdateUserData) => void
}) {
  const [formData, setFormData] = useState({
    full_name: user.full_name,
    role_ids: user.role_ids || [],
    menu_access: user.menu_access || [],
    sub_menu_access: user.sub_menu_access || {},
    component_access: user.component_access || [],
    is_active: user.is_active,
    needs_password_reset: user.needs_password_reset || false
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.role_ids.length === 0) {
      alert('Please select at least one role')
      return
    }
    onSubmit(formData)
  }

  const handleRoleChange = (roleId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      role_ids: checked 
        ? [...new Set([...prev.role_ids, roleId])]
        : prev.role_ids.filter(id => id !== roleId)
    }))
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Edit User</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={user.email}
                disabled
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Roles</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.role_ids.includes(role.id)}
                      onChange={(e) => handleRoleChange(role.id, e.target.checked)}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{role.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">Active</label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="needs_password_reset"
                checked={formData.needs_password_reset}
                onChange={(e) => setFormData(prev => ({ ...prev, needs_password_reset: e.target.checked }))}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="needs_password_reset" className="ml-2 text-sm text-gray-700">
                Require password reset
              </label>
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
                Update User
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
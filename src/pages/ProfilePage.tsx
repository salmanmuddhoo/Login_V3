import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { User, Mail, Edit, CheckCircle, AlertCircle, Shield } from 'lucide-react'
import ChangePasswordForm from '../components/ChangePasswordForm'

export function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '')
    }
  }, [user])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setIsSuccess(false)
    setIsLoading(true)

    if (!user) {
      setMessage('User not authenticated.')
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('id', user.id)

      if (error) throw error

      await refreshUser()
      setMessage('Profile updated successfully!')
      setIsSuccess(true)
      setIsEditing(false)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update profile.')
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Profile</h1>
        <p className="mt-1 text-sm text-gray-600">
          View and manage your personal information and password.
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-md ${isSuccess ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'} flex items-start`}>
          {isSuccess ? (
            <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 mr-3 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" />
          )}
          <div className={`text-sm ${isSuccess ? 'text-green-700' : 'text-red-700'}`}>{message}</div>
        </div>
      )}

      {/* Profile Information */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Personal Information</h3>
        <div className="space-y-4">
          <div className="flex items-center">
            <Mail className="h-5 w-5 text-gray-500 mr-3" />
            <p className="text-gray-700">Email: <span className="font-medium">{user?.email}</span></p>
          </div>
          
          <div className="flex items-center">
            <Shield className="h-5 w-5 text-gray-500 mr-3" />
            <p className="text-gray-700">Role: <span className="font-medium">{user?.roles?.name || 'No role assigned'}</span></p>
          </div>
          
          <div className="flex items-center">
            <User className="h-5 w-5 text-gray-500 mr-3" />
            {isEditing ? (
              <form onSubmit={handleUpdateProfile} className="flex items-center w-full">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 mr-2"
                  placeholder="Full Name"
                  required
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false)
                    setFullName(user?.full_name || '')
                  }}
                  className="ml-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <p className="text-gray-700">Full Name: <span className="font-medium">{user?.full_name || 'Not set'}</span></p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="ml-auto inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-emerald-700 bg-emerald-100 hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Change Password Section */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Change Password</h3>
        <ChangePasswordForm />
      </div>
    </div>
  )
}
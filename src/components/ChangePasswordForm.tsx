// src/components/ChangePasswordForm.tsx
import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const ChangePasswordForm: React.FC = () => {
  const { changePassword, signOut, loading: authLoading } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    try {
      setIsLoading(true)

      // Call changePassword with clearNeedsPasswordReset = false (standard password change)
      await changePassword(newPassword, false)

      // Show success message
      setSuccess('Password changed successfully!')
/*
      // Ask user to sign out
      const confirmLogout = window.confirm(
        'Your password was changed. You need to sign out and log in again. Click OK to sign out now.'
      )
      if (confirmLogout) {
        await signOut()
      }
*/
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err.message || 'Failed to change password.')
    } finally {
      setIsLoading(false)
    }
  }



  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-md">
      <h2 className="text-xl font-bold mb-4">Change Password</h2>

      {error && <p className="text-red-500 mb-2">{error}</p>}
      {success && <p className="text-green-500 mb-2">{success}</p>}

      <div className="mb-4">
        <label className="block mb-1 text-sm font-medium">New Password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
          placeholder="Enter new password"
        />
      </div>

      <div className="mb-4">
        <label className="block mb-1 text-sm font-medium">Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
          placeholder="Confirm new password"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || authLoading || !newPassword || !confirmPassword}
        className="w-full py-2 px-4 bg-emerald-600 text-white font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading || authLoading ? 'Updating password...' : 'Update Password'}
      </button>
    </form>
  )
}

export default ChangePasswordForm
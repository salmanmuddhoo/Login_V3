import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { validatePasswordStrength } from '../utils/validation'
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'

export function ForcePasswordChangePage() {
  const navigate = useNavigate()
  const { user, changePassword, signOut, loading: authLoading } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [passwordValidation, setPasswordValidation] = useState<{
    isValid: boolean
    message: string
    errors: string[]
  } | null>(null)

  useEffect(() => {
    // If user is not logged in or doesn't need password reset, redirect
    if (!authLoading && (!user || !user.needs_password_reset)) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (password) {
      validatePasswordStrength(password).then(result => {
        setPasswordValidation(result)
      })
    } else {
      setPasswordValidation(null)
    }
  }, [password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setIsSuccess(false)
    setIsLoading(true)

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.')
      setIsSuccess(false)
      setIsLoading(false)
      return
    }

    if (!passwordValidation?.isValid) {
      setMessage('Password does not meet strength requirements.')
      setIsSuccess(false)
      setIsLoading(false)
      return
    }

    if (!user) {
      setMessage('User not authenticated.')
      setIsLoading(false)
      return
    }

    try {
      // Call changePassword with clearNeedsPasswordReset = true (forced password change)
      await changePassword(password, true)
      setMessage('Your password has been successfully changed. You will be redirected to the login page.')
      setIsSuccess(true)
      setPassword('')
      setConfirmPassword('')
      
      // Log out the user (signOut will handle redirect)
      setTimeout(() => {
        signOut()
      }, 2000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to change password.')
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading || !user || !user.needs_password_reset) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-16 w-16 bg-emerald-600 rounded-full flex items-center justify-center mb-6">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            Change Your Temporary Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You must change your password before accessing the application.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
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

          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 focus:z-10 sm:text-sm"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {passwordValidation && (
                <div className="mt-2">
                  <p className={`text-xs ${passwordValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                    {passwordValidation.message}
                  </p>
                  {!passwordValidation.isValid && passwordValidation.errors.length > 0 && (
                    <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
                      {passwordValidation.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 focus:z-10 sm:text-sm"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading || authLoading || !password || !confirmPassword || !passwordValidation?.isValid}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isLoading || authLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Changing password...
                </div>
              ) : (
                'Change Password'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
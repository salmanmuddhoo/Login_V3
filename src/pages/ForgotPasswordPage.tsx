// src/pages/ForgotPasswordPage.tsx
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Shield, CheckCircle, AlertCircle } from 'lucide-react'

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { sendPasswordResetEmail } = useAuth()

  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setIsSuccess(false)

    if (!email) {
      setMessage('Please enter your email.')
      return
    }

    setIsLoading(true)
    try {
      await sendPasswordResetEmail(email)
      setMessage('Password reset email sent! Please check your inbox.')
      setIsSuccess(true)
      setEmail('')
    } catch (error: any) {
      const errMsg = error?.message || 'Failed to send reset email.'
      setMessage(errMsg)
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-emerald-600 rounded-full flex items-center justify-center mb-6">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Forgot Password</h2>
          <p className="text-sm text-gray-600">
            Enter your email to receive a password reset link
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {message && (
            <div className={`p-4 rounded-md ${isSuccess ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} flex items-start`}>
              {isSuccess ? (
                <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 mr-3 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" />
              )}
              <div className={`text-sm ${isSuccess ? 'text-green-700' : 'text-red-700'}`}>{message}</div>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full py-2 px-4 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending reset link...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="text-center mt-4">
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-emerald-600 hover:text-emerald-500"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}

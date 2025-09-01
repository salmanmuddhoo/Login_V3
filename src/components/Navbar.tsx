import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, User, Shield } from 'lucide-react'

export function Navbar() {
  const { user, signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <nav className="bg-white border-b border-gray-200 fixed w-full z-30 top-0">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-emerald-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">  Portal</h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <Link 
                to="/profile"
                className="flex items-center hover:bg-gray-100 rounded-md px-2 py-1 transition-colors duration-200"
                title="View Profile"
              >
                <User className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm text-gray-700">{user?.full_name || user?.email}</span>
              </Link>
              
              <div className="h-4 w-px bg-gray-200"></div>
              
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                {user?.roles?.name || 'User'}
              </span>
            </div>
            
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 hover:text-gray-700 focus:outline-none transition-colors duration-200"
            >
              {isSigningOut ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-1"></div>
                  Signing out...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-1" />
                  Sign out
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
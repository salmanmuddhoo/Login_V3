import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { hasPermission } from '../utils/permissions'
import {
  Home,
  Users,
  FileText,
  CreditCard,
  Settings,
  BarChart3,
  Shield,
  Key,
} from 'lucide-react'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<any>
  permission?: { resource: string; action: string }
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
    permission: { resource: 'dashboard', action: 'access' }
  },
  {
    name: 'Admin Panel',
    href: '/admin/dashboard',
    icon: Shield,
    permission: { resource: 'admin', action: 'access' }
  },
  {
    name: 'User Management',
    href: '/admin/users',
    icon: Users,
    permission: { resource: 'users', action: 'manage' }
  },
  {
    name: 'Role Management',
    href: '/admin/roles',
    icon: Shield,
    permission: { resource: 'roles', action: 'manage' }
  },
  {
    name: 'Permission Management',
    href: '/admin/permissions',
    icon: Key,
    permission: { resource: 'permissions', action: 'manage' }
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: FileText,
    permission: { resource: 'reports', action: 'view' }
  },
  {
    name: 'Transactions',
    href: '/transactions',
    icon: CreditCard,
    permission: { resource: 'transactions', action: 'create' }
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    permission: { resource: 'reports', action: 'view' }
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings
  }
]

export function Sidebar() {
  const location = useLocation()
  const { user } = useAuth()

  const filteredNavigation = navigation.filter(item => {
    if (!item.permission) return true
    return hasPermission(user, item.permission.resource, item.permission.action)
  })

  return (
    <aside className="bg-white w-64 min-h-screen border-r border-gray-200 fixed left-0 top-16 z-20">
      <div className="flex flex-col h-full">
        <nav className="flex-1 px-4 py-6 space-y-1">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href
            const Icon = item.icon
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
                  isActive
                    ? 'bg-emerald-100 text-emerald-900 border-r-2 border-emerald-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon
                  className={`flex-shrink-0 -ml-1 mr-3 h-5 w-5 ${
                    isActive ? 'text-emerald-600' : 'text-gray-400 group-hover:text-gray-500'
                  }`}
                />
                <span className="truncate">{item.name}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
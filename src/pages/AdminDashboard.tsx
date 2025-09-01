import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  Users, 
  Shield, 
  Settings,
  BarChart3,
  UserPlus,
  Activity,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

const adminStats = [
  {
    name: 'Total Users',
    value: '2,651',
    description: 'Registered system users',
    icon: Users,
    color: 'bg-blue-500'
  },
  {
    name: 'Active Sessions',
    value: '127',
    description: 'Currently logged in users',
    icon: Activity,
    color: 'bg-green-500'
  },
  {
    name: 'Pending Approvals',
    value: '8',
    description: 'Awaiting admin approval',
    icon: AlertCircle,
    color: 'bg-yellow-500'
  },
  {
    name: 'System Health',
    value: '98.5%',
    description: 'Overall system uptime',
    icon: CheckCircle,
    color: 'bg-emerald-500'
  },
]

const quickActions = [
  {
    name: 'User Management',
    description: 'Add, edit, or remove users',
    href: '/admin/users',
    icon: Users,
    color: 'bg-blue-500'
  },
  {
    name: 'Role Management',
    description: 'Create and manage user roles',
    href: '/admin/roles',
    icon: Shield,
    color: 'bg-emerald-500'
  },
  {
    name: 'Permission Management',
    description: 'Define system permissions',
    href: '/admin/permissions',
    icon: Settings,
    color: 'bg-purple-500'
  },
  {
    name: 'System Settings',
    description: 'Configure system parameters',
    href: '/admin/settings',
    icon: Settings,
    color: 'bg-gray-500'
  },
  {
    name: 'Analytics',
    description: 'View detailed system analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    color: 'bg-purple-500'
  },
  {
    name: 'Add New User',
    description: 'Create a new user account',
    href: '/admin/users/new',
    icon: UserPlus,
    color: 'bg-emerald-500'
  },
]

export function AdminDashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Shield className="h-7 w-7 text-emerald-600 mr-2" />
            Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            System administration and management overview
          </p>
        </div>
      </div>

      {/* Admin Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {adminStats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.name}
              className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:shadow-md transition-shadow duration-200"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`${stat.color} rounded-md p-3`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {stat.name}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stat.value}
                      </dd>
                      <dd className="text-sm text-gray-500">
                        {stat.description}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.name}
                  to={action.href}
                  className="group p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                >
                  <div className={`${action.color} rounded-md p-2 w-fit mb-3`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h4 className="font-medium text-gray-900 group-hover:text-gray-800">
                    {action.name}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {action.description}
                  </p>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent Admin Activity */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Recent Admin Activity
          </h3>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 h-2 w-2 bg-green-400 rounded-full"></div>
              <p className="text-sm text-gray-600">
                User <span className="font-medium">Fatima Al-Zahra</span> was activated by {user?.full_name}
              </p>
              <span className="text-xs text-gray-400">2 minutes ago</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 h-2 w-2 bg-blue-400 rounded-full"></div>
              <p className="text-sm text-gray-600">
                New user <span className="font-medium">Omar Khalid</span> created by {user?.full_name}
              </p>
              <span className="text-xs text-gray-400">15 minutes ago</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 h-2 w-2 bg-yellow-400 rounded-full"></div>
              <p className="text-sm text-gray-600">
                System backup completed successfully
              </p>
              <span className="text-xs text-gray-400">1 hour ago</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 h-2 w-2 bg-purple-400 rounded-full"></div>
              <p className="text-sm text-gray-600">
                User roles updated for <span className="font-medium">Aisha Rahman</span>
              </p>
              <span className="text-xs text-gray-400">2 hours ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
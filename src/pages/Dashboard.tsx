import React from 'react'
import { useLoaderData } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryClient'
import { dashboardApi } from '../lib/dataFetching'
import { useAuth } from '../contexts/AuthContext'
import { hasPermission } from '../utils/permissions'
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  FileText,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'

const defaultStats = [
  {
    name: 'Total Users',
    value: '2,651',
    change: '+4.75%',
    changeType: 'positive' as const,
    icon: Users,
    permission: { resource: 'users', action: 'read' }
  },
  {
    name: 'Active Transactions',
    value: '₹1,24,35,000',
    change: '+12.5%',
    changeType: 'positive' as const,
    icon: DollarSign,
    permission: { resource: 'transactions', action: 'create' }
  },
  {
    name: 'Monthly Growth',
    value: '23.4%',
    change: '+2.1%',
    changeType: 'positive' as const,
    icon: TrendingUp,
    permission: { resource: 'reports', action: 'view' }
  },
  {
    name: 'Reports Generated',
    value: '145',
    change: '-1.2%',
    changeType: 'negative' as const,
    icon: FileText,
    permission: { resource: 'reports', action: 'view' }
  },
]

export function Dashboard() {
  const { user } = useAuth()
  const loaderData = useLoaderData() as { stats: any[]; activity: any[] }

  // Use React Query with initial data from loader
  const { data: stats = defaultStats } = useQuery({
    queryKey: queryKeys.dashboardStats(),
    queryFn: dashboardApi.getStats,
    initialData: loaderData.stats.length > 0 ? loaderData.stats : defaultStats,
    staleTime: 10 * 60 * 1000, // Dashboard stats can be cached longer (10 minutes)
    placeholderData: (previousData) => previousData,
  })

  const { data: recentActivity = [] } = useQuery({
    queryKey: queryKeys.dashboardActivity(),
    queryFn: dashboardApi.getRecentActivity,
    initialData: loaderData.activity,
    staleTime: 2 * 60 * 1000, // Activity data should be fresher (2 minutes)
    placeholderData: (previousData) => previousData,
  })

  const visibleStats = stats.filter(stat => {
    if (!stat.permission) return true
    return hasPermission(user, stat.permission.resource, stat.permission.action)
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.full_name || user?.email}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Here's what's happening with your Islamic finance operations today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {visibleStats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.name}
              className="relative bg-white pt-5 px-4 pb-12 sm:pt-6 sm:px-6 shadow-sm rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition-shadow duration-200"
            >
              <dt>
                <div className="absolute bg-emerald-500 rounded-md p-3">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <p className="ml-16 text-sm font-medium text-gray-500 truncate">
                  {stat.name}
                </p>
              </dt>
              <dd className="ml-16 pb-6 flex items-baseline sm:pb-7">
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                <p
                  className={`ml-2 flex items-baseline text-sm font-semibold ${
                    stat.changeType === 'positive'
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {stat.changeType === 'positive' ? (
                    <ArrowUpRight className="h-4 w-4 flex-shrink-0 self-center" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 flex-shrink-0 self-center" />
                  )}
                  <span className="sr-only">
                    {stat.changeType === 'positive' ? 'Increased' : 'Decreased'} by
                  </span>
                  {stat.change}
                </p>
              </dd>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hasPermission(user, 'transactions', 'create') && (
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <DollarSign className="h-6 w-6 text-emerald-600 mb-2" />
                <h4 className="font-medium text-gray-900">New Transaction</h4>
                <p className="text-sm text-gray-600">Create a new Islamic finance transaction</p>
              </button>
            )}
            
            {hasPermission(user, 'reports', 'view') && (
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <FileText className="h-6 w-6 text-emerald-600 mb-2" />
                <h4 className="font-medium text-gray-900">Generate Report</h4>
                <p className="text-sm text-gray-600">Create detailed financial reports</p>
              </button>
            )}
            
            {hasPermission(user, 'users', 'read') && (
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <Users className="h-6 w-6 text-emerald-600 mb-2" />
                <h4 className="font-medium text-gray-900">Manage Users</h4>
                <p className="text-sm text-gray-600">Add or modify user accounts</p>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Recent Activity
          </h3>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-3">
                <div className={`flex-shrink-0 h-2 w-2 rounded-full ${
                  activity.status === 'success' ? 'bg-green-400' :
                  activity.status === 'info' ? 'bg-blue-400' :
                  activity.status === 'warning' ? 'bg-yellow-400' : 'bg-gray-400'
                }`}></div>
                <p className="text-sm text-gray-600">
                  {activity.description}
                </p>
                <span className="text-xs text-gray-400">
                  {new Date(activity.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
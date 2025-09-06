import React, { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryClient'
import { adminUsersApi, rolesApi } from '../lib/dataFetching'
import { useAuth } from '../contexts/AuthContext'
import { hasPermission } from '../utils/permissions'
import { 
  FileText, 
  Search, 
  Download, 
  Users, 
  Filter,
  Calendar,
  Building
} from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { User, Role } from '../types/auth'

export function StaffReportsPage() {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('all')
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  // Fetch users and roles data
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: queryKeys.adminUsers(),
    queryFn: adminUsersApi.getUsers,
  })

  const { data: roles = [] } = useQuery({
    queryKey: queryKeys.roles(),
    queryFn: rolesApi.getRoles,
  })

  const users = usersData?.users || []

  // Filter users based on search term and selected role
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (selectedRole === 'all') return matchesSearch
    
    const userRoleNames = user.roles?.map(role => role.name.toLowerCase()) || []
    return matchesSearch && userRoleNames.includes(selectedRole.toLowerCase())
  })

  // Get role statistics
  const roleStats = {
    total: users.length,
    admin: users.filter(u => u.roles?.some(r => r.name.toLowerCase() === 'admin')).length,
    member: users.filter(u => u.roles?.some(r => r.name.toLowerCase() === 'member')).length,
    viewer: users.filter(u => u.roles?.some(r => r.name.toLowerCase() === 'viewer')).length,
    active: users.filter(u => u.is_active).length,
    inactive: users.filter(u => !u.is_active).length,
  }

  const generatePDF = async () => {
    if (!reportRef.current) return

    setIsGeneratingPDF(true)
    
    try {
      // Create a temporary container for the PDF content
      const pdfContent = document.createElement('div')
      pdfContent.style.position = 'absolute'
      pdfContent.style.left = '-9999px'
      pdfContent.style.top = '0'
      pdfContent.style.width = '210mm' // A4 width
      pdfContent.style.backgroundColor = 'white'
      pdfContent.style.padding = '20mm'
      pdfContent.style.fontFamily = 'Arial, sans-serif'
      
      // Get current date
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      // Get filter description
      const filterDescription = selectedRole === 'all' 
        ? 'All Staff Members' 
        : `${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Staff Members`

      pdfContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #059669; padding-bottom: 20px;">
          <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
            <div style="width: 50px; height: 50px; background-color: #059669; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px;">
              <span style="color: white; font-size: 24px; font-weight: bold;">📊</span>
            </div>
            <div>
              <h1 style="margin: 0; color: #1f2937; font-size: 28px; font-weight: bold;">Staff Management Portal</h1>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Comprehensive Staff Report</p>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 25px;">
          <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 15px; border-left: 4px solid #059669; padding-left: 10px;">
            Report Summary
          </h2>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #059669;">${filteredUsers.length}</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">${filterDescription}</div>
            </div>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #2563eb;">${roleStats.active}</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">Active Staff</div>
            </div>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${roleStats.inactive}</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">Inactive Staff</div>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #6b7280;">
            <span><strong>Report Generated:</strong> ${currentDate}</span>
            <span><strong>Generated by:</strong> ${user?.full_name || user?.email}</span>
          </div>
        </div>

        <div style="margin-bottom: 25px;">
          <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 15px; border-left: 4px solid #059669; padding-left: 10px;">
            Staff Directory - ${filterDescription}
          </h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background-color: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 12px 8px; text-align: left; font-weight: bold; color: #374151;">#</th>
                <th style="padding: 12px 8px; text-align: left; font-weight: bold; color: #374151;">Full Name</th>
                <th style="padding: 12px 8px; text-align: left; font-weight: bold; color: #374151;">Email</th>
                <th style="padding: 12px 8px; text-align: left; font-weight: bold; color: #374151;">Role</th>
                <th style="padding: 12px 8px; text-align: center; font-weight: bold; color: #374151;">Status</th>
                <th style="padding: 12px 8px; text-align: center; font-weight: bold; color: #374151;">Password Reset</th>
              </tr>
            </thead>
            <tbody>
              ${filteredUsers.map((staffUser, index) => `
                <tr style="border-bottom: 1px solid #e5e7eb; ${index % 2 === 0 ? 'background-color: #f9fafb;' : ''}">
                  <td style="padding: 10px 8px; color: #6b7280;">${index + 1}</td>
                  <td style="padding: 10px 8px; color: #1f2937; font-weight: 500;">${staffUser.full_name || 'Not set'}</td>
                  <td style="padding: 10px 8px; color: #1f2937;">${staffUser.email}</td>
                  <td style="padding: 10px 8px; color: #1f2937;">${staffUser.roles?.map(r => r.name).join(', ') || 'No roles'}</td>
                  <td style="padding: 10px 8px; text-align: center;">
                    <span style="padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: 500; ${
                      staffUser.is_active 
                        ? 'background-color: #dcfce7; color: #166534;' 
                        : 'background-color: #fee2e2; color: #dc2626;'
                    }">
                      ${staffUser.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style="padding: 10px 8px; text-align: center;">
                    ${staffUser.needs_password_reset 
                      ? '<span style="padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: 500; background-color: #fef3c7; color: #92400e;">Required</span>'
                      : '<span style="padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: 500; background-color: #f3f4f6; color: #6b7280;">Not Required</span>'
                    }
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 10px;">
          <p style="margin: 0;">This report contains confidential information. Please handle with appropriate security measures.</p>
          <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} Staff Management Portal - Generated on ${currentDate}</p>
        </div>
      `

      document.body.appendChild(pdfContent)

      // Generate canvas from the content
      const canvas = await html2canvas(pdfContent, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      })

      // Remove temporary element
      document.body.removeChild(pdfContent)

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgWidth = 210 // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      // Add the image to PDF
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight)

      // Generate filename
      const filename = `staff-report-${selectedRole}-${new Date().toISOString().split('T')[0]}.pdf`
      
      // Save the PDF
      pdf.save(filename)

    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF report. Please try again.')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  if (!hasPermission(user, 'reports', 'view')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to view reports.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <FileText className="h-7 w-7 text-emerald-600 mr-2" />
            Staff Reports
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            View, search, and generate PDF reports of staff members
          </p>
        </div>
        <button
          onClick={generatePDF}
          disabled={isGeneratingPDF || filteredUsers.length === 0}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGeneratingPDF ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Generating PDF...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Generate PDF Report
            </>
          )}
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Staff</dt>
                  <dd className="text-lg font-medium text-gray-900">{roleStats.total}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Building className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Staff</dt>
                  <dd className="text-lg font-medium text-gray-900">{roleStats.active}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Admins</dt>
                  <dd className="text-lg font-medium text-gray-900">{roleStats.admin}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Calendar className="h-8 w-8 text-orange-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Members</dt>
                  <dd className="text-lg font-medium text-gray-900">{roleStats.member}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Search staff by name or email..."
              />
            </div>
          </div>
          <div className="sm:w-48">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin Only</option>
                <option value="member">Member Only</option>
                <option value="viewer">Viewer Only</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredUsers.length} of {users.length} staff members
          {selectedRole !== 'all' && ` (filtered by ${selectedRole})`}
          {searchTerm && ` (search: "${searchTerm}")`}
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200" ref={reportRef}>
        {usersLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No staff found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || selectedRole !== 'all' 
                ? 'Try adjusting your search or filter criteria.' 
                : 'No staff members are currently in the system.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Staff Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Password Reset
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((staffUser) => (
                  <tr key={staffUser.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                            <Users className="h-5 w-5 text-emerald-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {staffUser.full_name || 'Not set'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{staffUser.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {staffUser.roles?.map((role) => (
                          <span
                            key={role.id}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {role.name}
                          </span>
                        )) || (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            No roles
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        staffUser.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {staffUser.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {staffUser.needs_password_reset ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Required
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Not Required
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(staffUser.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
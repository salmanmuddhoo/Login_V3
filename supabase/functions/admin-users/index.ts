import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface User {
  id: string
  email: string
  full_name: string
  role_ids?: string[]
  menu_access: string[]
  sub_menu_access: Record<string, string[]>
  component_access: string[]
  is_active: boolean
  needs_password_reset: boolean
  roles?: Array<{
    id: string
    name: string
    description: string
  }>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const frontendBaseUrl = Deno.env.get('FRONTEND_BASE_URL') || 'http://localhost:5173'
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: userData, error: userError } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', user.id)

    if (userError || !userData || !userData.some(ur => ur.roles?.name === 'admin')) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const method = req.method

    // GET users
    if (method === 'GET' && url.pathname.endsWith('/admin-users')) {
      // Get all users with their roles in a single optimized query
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select(`
          id, 
          email, 
          full_name, 
          menu_access, 
          sub_menu_access, 
          component_access, 
          is_active, 
          created_at, 
          needs_password_reset,
          user_roles(
            roles(
              id,
              name,
              description,
              role_permissions(
                permissions(
                  id,
                  resource,
                  action,
                  description
                )
              )
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (usersError) return new Response(JSON.stringify({ error: usersError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      // Transform the data to match the expected format
      const users = usersData?.map(user => {
        const userRoles = user.user_roles?.map(ur => ur.roles).filter(Boolean) || []
        
        // Flatten all permissions from all roles
        const allPermissions = userRoles.flatMap(role => 
          role.role_permissions?.map(rp => rp.permissions).filter(Boolean) || []
        )
        
        // Remove duplicate permissions based on resource + action combination
        const uniquePermissions = allPermissions.filter((permission, index, array) => 
          array.findIndex(p => p.resource === permission.resource && p.action === permission.action) === index
        )
        
        return {
          ...user,
          roles: userRoles,
          role_ids: userRoles.map(role => role.id),
          permissions: uniquePermissions
        }
      }) || []

      return new Response(JSON.stringify({ users }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST create user
    if (method === 'POST' && url.pathname.endsWith('/admin-users')) {
      const body = await req.json()
      const { email, password, full_name, role_ids, menu_access, sub_menu_access, component_access } = body

      if (!role_ids || !Array.isArray(role_ids) || role_ids.length === 0) {
        return new Response(JSON.stringify({ error: 'At least one role must be assigned' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      })

      if (authError) return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      const { data: newUser, error: profileError } = await supabase
        .from('users')
        .insert({
          id: authUser.user.id,
          email,
          full_name,
          menu_access: menu_access || [],
          sub_menu_access: sub_menu_access || {},
          component_access: component_access || [],
          needs_password_reset: true
        })
        .select('*')
        .single()

      if (profileError) {
        await supabase.auth.admin.deleteUser(authUser.user.id)
        return new Response(JSON.stringify({ error: profileError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Insert user roles
      const userRoleInserts = role_ids.map(role_id => ({
        user_id: authUser.user.id,
        role_id
      }))

      const { error: userRolesError } = await supabase
        .from('user_roles')
        .insert(userRoleInserts)

      if (userRolesError) {
        await supabase.auth.admin.deleteUser(authUser.user.id)
        return new Response(JSON.stringify({ error: userRolesError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Get the created user with roles
      const { data: userWithRoles, error: fetchError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          roles(
            id, 
            name, 
            description,
            role_permissions(
              permissions(
                id,
                resource,
                action,
                description
              )
            )
          )
        `)
        .eq('user_id', authUser.user.id)

      const roles = userWithRoles?.map(ur => ur.roles).filter(Boolean) || []
      
      // Flatten all permissions from all roles
      const allPermissions = roles.flatMap(role => 
        role.role_permissions?.map(rp => rp.permissions).filter(Boolean) || []
      )
      
      // Remove duplicate permissions
      const uniquePermissions = allPermissions.filter((permission, index, array) => 
        array.findIndex(p => p.resource === permission.resource && p.action === permission.action) === index
      )
      
      const userResponse = {
        ...newUser,
        roles,
        role_ids: roles.map(role => role.id),
        permissions: uniquePermissions
      }

      // Always send password reset email
      try {
        const { error: resetError } = await supabase.auth.admin.generateLink({
          type: 'password_reset',
          email: email,
          redirectTo: `${frontendBaseUrl}/reset-password`
        })
        if (resetError) console.error('Failed to send password reset email:', resetError)
      } catch (err) {
        console.error('Error sending password reset email:', err)
      }

      return new Response(JSON.stringify({ user: userResponse }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // PUT update user
    if (method === 'PUT') {
      const userId = url.pathname.split('/').pop()
      const body = await req.json()
      const { full_name, role_ids, menu_access, sub_menu_access, component_access, is_active, needs_password_reset } = body

      if (!role_ids || !Array.isArray(role_ids) || role_ids.length === 0) {
        return new Response(JSON.stringify({ error: 'At least one role must be assigned' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({ full_name, menu_access, sub_menu_access, component_access, is_active, needs_password_reset })
        .eq('id', userId)
        .select('*')
        .single()

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      // Update user roles - delete existing and insert new ones
      const { error: deleteRolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)

      if (deleteRolesError) return new Response(JSON.stringify({ error: deleteRolesError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      // Insert new user roles
      const userRoleInserts = role_ids.map(role_id => ({
        user_id: userId,
        role_id
      }))

      const { error: insertRolesError } = await supabase
        .from('user_roles')
        .insert(userRoleInserts)

      if (insertRolesError) return new Response(JSON.stringify({ error: insertRolesError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      // Get the updated user with roles
      const { data: userWithRoles, error: fetchError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          roles(
            id, 
            name, 
            description,
            role_permissions(
              permissions(
                id,
                resource,
                action,
                description
              )
            )
          )
        `)
        .eq('user_id', userId)

      const roles = userWithRoles?.map(ur => ur.roles).filter(Boolean) || []
      
      // Flatten all permissions from all roles
      const allPermissions = roles.flatMap(role => 
        role.role_permissions?.map(rp => rp.permissions).filter(Boolean) || []
      )
      
      // Remove duplicate permissions
      const uniquePermissions = allPermissions.filter((permission, index, array) => 
        array.findIndex(p => p.resource === permission.resource && p.action === permission.action) === index
      )
      
      const userResponse = {
        ...updatedUser,
        roles,
        role_ids: roles.map(role => role.id),
        permissions: uniquePermissions
      }

      // Always send password reset email if needs_password_reset is true
      if (needs_password_reset) {
        try {
          const { data: currentUser } = await supabase.from('users').select('email').eq('id', userId).single()
          if (currentUser?.email) {
            const { error: resetError } = await supabase.auth.admin.generateLink({
              type: 'password_reset',
              email: currentUser.email,
              redirectTo: `${frontendBaseUrl}/reset-password`
            })
            if (resetError) console.error('Failed to send password reset email:', resetError)
          }
        } catch (err) {
          console.error('Error sending password reset email:', err)
        }
      }

      return new Response(JSON.stringify({ user: userResponse }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // DELETE user
    if (method === 'DELETE') {
      const userId = url.pathname.split('/').pop()
      const { error: authError } = await supabase.auth.admin.deleteUser(userId!)
      if (authError) return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      return new Response(JSON.stringify({ message: 'User deleted successfully' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

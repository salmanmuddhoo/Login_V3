const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PasswordValidationResult {
  isValid: boolean
  message: string
  errors: string[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { password } = await req.json()

    if (typeof password !== 'string') {
      return new Response(
        JSON.stringify({ 
          isValid: false, 
          message: 'Password must be a string.',
          errors: ['Invalid password format']
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const minLength = 8
    const hasUppercase = /[A-Z]/.test(password)
    const hasLowercase = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)

    const errors: string[] = []
    let isValid = true

    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`)
      isValid = false
    }
    if (!hasUppercase) {
      errors.push('Password must contain at least one uppercase letter')
      isValid = false
    }
    if (!hasLowercase) {
      errors.push('Password must contain at least one lowercase letter')
      isValid = false
    }
    if (!hasNumber) {
      errors.push('Password must contain at least one number')
      isValid = false
    }
    if (!hasSpecialChar) {
      errors.push('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)')
      isValid = false
    }

    const message = isValid 
      ? 'Password meets all strength requirements' 
      : errors.join('. ')

    return new Response(
      JSON.stringify({ isValid, message, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error validating password:', error)
    return new Response(
      JSON.stringify({ 
        isValid: false, 
        message: 'Internal server error during password validation.',
        errors: ['Server error']
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
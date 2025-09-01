import type { PasswordValidationResult } from '../types/auth'

export async function validatePasswordStrength(password: string): Promise<PasswordValidationResult> {
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

  return { isValid, message, errors }
}

// Generate a secure temporary password
export function generateTemporaryPassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const special = '!@#$%^&*'
  
  // Ensure at least one character from each category
  let password = ''
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += special[Math.floor(Math.random() * special.length)]
  
  // Fill remaining length with random characters
  const allChars = uppercase + lowercase + numbers + special
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

// Server-side validation via Edge Function
export const validatePasswordServerSide = async (password: string): Promise<PasswordValidationResult> => {
  try {
    const API_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
    const response = await fetch(`${API_BASE_URL}/validate-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return { 
        isValid: false, 
        message: errorData.message || 'Server-side validation failed.',
        errors: errorData.errors || ['Server error']
      }
    }

    const data = await response.json()
    return data as PasswordValidationResult
  } catch (error) {
    console.error('Error calling password validation Edge Function:', error)
    return { 
      isValid: false, 
      message: 'Could not connect to password validation service.',
      errors: ['Network error']
    }
  }
}
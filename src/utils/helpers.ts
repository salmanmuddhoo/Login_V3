/**
 * Utility functions for common operations
 */

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within the specified time,
 * it will reject with a timeout error.
 * 
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Custom error message for timeout
 * @returns Promise that resolves/rejects within the timeout period
 */
export function withTimeout<T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  errorMessage: string = `Operation timed out after ${timeoutMs}ms`
): Promise<T> {
  return new Promise((resolve, reject) => {
    // Set up the timeout
    const timeoutId = setTimeout(() => {
      reject(new Error(errorMessage))
    }, timeoutMs)

    // Execute the original promise
    promise
      .then((result) => {
        clearTimeout(timeoutId)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}

/**
 * Delays execution for a specified number of milliseconds
 * 
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retries a function a specified number of times with exponential backoff
 * 
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelay - Base delay in milliseconds (will be doubled for each retry)
 * @returns Promise that resolves with the function result or rejects after all retries
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt === maxRetries) {
        throw lastError
      }

      const delayMs = baseDelay * Math.pow(2, attempt)
      console.log(`[retryWithBackoff] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`, lastError.message)
      await delay(delayMs)
    }
  }

  throw lastError!
}

/**
 * Safely compares two objects for equality by JSON stringifying them
 * Handles cases where objects might be null or undefined
 */
export function deepEqual(obj1: any, obj2: any): boolean {
  try {
    return JSON.stringify(obj1) === JSON.stringify(obj2)
  } catch (error) {
    console.error('Error comparing objects:', error)
    return false
  }
}

/**
 * Debounces a function call, useful for search inputs or API calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}
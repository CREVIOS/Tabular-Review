import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from "@/lib/supabase/middleware"
import { File, Review, Folder } from '@/types'
import { createClient } from '@/lib/supabase/server'

// Handle both development and production backend URLs
const getBackendUrl = () => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
  
  // In development, if BACKEND_URL is set to docker name, fallback to localhost
  if (process.env.NODE_ENV === 'development' && backendUrl.includes('backend:8000')) {
    return 'http://localhost:8000'
  }
  
  return backendUrl
}

const BACKEND_URL = getBackendUrl()

export async function GET(request: NextRequest) {
  try {
    console.log('Dashboard API: Using backend URL:', BACKEND_URL)
    console.log('Dashboard API: Environment:', process.env.NODE_ENV)
    
    // Get Supabase session and user
    const { user } = await updateSession(request)
    
    if (!user) {
      console.log('Dashboard API: No authenticated user found')
      return NextResponse.json(
        { error: 'Unauthorized - No authenticated user' },
        { status: 401 }
      )
    }

    console.log('Dashboard API: Authenticated user:', user.email)

    const supabase = await createClient()
    
    // Get the Supabase access token for backend API calls
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      console.log('Dashboard API: No access token found')
      return NextResponse.json(
        { error: 'Unauthorized - No access token' },
        { status: 401 }
      )
    }

    const headers = {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    }

    console.log('Dashboard API: Making parallel requests to backend...')

    // Helper function to make requests with retry logic
    const makeRequestWithRetry = async (url: string, maxRetries = 2) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Dashboard API: Attempt ${attempt} for ${url}`)
          const response = await fetch(url, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(45000), // Increased to 45 seconds
            keepalive: false // Disable keepalive to prevent socket reuse issues
          })
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          
          return response
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          console.error(`Dashboard API: Attempt ${attempt} failed for ${url}:`, errorMessage)
          
          if (attempt === maxRetries) {
            throw err
          }
          
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
          console.log(`Dashboard API: Retrying ${url} after ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // Fetch all dashboard data in parallel with retry logic
    const [documentsResponse, reviewsResponse, foldersResponse] = await Promise.allSettled([
      // Fetch documents/files with retry
      makeRequestWithRetry(`${BACKEND_URL}/api/files/?page=1&limit=25`),
      
      // Fetch reviews with retry
      makeRequestWithRetry(`${BACKEND_URL}/api/reviews/`),
      
      // Fetch folders with retry
      makeRequestWithRetry(`${BACKEND_URL}/api/folders/`),
    ])

    // Process responses and handle errors
    const result: {
      documents: File[]
      reviews: Review[]
      folders: Folder[]
      errors?: string[]
    } = {
      documents: [],
      reviews: [],
      folders: []
    }

    const errors: string[] = []

    // Process documents response
    if (documentsResponse.status === 'fulfilled' && documentsResponse.value && documentsResponse.value.ok) {
      try {
        const documentsText = await documentsResponse.value.text()
        console.log('Dashboard API: Raw documents response:', documentsText.substring(0, 200) + '...')
        
        if (!documentsText || documentsText.trim() === '') {
          console.log('Dashboard API: Documents response is empty')
          result.documents = []
        } else {
          try {
            result.documents = JSON.parse(documentsText)
            console.log(`Dashboard API: Successfully fetched ${result.documents.length} documents`)
          } catch (parseError) {
            console.error('Dashboard API: Failed to parse documents JSON:', parseError)
            console.error('Dashboard API: Documents response content:', documentsText)
            errors.push('Failed to parse documents data - invalid JSON')
            result.documents = []
          }
        }
      } catch (e) {
        console.error('Dashboard API: Failed to read documents response:', e)
        errors.push('Failed to read documents response')
        result.documents = []
      }
    } else {
      const status = (documentsResponse.status === 'fulfilled' && documentsResponse.value) ? documentsResponse.value.status : 'network_error'
      const statusText = (documentsResponse.status === 'fulfilled' && documentsResponse.value) ? documentsResponse.value.statusText : 'Network error'
      console.error(`Dashboard API: Documents request failed with status ${status}: ${statusText}`)
      if (documentsResponse.status === 'rejected') {
        console.error('Dashboard API: Documents request rejected:', documentsResponse.reason)
      }
      
      // Try to get error details if available
      if (documentsResponse.status === 'fulfilled' && documentsResponse.value) {
        try {
          const errorText = await documentsResponse.value.text()
          console.error('Dashboard API: Documents error response body:', errorText)
          errors.push(`Failed to fetch documents (${status}: ${statusText}) - ${errorText}`)
        } catch {
          errors.push(`Failed to fetch documents (${status}: ${statusText})`)
        }
      } else {
        errors.push(`Failed to fetch documents (${status}: ${statusText})`)
      }
      result.documents = []
    }

    // Process reviews response
    if (reviewsResponse.status === 'fulfilled' && reviewsResponse.value && reviewsResponse.value.ok) {
      try {
        const reviewsData = await reviewsResponse.value.json()
        // Handle paginated response or direct array
        if (reviewsData && reviewsData.reviews && Array.isArray(reviewsData.reviews)) {
          result.reviews = reviewsData.reviews
        } else if (Array.isArray(reviewsData)) {
          result.reviews = reviewsData
        } else {
          result.reviews = []
        }
        console.log(`Dashboard API: Successfully fetched ${result.reviews.length} reviews`)
      } catch (e) {
        console.error('Dashboard API: Failed to parse reviews data:', e)
        errors.push('Failed to parse reviews data')
      }
    } else {
      const status = (reviewsResponse.status === 'fulfilled' && reviewsResponse.value) ? reviewsResponse.value.status : 'network_error'
      const statusText = (reviewsResponse.status === 'fulfilled' && reviewsResponse.value) ? reviewsResponse.value.statusText : 'Network error'
      console.error(`Dashboard API: Reviews request failed with status ${status}: ${statusText}`)
      if (reviewsResponse.status === 'rejected') {
        console.error('Dashboard API: Reviews request rejected:', reviewsResponse.reason)
      }
      errors.push(`Failed to fetch reviews (${status}: ${statusText})`)
      result.reviews = []
    }

    // Process folders response
    if (foldersResponse.status === 'fulfilled' && foldersResponse.value && foldersResponse.value.ok) {
      try {
        result.folders = await foldersResponse.value.json()
        console.log(`Dashboard API: Successfully fetched ${result.folders.length} folders`)
      } catch (e) {
        console.error('Dashboard API: Failed to parse folders data:', e)
        errors.push('Failed to parse folders data')
      }
    } else {
      const status = (foldersResponse.status === 'fulfilled' && foldersResponse.value) ? foldersResponse.value.status : 'network_error'
      const statusText = (foldersResponse.status === 'fulfilled' && foldersResponse.value) ? foldersResponse.value.statusText : 'Network error'
      console.error(`Dashboard API: Folders request failed with status ${status}: ${statusText}`)
      if (foldersResponse.status === 'rejected') {
        console.error('Dashboard API: Folders request rejected:', foldersResponse.reason)
      }
      errors.push(`Failed to fetch folders (${status}: ${statusText})`)
      result.folders = []
    }

    // Add errors if any occurred
    if (errors.length > 0) {
      result.errors = errors
      console.log('Dashboard API: Returning partial data with errors:', errors)
    } else {
      console.log('Dashboard API: All requests successful')
    }

    // Calculate some dashboard statistics
    const stats = {
      totalDocuments: result.documents.length,
      totalReviews: result.reviews.length,
      totalFolders: result.folders.length,
      recentDocuments: result.documents.slice(0, 5),
      recentReviews: result.reviews.slice(0, 5),
    }

    return NextResponse.json({
      ...result,
      stats,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Dashboard API: Unexpected error:', error)
    return NextResponse.json(
      { 
        error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        documents: [],
        reviews: [],
        folders: [],
        stats: {
          totalDocuments: 0,
          totalReviews: 0,
          totalFolders: 0,
          recentDocuments: [],
          recentReviews: [],
        }
      },
      { status: 500 }
    )
  }
} 
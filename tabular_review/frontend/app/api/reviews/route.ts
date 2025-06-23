import { NextRequest, NextResponse } from 'next/server'

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
    console.log('Reviews API: Using backend URL:', BACKEND_URL)
    console.log('Reviews API: Environment:', process.env.NODE_ENV)
    
    // Get the authorization token from cookies or headers
    const token = request.cookies.get('auth_token')?.value || 
                  request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!token) {
      console.log('Reviews API: No auth token found')
      console.log('Reviews API: Available cookies:', Object.fromEntries(request.cookies.getAll().map(c => [c.name, c.value])))
      console.log('Reviews API: Authorization header:', request.headers.get('Authorization'))
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      )
    }

    console.log('Reviews API: Using auth token:', token.substring(0, 20) + '...')

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    console.log('Reviews API: Making parallel requests to backend...')

    // Test the backend connection first
    try {
      console.log(`Reviews API: Testing connection to ${BACKEND_URL}/api/health`)
      const healthCheck = await fetch(`${BACKEND_URL}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
      console.log('Reviews API: Health check response:', healthCheck.status, healthCheck.statusText)
    } catch (healthError) {
      console.error('Reviews API: Health check failed:', healthError)
      return NextResponse.json(
        { 
          error: `Backend not reachable: ${healthError instanceof Error ? healthError.message : 'Unknown error'}`,
          reviews: [],
          files: [],
          folders: [],
          stats: {
            total: 0,
            completed: 0,
            processing: 0,
            failed: 0,
            draft: 0,
            totalFiles: 0,
            avgCompletion: 0,
            totalColumns: 0,
          },
          folderStats: {
            totalFolders: 0,
            totalFilesInFolders: 0,
            averageFilesPerFolder: 0,
          }
        },
        { status: 503 }
      )
    }

    // Fetch all review data in parallel
    const [reviewsResponse, filesResponse, foldersResponse] = await Promise.allSettled([
      // Fetch reviews
      fetch(`${BACKEND_URL}/api/reviews/`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15000) // 15 second timeout
      }).catch(err => {
        console.error('Reviews API: Failed to fetch reviews:', err.message)
        console.error('Reviews API: Reviews URL:', `${BACKEND_URL}/api/reviews/`)
        throw err
      }),
      
      // Fetch files
      fetch(`${BACKEND_URL}/api/files/`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15000) // 15 second timeout
      }).catch(err => {
        console.error('Reviews API: Failed to fetch files:', err.message)
        console.error('Reviews API: Files URL:', `${BACKEND_URL}/api/files/`)
        throw err
      }),
      
      // Fetch folders
      fetch(`${BACKEND_URL}/api/folders/`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15000) // 15 second timeout
      }).catch(err => {
        console.error('Reviews API: Failed to fetch folders:', err.message)
        console.error('Reviews API: Folders URL:', `${BACKEND_URL}/api/folders/`)
        throw err
      }),
    ])

    // Process responses and handle errors
    const result: {
      reviews: any[]
      files: any[]
      folders: any[]
      errors?: string[]
    } = {
      reviews: [],
      files: [],
      folders: []
    }

    const errors: string[] = []

    // Process reviews response
    if (reviewsResponse.status === 'fulfilled' && reviewsResponse.value.ok) {
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
        console.log(`Reviews API: Successfully fetched ${result.reviews.length} reviews`)
      } catch (e) {
        console.error('Reviews API: Failed to parse reviews data:', e)
        errors.push('Failed to parse reviews data')
        result.reviews = []
      }
    } else {
      const status = reviewsResponse.status === 'fulfilled' ? reviewsResponse.value.status : 'network_error'
      const statusText = reviewsResponse.status === 'fulfilled' ? reviewsResponse.value.statusText : 'Network error'
      console.error(`Reviews API: Reviews request failed with status ${status}: ${statusText}`)
      if (reviewsResponse.status === 'rejected') {
        console.error('Reviews API: Reviews request rejected:', reviewsResponse.reason)
      }
      errors.push(`Failed to fetch reviews (${status}: ${statusText})`)
      result.reviews = []
    }

    // Process files response
    if (filesResponse.status === 'fulfilled' && filesResponse.value.ok) {
      try {
        const filesText = await filesResponse.value.text()
        console.log('Reviews API: Raw files response:', filesText.substring(0, 200) + '...')
        
        if (!filesText || filesText.trim() === '') {
          console.log('Reviews API: Files response is empty')
          result.files = []
        } else {
          try {
            result.files = JSON.parse(filesText)
            console.log(`Reviews API: Successfully fetched ${result.files.length} files`)
          } catch (parseError) {
            console.error('Reviews API: Failed to parse files JSON:', parseError)
            console.error('Reviews API: Files response content:', filesText)
            errors.push('Failed to parse files data - invalid JSON')
            result.files = []
          }
        }
      } catch (e) {
        console.error('Reviews API: Failed to read files response:', e)
        errors.push('Failed to read files response')
        result.files = []
      }
    } else {
      const status = filesResponse.status === 'fulfilled' ? filesResponse.value.status : 'network_error'
      const statusText = filesResponse.status === 'fulfilled' ? filesResponse.value.statusText : 'Network error'
      console.error(`Reviews API: Files request failed with status ${status}: ${statusText}`)
      if (filesResponse.status === 'rejected') {
        console.error('Reviews API: Files request rejected:', filesResponse.reason)
      }
      
      // Try to get error details if available
      if (filesResponse.status === 'fulfilled') {
        try {
          const errorText = await filesResponse.value.text()
          console.error('Reviews API: Files error response body:', errorText)
          errors.push(`Failed to fetch files (${status}: ${statusText}) - ${errorText}`)
        } catch {
          errors.push(`Failed to fetch files (${status}: ${statusText})`)
        }
      } else {
        errors.push(`Failed to fetch files (${status}: ${statusText})`)
      }
      result.files = []
    }

    // Process folders response
    if (foldersResponse.status === 'fulfilled' && foldersResponse.value.ok) {
      try {
        result.folders = await foldersResponse.value.json()
        console.log(`Reviews API: Successfully fetched ${result.folders.length} folders`)
      } catch (e) {
        console.error('Reviews API: Failed to parse folders data:', e)
        errors.push('Failed to parse folders data')
        result.folders = []
      }
    } else {
      const status = foldersResponse.status === 'fulfilled' ? foldersResponse.value.status : 'network_error'
      const statusText = foldersResponse.status === 'fulfilled' ? foldersResponse.value.statusText : 'Network error'
      console.error(`Reviews API: Folders request failed with status ${status}: ${statusText}`)
      if (foldersResponse.status === 'rejected') {
        console.error('Reviews API: Folders request rejected:', foldersResponse.reason)
      }
      errors.push(`Failed to fetch folders (${status}: ${statusText})`)
      result.folders = []
    }

    // Add errors if any occurred
    if (errors.length > 0) {
      result.errors = errors
      console.log('Reviews API: Returning partial data with errors:', errors)
    } else {
      console.log('Reviews API: All requests successful')
    }

    // Calculate review statistics
    const stats = calculateReviewStats(result.reviews)

    // Calculate folder statistics
    const folderStats = calculateFolderStats(result.folders)

    return NextResponse.json({
      ...result,
      stats,
      folderStats,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Reviews API: Unexpected error:', error)
    return NextResponse.json(
      { 
        error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        reviews: [],
        files: [],
        folders: [],
        stats: {
          total: 0,
          completed: 0,
          processing: 0,
          failed: 0,
          draft: 0,
          totalFiles: 0,
          avgCompletion: 0,
          totalColumns: 0,
        },
        folderStats: {
          totalFolders: 0,
          totalFilesInFolders: 0,
          averageFilesPerFolder: 0,
        }
      },
      { status: 500 }
    )
  }
}

/**
 * Calculate review statistics from reviews array
 */
function calculateReviewStats(reviews: any[]) {
  const total = reviews.length
  const completed = reviews.filter(r => r.status === 'completed').length
  const processing = reviews.filter(r => r.status === 'processing').length
  const failed = reviews.filter(r => r.status === 'failed' || r.status === 'error').length
  const draft = reviews.filter(r => r.status === 'draft').length
  const totalFiles = reviews.reduce((sum, r) => sum + (r.total_files || 0), 0)
  const totalColumns = reviews.reduce((sum, r) => sum + (r.total_columns || 0), 0)
  const avgCompletion = total > 0 ? 
    Math.round(reviews.reduce((sum, r) => sum + (r.completion_percentage || 0), 0) / total) : 0

  return {
    total,
    completed,
    processing,
    failed,
    draft,
    totalFiles,
    totalColumns,
    avgCompletion,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    activeReviews: processing + draft,
  }
}

/**
 * Calculate folder statistics from folders array
 */
function calculateFolderStats(folders: any[]) {
  const totalFolders = folders.length
  const totalFilesInFolders = folders.reduce((sum, f) => sum + (f.file_count || 0), 0)
  const averageFilesPerFolder = totalFolders > 0 ? 
    Math.round(totalFilesInFolders / totalFolders) : 0

  return {
    totalFolders,
    totalFilesInFolders,
    averageFilesPerFolder,
    totalSize: folders.reduce((sum, f) => sum + (f.total_size || 0), 0),
  }
} 
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
    console.log('Documents API: Using backend URL:', BACKEND_URL)
    console.log('Documents API: Environment:', process.env.NODE_ENV)
    
    // Get the authorization token from cookies or headers
    const token = request.cookies.get('auth_token')?.value || 
                  request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!token) {
      console.log('Documents API: No auth token found')
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      )
    }

    console.log('Documents API: Using auth token:', token.substring(0, 20) + '...')

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    // Check if client wants files for a specific folder
    const url = new URL(request.url)
    const folderId = url.searchParams.get('folderId')

    console.log('Documents API: FolderId parameter:', folderId)

    if (folderId) {
      console.log('Documents API: Fetching folder details for:', folderId)
      // Fetch files for specific folder
      const [foldersResponse, filesResponse] = await Promise.allSettled([
        fetch(`${BACKEND_URL}/api/folders/`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(15000)
        }).catch(err => {
          console.error('Documents API: Failed to fetch folders:', err.message)
          throw err
        }),
        fetch(`${BACKEND_URL}/api/files/?folder_id=${folderId}`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(15000)
        }).catch(err => {
          console.error('Documents API: Failed to fetch files:', err.message)
          throw err
        }),
      ])

      const result: {
        folders: any[]
        files: any[]
        selectedFolder?: any
        errors?: string[]
      } = {
        folders: [],
        files: []
      }

      const errors: string[] = []

      // Process folders response
      if (foldersResponse.status === 'fulfilled' && foldersResponse.value.ok) {
        try {
          const foldersData = await foldersResponse.value.json()
          result.folders = foldersData
          result.selectedFolder = foldersData.find((f: any) => f.id === folderId)
          console.log(`Documents API: Successfully fetched ${result.folders.length} folders`)
        } catch (e) {
          console.error('Documents API: Failed to parse folders data:', e)
          errors.push('Failed to parse folders data')
        }
      } else {
        const status = foldersResponse.status === 'fulfilled' ? foldersResponse.value.status : 'network_error'
        const statusText = foldersResponse.status === 'fulfilled' ? foldersResponse.value.statusText : 'Network error'
        console.error(`Documents API: Folders request failed with status ${status}: ${statusText}`)
        if (foldersResponse.status === 'rejected') {
          console.error('Documents API: Folders request rejected:', foldersResponse.reason)
        }
        errors.push(`Failed to fetch folders (${status}: ${statusText})`)
        result.folders = []
      }

      // Process files response
      if (filesResponse.status === 'fulfilled' && filesResponse.value.ok) {
        try {
          const filesText = await filesResponse.value.text()
          console.log('Documents API: Raw files response:', filesText.substring(0, 200) + '...')
          
          if (!filesText || filesText.trim() === '') {
            console.log('Documents API: Files response is empty')
            result.files = []
          } else {
            try {
              result.files = JSON.parse(filesText)
              console.log(`Documents API: Successfully fetched ${result.files.length} files`)
            } catch (parseError) {
              console.error('Documents API: Failed to parse files JSON:', parseError)
              console.error('Documents API: Files response content:', filesText)
              errors.push('Failed to parse files data - invalid JSON')
              result.files = []
            }
          }
        } catch (e) {
          console.error('Documents API: Failed to read files response:', e)
          errors.push('Failed to read files response')
          result.files = []
        }
      } else {
        const status = filesResponse.status === 'fulfilled' ? filesResponse.value.status : 'network_error'
        const statusText = filesResponse.status === 'fulfilled' ? filesResponse.value.statusText : 'Network error'
        console.error(`Documents API: Files request failed with status ${status}: ${statusText}`)
        if (filesResponse.status === 'rejected') {
          console.error('Documents API: Files request rejected:', filesResponse.reason)
        }
        
        // Try to get error details if available
        if (filesResponse.status === 'fulfilled') {
          try {
            const errorText = await filesResponse.value.text()
            console.error('Documents API: Files error response body:', errorText)
            errors.push(`Failed to fetch files (${status}: ${statusText}) - ${errorText}`)
          } catch {
            errors.push(`Failed to fetch files (${status}: ${statusText})`)
          }
        } else {
          errors.push(`Failed to fetch files (${status}: ${statusText})`)
        }
        result.files = []
      }

      // Calculate file statistics for the selected folder
      const fileStats = result.files ? calculateFileStats(result.files) : {
        total: 0,
        completed: 0,
        processing: 0,
        failed: 0,
        queued: 0
      }

      if (errors.length > 0) {
        result.errors = errors
        console.log('Documents API: Returning folder details with errors:', errors)
      } else {
        console.log('Documents API: Folder details request successful')
      }

      return NextResponse.json({
        ...result,
        fileStats,
        timestamp: new Date().toISOString(),
      })
    } else {
      console.log('Documents API: Fetching all folders')
      // Fetch just folders for the main documents page
      const foldersResponse = await fetch(`${BACKEND_URL}/api/folders/`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15000)
      }).catch(err => {
        console.error('Documents API: Failed to fetch folders:', err.message)
        throw err
      })

      if (!foldersResponse.ok) {
        console.error(`Documents API: Folders request failed with status ${foldersResponse.status}: ${foldersResponse.statusText}`)
        const errorText = await foldersResponse.text()
        console.error('Documents API: Error response body:', errorText)
        
        return NextResponse.json(
          { 
            error: `Failed to fetch folders (${foldersResponse.status}: ${foldersResponse.statusText})`,
            folders: [],
            stats: {
              totalFolders: 0,
              totalFiles: 0,
              totalSize: 0,
            }
          },
          { status: foldersResponse.status }
        )
      }

      const folders = await foldersResponse.json()
      console.log(`Documents API: Successfully fetched ${folders.length} folders`)

      // Calculate overall statistics
      const stats = {
        totalFolders: folders.length,
        totalFiles: folders.reduce((sum: number, folder: any) => sum + (folder.file_count || 0), 0),
        totalSize: folders.reduce((sum: number, folder: any) => sum + (folder.total_size || 0), 0),
        averageFilesPerFolder: folders.length > 0 ? 
          Math.round(folders.reduce((sum: number, folder: any) => sum + (folder.file_count || 0), 0) / folders.length) : 0,
      }

      return NextResponse.json({
        folders,
        stats,
        timestamp: new Date().toISOString(),
      })
    }

  } catch (error) {
    console.error('Documents API: Unexpected error:', error)
    return NextResponse.json(
      { 
        error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        folders: [],
        stats: {
          totalFolders: 0,
          totalFiles: 0,
          totalSize: 0,
        }
      },
      { status: 500 }
    )
  }
}

/**
 * Calculate file statistics from files array
 */
function calculateFileStats(files: any[]) {
  return files.reduce((stats, file) => {
    stats.total++
    if (file.status === 'completed') {
      stats.completed++
    } else if (file.status === 'processing') {
      stats.processing++
    } else if (file.status === 'failed') {
      stats.failed++
    } else if (file.status === 'queued') {
      stats.queued++
    }
    return stats
  }, {
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0,
    queued: 0
  })
} 
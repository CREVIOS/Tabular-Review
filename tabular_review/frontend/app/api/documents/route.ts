import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from "@/lib/supabase/middleware"
import { File, Folder, FileStats } from '@/types/documents'
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
    console.log('Documents API: Using backend URL:', BACKEND_URL)
    console.log('Documents API: Environment:', process.env.NODE_ENV)
    
    // Get Supabase session and user
    const { user } = await updateSession(request)
    
    if (!user) {
      console.log('Documents API: No authenticated user found')
      return NextResponse.json(
        { error: 'Unauthorized - No authenticated user' },
        { status: 401 }
      )
    }

    console.log('Documents API: Authenticated user:', user.email)

    // Create a Supabase client to get the session
    const supabase = await createClient()
    
    // Get the Supabase access token for backend API calls
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      console.log('Documents API: No access token found')
      return NextResponse.json(
        { error: 'Unauthorized - No access token' },
        { status: 401 }
      )
    }

    const headers = {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    }

    // Check if client wants files for a specific folder
    const url = new URL(request.url)
    const folderId = url.searchParams.get('folderId')

    console.log('Documents API: FolderId parameter:', folderId)

    if (folderId) {
      console.log('Documents API: Fetching folder details for:', folderId)
      // Fetch files for specific folder with pagination
      const [foldersResponse, filesResponse] = await Promise.allSettled([
        fetch(`${BACKEND_URL}/api/folders/`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(15000)
        }).catch(err => {
          console.error('Documents API: Failed to fetch folders:', err.message)
          throw err
        }),
        fetch(`${BACKEND_URL}/api/files/?folder_id=${folderId}&page=1&limit=25`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(15000)
        }).catch(err => {
          console.error('Documents API: Failed to fetch files:', err.message)
          throw err
        }),
      ])

      const result: {
        folders: Folder[]
        files: File[]
        selectedFolder?: Folder
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
          result.selectedFolder = foldersData.find((f: Folder) => f.id === folderId)
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
        totalFiles: folders.reduce((sum: number, folder: Folder) => sum + (folder.file_count || 0), 0),
        totalSize: folders.reduce((sum: number, folder: Folder) => sum + (folder.total_size || 0), 0),
        averageFilesPerFolder: folders.length > 0 ? 
          Math.round(folders.reduce((sum: number, folder: Folder) => sum + (folder.file_count || 0), 0) / folders.length) : 0,
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

export async function POST(request: NextRequest) {
  try {
    console.log('Documents API POST: Using backend URL:', BACKEND_URL)
    
    // Get Supabase session and user
    const { user } = await updateSession(request)
    
    if (!user) {
      console.log('Documents API POST: No authenticated user found')
      return NextResponse.json(
        { error: 'Unauthorized - No authenticated user' },
        { status: 401 }
      )
    }

    console.log('Documents API POST: Authenticated user:', user.email)

    // Create a Supabase client to get the session
    const supabase = await createClient()
    
    // Get the Supabase access token for backend API calls
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      console.log('Documents API POST: No access token found')
      return NextResponse.json(
        { error: 'Unauthorized - No access token' },
        { status: 401 }
      )
    }

    const headers = {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    }

    // Get the request body
    const body = await request.json()
    console.log('Documents API POST: Request body:', body)

    // Forward the request to the backend
    const response = await fetch(`${BACKEND_URL}/api/folders/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      console.error(`Documents API POST: Backend request failed with status ${response.status}: ${response.statusText}`)
      const errorText = await response.text()
      console.error('Documents API POST: Error response body:', errorText)
      
      return NextResponse.json(
        { error: `Failed to create folder (${response.status}: ${response.statusText})` },
        { status: response.status }
      )
    }

    const result = await response.json()
    console.log('Documents API POST: Successfully created folder')
    
    return NextResponse.json(result)

  } catch (error) {
    console.error('Documents API POST: Unexpected error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

/**
 * Calculate file statistics from files array
 */
function calculateFileStats(files: File[]): FileStats {
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
  } as FileStats)
} 
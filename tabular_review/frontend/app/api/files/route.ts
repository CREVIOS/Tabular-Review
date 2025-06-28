import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from "@/lib/supabase/middleware"
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
    console.log('Files API: Using backend URL:', BACKEND_URL)
    
    // Get Supabase session and user
    const { user } = await updateSession(request)
    
    if (!user) {
      console.log('Files API: No authenticated user found')
      return NextResponse.json(
        { error: 'Unauthorized - No authenticated user' },
        { status: 401 }
      )
    }

    console.log('Files API: Authenticated user:', user.email)

    // Create a Supabase client to get the session
    const supabase = await createClient()
    
    // Get the Supabase access token for backend API calls
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      console.log('Files API: No access token found')
      return NextResponse.json(
        { error: 'Unauthorized - No access token' },
        { status: 401 }
      )
    }

    const headers = {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    }

    // Get query parameters
    const url = new URL(request.url)
    const pageSize = url.searchParams.get('page_size') || url.searchParams.get('limit') || '25'
    const page = url.searchParams.get('page') || '1'
    const folderId = url.searchParams.get('folder_id')

    // Build the backend URL with query parameters
    let backendUrl = `${BACKEND_URL}/api/files/?page=${page}&limit=${pageSize}`
    if (folderId) {
      backendUrl += `&folder_id=${folderId}`
    }

    console.log('Files API: Fetching files from:', backendUrl)

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      console.error(`Files API: Backend request failed with status ${response.status}: ${response.statusText}`)
      const errorText = await response.text()
      console.error('Files API: Error response body:', errorText)
      
      return NextResponse.json(
        { error: `Failed to fetch files (${response.status}: ${response.statusText})` },
        { status: response.status }
      )
    }

    const filesText = await response.text()
    console.log('Files API: Raw response:', filesText.substring(0, 200) + '...')
    
    if (!filesText || filesText.trim() === '') {
      console.log('Files API: Response is empty')
      return NextResponse.json({ files: [] })
    }

    try {
      const files = JSON.parse(filesText)
      console.log(`Files API: Successfully fetched ${Array.isArray(files) ? files.length : 0} files`)
      
      return NextResponse.json({ files })
    } catch (parseError) {
      console.error('Files API: Failed to parse files JSON:', parseError)
      console.error('Files API: Response content:', filesText)
      return NextResponse.json(
        { error: 'Failed to parse files data - invalid JSON' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Files API: Unexpected error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Files API Upload: Using backend URL:', BACKEND_URL)
    
    // Get Supabase session and user
    const { user } = await updateSession(request)
    
    if (!user) {
      console.log('Files API Upload: No authenticated user found')
      return NextResponse.json(
        { error: 'Unauthorized - No authenticated user' },
        { status: 401 }
      )
    }

    console.log('Files API Upload: Authenticated user:', user.email)

    // Create a Supabase client to get the session
    const supabase = await createClient()
    
    // Get the Supabase access token for backend API calls
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      console.log('Files API Upload: No access token found')
      return NextResponse.json(
        { error: 'Unauthorized - No access token' },
        { status: 401 }
      )
    }

    // Get the form data from the request
    const formData = await request.formData()
    
    // Log form data keys for debugging
    const formDataKeys: string[] = []
    formData.forEach((_, key) => {
      formDataKeys.push(key)
    })
    console.log('Files API Upload: Form data keys:', formDataKeys)

    // Prepare headers for backend request
    const headers = {
      'Authorization': `Bearer ${session.access_token}`,
      // Don't set Content-Type - let the browser handle multipart/form-data boundary
    }

    console.log('Files API Upload: Forwarding to backend...')

    // Forward the upload request to the backend
    const response = await fetch(`${BACKEND_URL}/api/files/upload`, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(300000) // 5 minute timeout for uploads
    })

    console.log(`Files API Upload: Backend response status: ${response.status}`)

    if (!response.ok) {
      console.error(`Files API Upload: Backend request failed with status ${response.status}: ${response.statusText}`)
      try {
        const errorText = await response.text()
        console.error('Files API Upload: Error response body:', errorText)
        
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { detail: errorText || `HTTP ${response.status}` }
        }
        
        return NextResponse.json(
          { error: errorData.detail || `Upload failed (${response.status}: ${response.statusText})` },
          { status: response.status }
        )
      } catch {
        return NextResponse.json(
          { error: `Upload failed (${response.status}: ${response.statusText})` },
          { status: response.status }
        )
      }
    }

    // Parse the successful response
    try {
      const result = await response.json()
      console.log(`Files API Upload: Successfully uploaded ${Array.isArray(result) ? result.length : 0} files`)
      
      return NextResponse.json(result)
    } catch (parseError) {
      console.error('Files API Upload: Failed to parse response JSON:', parseError)
      const responseText = await response.text()
      console.error('Files API Upload: Response content:', responseText)
      return NextResponse.json(
        { error: 'Failed to parse upload response' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Files API Upload: Unexpected error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
} 
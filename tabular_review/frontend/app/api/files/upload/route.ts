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

export async function POST(request: NextRequest) {
  try {
    console.log('Upload API: Using backend URL:', BACKEND_URL)
    
    // Get Supabase session and user
    const { user } = await updateSession(request)
    
    if (!user) {
      console.log('Upload API: No authenticated user found')
      return NextResponse.json(
        { error: 'Unauthorized - No authenticated user' },
        { status: 401 }
      )
    }

    console.log('Upload API: Authenticated user:', user.email)

    // Create a Supabase client to get the session
    const supabase = await createClient()
    
    // Get the Supabase access token for backend API calls
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      console.log('Upload API: No access token found')
      return NextResponse.json(
        { error: 'Unauthorized - No access token' },
        { status: 401 }
      )
    }

    // Get the form data from the request
    const formData = await request.formData()
    
    // Log form data keys for debugging
    const formDataKeys: string[] = []
    const fileCount = Array.from(formData.entries()).filter(([key]) => key === 'files').length
    formData.forEach((_, key) => {
      formDataKeys.push(key)
    })
    console.log('Upload API: Form data keys:', formDataKeys)
    console.log('Upload API: Number of files found:', fileCount)

    // Prepare headers for backend request
    const headers = {
      'Authorization': `Bearer ${session.access_token}`,
      // Don't set Content-Type - let the browser handle multipart/form-data boundary
    }

    console.log('Upload API: Forwarding to backend upload endpoint...')

    // Forward the upload request to the backend
    const response = await fetch(`${BACKEND_URL}/api/files/upload`, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(300000) // 5 minute timeout for uploads
    })

    console.log(`Upload API: Backend response status: ${response.status}`)

    if (!response.ok) {
      console.error(`Upload API: Backend request failed with status ${response.status}: ${response.statusText}`)
      try {
        const errorText = await response.text()
        console.error('Upload API: Error response body:', errorText)
        
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
      console.log(`Upload API: Successfully uploaded ${Array.isArray(result) ? result.length : 0} files`)
      
      return NextResponse.json(result)
    } catch (parseError) {
      console.error('Upload API: Failed to parse response JSON:', parseError)
      try {
        const responseText = await response.text()
        console.error('Upload API: Response content:', responseText)
      } catch {
        console.error('Upload API: Could not read response text')
      }
      return NextResponse.json(
        { error: 'Failed to parse upload response' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Upload API: Unexpected error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
} 
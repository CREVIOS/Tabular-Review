import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createClient } from '@/lib/supabase/server'

const getBackendUrl = () => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
  if (process.env.NODE_ENV === 'development' && backendUrl.includes('backend:8000')) {
    return 'http://localhost:8000'
  }
  return backendUrl
}

const BACKEND_URL = getBackendUrl()

export async function POST(
  request: NextRequest, 
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    // Await the params (required in Next.js 15+)
    const { reviewId } = await params
    
    // Get Supabase session and user
    const { user } = await updateSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - No authenticated user' },
        { status: 401 }
      )
    }
    // Get Supabase access token
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return NextResponse.json(
        { error: 'Unauthorized - No access token' },
        { status: 401 }
      )
    }
    // Read body
    const body = await request.json()
    // Proxy to backend
    const backendUrl = `${BACKEND_URL}/api/reviews/${reviewId}/files`
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    })
    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: 'Invalid JSON from backend', raw: text }
    }
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
} 
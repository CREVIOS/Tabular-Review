"use client"
import React, { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, RefreshCw, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FileRecord {
  id: string
  user_id: string
  original_filename: string
  file_size?: number
  file_type?: string
  storage_path?: string
  storage_url?: string
  status: string
  created_at: string
  updated_at: string
  processed_at?: string
  error_message?: string
}

interface FilesTableProps {
  refreshTrigger: number
}

export function FilesTable({ refreshTrigger }: FilesTableProps) {
  const [fileList, setFileList] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isOnline, setIsOnline] = useState(true)

  const fetchFiles = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setError(null)
    }
    
    setLoading(true)
    
    try {
      // Check if API server is reachable
      const healthCheck = await fetch('http://localhost:8000/api/health', { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      }).catch(() => null)
      
      if (!healthCheck) {
        setIsOnline(false)
        setError('API server is not responding. Please try again later.')
        return
      }
      
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        throw new Error('Authentication required')
      }
      
      // Use the correct API URL (matching dashboard)
      const response = await fetch('http://localhost:8000/api/files/', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (Array.isArray(data)) {
        setFileList(data)
        setRetryCount(0)
        console.log('Files fetched successfully:', data.length)
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error: unknown) {
      console.error('Failed to fetch files:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch files'
      setError(errorMessage)
      
      // If this is an automatic retry, don't show the error immediately
      if (retryCount < 3) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1)
          fetchFiles(false)
        }, Math.pow(2, retryCount) * 1000) // Exponential backoff
      }
    } finally {
      setLoading(false)
    }
  }, [setFileList, setLoading, setError, setIsOnline, setRetryCount, retryCount])

  useEffect(() => {
    // Check authentication first
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        console.log('User not authenticated, redirecting to login')
        window.location.href = '/login'
        return
      }
      
      fetchFiles()
    }
    
    checkAuth()
  }, [refreshTrigger, fetchFiles])

  const handleManualRefresh = () => {
    setRetryCount(0)
    fetchFiles(true)
  }

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant="outline" className={getBadgeClass(status)}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const getBadgeClass = (status: string) => {
    const classes = {
      queued: 'bg-gray-100 text-gray-800 border-gray-300',
      processing: 'bg-blue-100 text-blue-800 border-blue-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
      failed: 'bg-red-100 text-red-800 border-red-300'
    } as const
    return classes[status as keyof typeof classes] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const viewMarkdown = async (fileId: string) => {
    try {
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        throw new Error('Authentication required')
      }
      
      // Use the correct API URL (matching dashboard pattern)
      const response = await fetch(`http://localhost:8000/api/files/${fileId}/markdown`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const markdownData = await response.json()
      const markdown = markdownData.content
      
      // Create a new window/tab to display the markdown
      const newWindow = window.open('', '_blank')
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head>
              <title>Document Content</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
                pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
                h1, h2, h3 { color: #333; }
              </style>
            </head>
            <body>
              <h1>Document Content</h1>
              <pre>${markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
            </body>
          </html>
        `)
        newWindow.document.close()
      }
    } catch (error: unknown) {
      console.error('Failed to fetch markdown:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch markdown'
      alert(`Failed to view document: ${errorMessage}`)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Invalid date'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Your Documents</CardTitle>
          <Button variant="outline" size="sm" disabled>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Loading...
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Your Documents</CardTitle>
        <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <Button
                variant="outline"
                size="sm"
                className="ml-2"
                onClick={handleManualRefresh}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Offline Alert */}
        {!isOnline && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              API server appears to be offline. Some features may not work properly.
            </AlertDescription>
          </Alert>
        )}

        {fileList.length === 0 && !error ? (
          <div className="text-center text-muted-foreground py-8">
            <AlertCircle className="h-8 w-8 mx-auto mb-4 text-gray-400" />
            <p className="text-lg mb-2">No documents uploaded yet</p>
            <p className="text-sm">Upload your first document to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {fileList.map((file) => (
              <div key={file.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate" title={file.original_filename}>
                      {file.original_filename}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span>Size: {file.file_size ? formatFileSize(file.file_size) : '-'}</span>
                      <span>Uploaded: {formatDate(file.created_at)}</span>
                      {file.processed_at && (
                        <span>Processed: {formatDate(file.processed_at)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(file.status)}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {file.status === 'failed' && file.error_message && (
                      <div className="text-xs text-red-500 truncate max-w-[200px]" title={file.error_message}>
                        Error: {file.error_message}
                      </div>
                    )}
                    {file.status === 'processing' && (
                      <div className="flex items-center text-xs text-muted-foreground">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                        Processing...
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {file.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewMarkdown(file.id)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary footer */}
        {fileList.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>Total: {fileList.length} documents</span>
              <span>Completed: {fileList.filter(f => f.status === 'completed').length}</span>
              <span>Processing: {fileList.filter(f => f.status === 'processing').length}</span>
              <span>Queued: {fileList.filter(f => f.status === 'queued').length}</span>
              {fileList.filter(f => f.status === 'failed').length > 0 && (
                <span className="text-red-600">Failed: {fileList.filter(f => f.status === 'failed').length}</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
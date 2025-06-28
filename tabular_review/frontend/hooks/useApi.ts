import { useState, useCallback } from 'react'
import { File, Review, NewReview, NewColumn } from '../types'
import { useAuth } from './useAuth'

const API_BASE = 'http://localhost:8000/api'

export const useApi = () => {
  const { getAuthHeaders, checkAuth } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchFiles = useCallback(async (): Promise<File[]> => {
    if (!(await checkAuth())) return []
    
    try {
      setLoading(true)
      setError(null)
      
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_BASE}/files/`, {
        headers
      })
      
      if (response.ok) {
        const filesData = await response.json()
        return filesData.filter((f: File) => f.status === 'completed')
      } else if (response.status === 401) {
        window.location.href = '/login'
        return []
      } else {
        throw new Error('Failed to fetch files')
      }
    } catch (error) {
      console.error('Failed to fetch files:', error)
      setError('Failed to load files. Please check your connection.')
      return []
    } finally {
      setLoading(false)
    }
  }, [checkAuth, getAuthHeaders])

  const fetchReviews = useCallback(async (): Promise<Review[]> => {
    if (!(await checkAuth())) return []
    
    try {
      setLoading(true)
      setError(null)
      
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_BASE}/reviews/`, {
        headers
      })
      
      if (response.ok) {
        const reviewsData = await response.json()
        return reviewsData.reviews || []
      } else if (response.status === 401) {
        window.location.href = '/login'
        return []
      } else {
        throw new Error('Failed to fetch reviews')
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error)
      setError('Failed to load reviews. Please check your connection.')
      return []
    } finally {
      setLoading(false)
    }
  }, [checkAuth, getAuthHeaders])

  const fetchDetailedReview = useCallback(async (reviewId: string): Promise<Review | null> => {
    if (!(await checkAuth())) return null
    
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_BASE}/reviews/${reviewId}`, {
        headers
      })

      if (response.ok) {
        return await response.json()
      }
      return null
    } catch (error) {
      console.error('Failed to fetch detailed review:', error)
      return null
    }
  }, [checkAuth, getAuthHeaders])

  const createReview = useCallback(async (
    newReview: NewReview,
    selectedFiles: string[]
  ): Promise<Review | null> => {
    if (!(await checkAuth())) return null
    
    try {
      setError(null)
      
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_BASE}/reviews/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: newReview.name,
          description: newReview.description,
          file_ids: selectedFiles,
          columns: newReview.columns.map((col, index) => ({
            column_name: col.column_name,
            prompt: col.prompt,
            column_order: index,
            data_type: col.data_type || 'text'
          }))
        })
      })

      if (response.ok) {
        return await response.json()
      } else if (response.status === 401) {
        window.location.href = '/login'
        return null
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        setError(`Failed to create review: ${errorData.detail || 'Unknown error'}`)
        return null
      }
    } catch (error) {
      console.error('Failed to create review:', error)
      setError('Failed to create review. Please check your connection.')
      return null
    }
  }, [checkAuth, getAuthHeaders])

  const startAnalysis = useCallback(async (reviewId: string): Promise<boolean> => {
    if (!(await checkAuth())) return false
    
    try {
      setError(null)
      
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_BASE}/reviews/${reviewId}/analyze`, {
        method: 'POST',
        headers
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Analysis started:', result.message)
        return true
      } else if (response.status === 401) {
        window.location.href = '/login'
        return false
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        setError(`Failed to start analysis: ${errorData.detail || 'Unknown error'}`)
        return false
      }
    } catch (error) {
      console.error('Failed to start analysis:', error)
      setError('Failed to start analysis. Please check your connection.')
      return false
    }
  }, [checkAuth, getAuthHeaders])

  const addColumnToReview = useCallback(async (
    reviewId: string,
    newColumn: NewColumn
  ): Promise<boolean> => {
    if (!(await checkAuth())) return false
    
    try {
      setError(null)
      
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_BASE}/reviews/${reviewId}/columns`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          column_name: newColumn.column_name,
          prompt: newColumn.prompt,
          data_type: newColumn.data_type
        })
      })

      if (response.ok) {
        return true
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        setError(`Failed to add column: ${errorData.detail || 'Unknown error'}`)
        return false
      }
    } catch (error) {
      console.error('Failed to add column:', error)
      setError('Failed to add column. Please check your connection.')
      return false
    }
  }, [checkAuth, getAuthHeaders])

  const addDocumentsToReview = useCallback(async (
    reviewId: string,
    fileIds: string[]
  ): Promise<boolean> => {
    if (!(await checkAuth())) return false
    
    try {
      setError(null)
      
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_BASE}/reviews/${reviewId}/files`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          file_ids: fileIds
        })
      })

      if (response.ok) {
        return true
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        setError(`Failed to add documents: ${errorData.detail || 'Unknown error'}`)
        return false
      }
    } catch (error) {
      console.error('Failed to add documents:', error)
      setError('Failed to add documents. Please check your connection.')
      return false
    }
  }, [checkAuth, getAuthHeaders])

  const fetchDocumentMarkdown = useCallback(async (fileId: string): Promise<string> => {
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_BASE}/files/${fileId}/markdown`, {
        headers
      })

      if (response.ok) {
        const markdownData = await response.json()
        return markdownData.content
      }
      return 'Unable to load document content'
    } catch (error) {
      console.error('Failed to fetch document content:', error)
      return 'Unable to load document content'
    }
  }, [getAuthHeaders])

  return {
    loading,
    error,
    setError,
    fetchFiles,
    fetchReviews,
    fetchDetailedReview,
    createReview,
    startAnalysis,
    addColumnToReview,
    addDocumentsToReview,
    fetchDocumentMarkdown
  }
} 
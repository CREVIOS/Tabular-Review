import { useRef, useCallback, useState } from 'react'
import { SSEMessage, Review, RealTimeUpdates } from '../types'
import { useAuth } from './useAuth'

const API_BASE = 'http://localhost:8000/api'

interface UseSSEProps {
  onMessage: (data: SSEMessage) => void
  setSelectedReview: React.Dispatch<React.SetStateAction<Review | null>>
  setReviews: React.Dispatch<React.SetStateAction<Review[]>>
  setRealTimeUpdates: React.Dispatch<React.SetStateAction<RealTimeUpdates>>
  setProcessingCells: React.Dispatch<React.SetStateAction<Set<string>>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  selectedReview: Review | null
  fetchDetailedReview: (reviewId: string) => Promise<void>
}

export const useSSE = ({
  onMessage,
  setSelectedReview,
  setReviews,
  setRealTimeUpdates,
  setProcessingCells,
  setError,
  selectedReview,
  fetchDetailedReview
}: UseSSEProps) => {
  const { getAuthToken, getAuthHeaders, checkAuth } = useAuth()
  const [isConnectedToSSE, setIsConnectedToSSE] = useState(false)
  const [isUsingPolling, setIsUsingPolling] = useState(false)
  const eventSourceRef = useRef<EventSource | { close: () => void; _isPolling?: boolean } | null>(null)

  const handleSSEMessage = useCallback((data: SSEMessage) => {
    console.log('SSE message received:', data)
    
    switch (data.type) {
      case 'connected':
        console.log('Connected to SSE stream for review:', data.review_id)
        break
        
      case 'analysis_started':
        setSelectedReview(prev => prev ? { ...prev, status: 'processing' } : prev)
        setReviews(prev => prev.map(review => 
          review.id === data.review_id ? { ...review, status: 'processing' } : review
        ))
        break

      case 'column_added':
        if (selectedReview && selectedReview.id === data.review_id) {
          fetchDetailedReview(data.review_id!)
        }
        break

      case 'files_added':
        if (selectedReview && selectedReview.id === data.review_id) {
          fetchDetailedReview(data.review_id!)
        }
        break

      case 'cell_processing_started':
        const processingKey = `${data.file_id}-${data.column_id}`
        setProcessingCells(prev => new Set([...prev, processingKey]))
        break
        
      case 'cell_completed':
        const cellKey = `${data.file_id}-${data.column_id}`
        
        setProcessingCells(prev => {
          const newSet = new Set(prev)
          newSet.delete(cellKey)
          return newSet
        })
        
        if (data.result) {
          setRealTimeUpdates(prev => ({
            ...prev,
            [cellKey]: {
              extracted_value: data.result!.extracted_value,
              confidence_score: data.result!.confidence_score,
              source_reference: data.result!.source_reference,
              timestamp: Date.now()
            }
          }))
        }
        
        setSelectedReview(prev => prev ? { 
          ...prev, 
          completion_percentage: data.progress || 0
        } : prev)
        break

      case 'cell_error':
        const errorKey = `${data.file_id}-${data.column_id}`
        setProcessingCells(prev => {
          const newSet = new Set(prev)
          newSet.delete(errorKey)
          return newSet
        })
        
        setRealTimeUpdates(prev => ({
          ...prev,
          [errorKey]: {
            extracted_value: null,
            confidence_score: undefined,
            source_reference: `Error: ${data.error}`,
            error: true,
            timestamp: Date.now()
          }
        }))
        break
        
      case 'analysis_completed':
        setSelectedReview(prev => prev ? { 
          ...prev, 
          status: 'completed',
          completion_percentage: 100 
        } : prev)
        setReviews(prev => prev.map(review => 
          review.id === data.review_id ? { 
            ...review, 
            status: 'completed' as const,
            completion_percentage: 100 
          } : review
        ))
        
        setProcessingCells(new Set())
        
        if (selectedReview && selectedReview.id === data.review_id) {
          fetchDetailedReview(data.review_id!)
        }
        break
        
      case 'analysis_failed':
        setSelectedReview(prev => prev ? { ...prev, status: 'error' } : prev)
        setReviews(prev => prev.map(review => 
          review.id === data.review_id ? { ...review, status: 'error' as const } : review
        ))
        setError(data.message || 'Analysis failed')
        setProcessingCells(new Set())
        break
        
      case 'heartbeat':
        break
        
      default:
        console.log('Unknown SSE message type:', data.type)
    }
    
    onMessage(data)
  }, [
    selectedReview,
    setSelectedReview,
    setReviews,
    setRealTimeUpdates,
    setProcessingCells,
    setError,
    fetchDetailedReview,
    onMessage
  ])

  const startPollingFallback = useCallback((reviewId: string) => {
    console.log('Starting polling fallback for review:', reviewId)
    setIsUsingPolling(true)
    setIsConnectedToSSE(false)
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/reviews/${reviewId}/status`, {
          headers: getAuthHeaders()
        })

        if (response.ok) {
          const status = await response.json()
          
          setSelectedReview(prev => {
            if (prev && prev.id === reviewId) {
              return { 
                ...prev, 
                status: status.status as Review['status'], 
                completion_percentage: status.progress_percentage 
              }
            }
            return prev
          })
          
          setReviews(prev => prev.map(review => 
            review.id === reviewId 
              ? { 
                  ...review, 
                  status: status.status as Review['status'], 
                  completion_percentage: status.progress_percentage 
                }
              : review
          ))

          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(pollInterval)
            setIsUsingPolling(false)
            await fetchDetailedReview(reviewId)
            
            handleSSEMessage({
              type: status.status === 'completed' ? 'analysis_completed' : 'analysis_failed',
              review_id: reviewId,
              message: status.status === 'completed' ? 'Analysis completed!' : 'Analysis failed',
              progress: status.progress_percentage
            })
          }
        }
      } catch (error) {
        console.error('Polling failed:', error)
      }
    }, 3000)

    eventSourceRef.current = { 
      close: () => {
        clearInterval(pollInterval)
        setIsUsingPolling(false)
      },
      _isPolling: true 
    }
  }, [getAuthHeaders, setSelectedReview, setReviews, fetchDetailedReview, handleSSEMessage])

  const connectToSSE = useCallback((reviewId: string) => {
    if (!checkAuth()) return
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const token = getAuthToken()
    if (!token) return
    
    const url = `${API_BASE}/reviews/${reviewId}/stream?token=${encodeURIComponent(token)}`
    
    try {
      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource

      let connectionTimeout = setTimeout(() => {
        console.log('SSE connection timeout, falling back to polling')
        eventSource.close()
        startPollingFallback(reviewId)
      }, 10000)

      eventSource.onopen = () => {
        console.log('SSE connection opened successfully')
        setIsConnectedToSSE(true)
        clearTimeout(connectionTimeout)
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleSSEMessage(data)
        } catch (error) {
          console.error('Failed to parse SSE message:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        setIsConnectedToSSE(false)
        clearTimeout(connectionTimeout)
        console.log('SSE failed, falling back to polling')
        startPollingFallback(reviewId)
      }
    } catch (error) {
      console.error('Failed to create SSE connection:', error)
      startPollingFallback(reviewId)
    }
  }, [checkAuth, getAuthToken, handleSSEMessage, startPollingFallback])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      setIsConnectedToSSE(false)
      setIsUsingPolling(false)
    }
  }, [])

  return {
    connectToSSE,
    disconnect,
    isConnectedToSSE,
    isUsingPolling
  }
} 
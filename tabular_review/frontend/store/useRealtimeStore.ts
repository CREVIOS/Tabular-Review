import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { useMemo } from 'react'
import { Review, File, RealTimeUpdates } from '../types'
import { produce } from 'immer'

interface RealtimeState {
  // Data
  reviews: Review[]
  files: File[]
  selectedFiles: string[]
  processingCells: Set<string>
  realTimeUpdates: RealTimeUpdates
  
  // UI State
  sidebarCollapsed: boolean
  selectedReview: Review | null
  isLoading: boolean
  error: string | null
  
  // SSE Connection
  sseConnection: EventSource | null
  connectedReviewId: string | null
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error'
  
  // Actions
  setReviews: (reviews: Review[]) => void
  setFiles: (files: File[]) => void
  updateReview: (reviewId: string, updates: Partial<Review>) => void
  updateFile: (fileId: string, updates: Partial<File>) => void
  addProcessingCell: (cellId: string) => void
  removeProcessingCell: (cellId: string) => void
  setRealTimeUpdate: (key: string, value: any) => void
  clearProcessingCells: () => void
  
  // File selection
  toggleFileSelection: (fileId: string) => void
  clearFileSelection: () => void
  setSelectedFiles: (fileIds: string[]) => void
  
  // UI actions
  setSidebarCollapsed: (collapsed: boolean) => void
  setSelectedReview: (review: Review | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // SSE actions
  connectSSE: (reviewId: string) => void
  disconnectSSE: () => void
  
  // Optimistic updates
  optimisticallyAddReview: (review: Review) => void
  optimisticallyUpdateReviewStatus: (reviewId: string, status: Review['status']) => void
}

export const useRealtimeStore = create<RealtimeState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    reviews: [],
    files: [],
    selectedFiles: [],
    processingCells: new Set(),
    realTimeUpdates: {},
    
    sidebarCollapsed: false,
    selectedReview: null,
    isLoading: false,
    error: null,
    
    sseConnection: null,
    connectedReviewId: null,
    connectionStatus: 'disconnected',
    
    // Data actions
    setReviews: (reviews) => {
      if (!Array.isArray(reviews)) {
        console.error('setReviews called with non-array:', reviews)
        return
      }
      set({ reviews })
    },
    
    setFiles: (files) => {
      if (!Array.isArray(files)) {
        console.error('setFiles called with non-array:', files)
        return
      }
      set({ files })
    },
    
    updateReview: (reviewId, updates) => set((state) => ({
      reviews: state.reviews.map(review => 
        review.id === reviewId ? { ...review, ...updates } : review
      ),
      selectedReview: state.selectedReview?.id === reviewId 
        ? { ...state.selectedReview, ...updates }
        : state.selectedReview
    })),
    
    updateFile: (fileId, updates) => set((state) => ({
      files: state.files.map(file => 
        file.id === fileId ? { ...file, ...updates } : file
      )
    })),
    
    addProcessingCell: (cellId) => set((state) => ({
      processingCells: new Set([...state.processingCells, cellId])
    })),
    
    removeProcessingCell: (cellId) => set((state) => {
      const newSet = new Set(state.processingCells)
      newSet.delete(cellId)
      return { processingCells: newSet }
    }),
    
    clearProcessingCells: () => set({ processingCells: new Set() }),
    
    setRealTimeUpdate: (key, value) =>
      set(
        produce((draft: RealtimeState) => {
         
          draft.realTimeUpdates[key] = { ...value }
        })
      ),
    
    // File selection
    toggleFileSelection: (fileId) => set((state) => ({
      selectedFiles: state.selectedFiles.includes(fileId)
        ? state.selectedFiles.filter(id => id !== fileId)
        : [...state.selectedFiles, fileId]
    })),
    
    clearFileSelection: () => set({ selectedFiles: [] }),
    
    setSelectedFiles: (fileIds) =>
      set((state) => {
        const same =
          state.selectedFiles.length === fileIds.length &&
          state.selectedFiles.every((id, i) => id === fileIds[i])
        return same ? state               // ← no state change ⇒ no re-render
                    : { selectedFiles: fileIds }
      }),    
    // UI actions
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    setSelectedReview: (review) => set({ selectedReview: review }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    
    connectSSE: (reviewId) => {
      const { sseConnection, connectedReviewId, connectionStatus } = get()
      
      // If we are already connected to this review and the connection is healthy, do nothing
      if (
        sseConnection &&
        connectedReviewId === reviewId &&
        connectionStatus === 'connected' &&
        sseConnection.readyState === 1 /* OPEN */
      ) {
        return
      }
      
      // Close existing connection
      if (sseConnection) {
        console.log('🔌 Closing existing SSE connection')
        sseConnection.close()
      }
      
      set({ connectionStatus: 'connecting' })
      
      try {
        const token = localStorage.getItem('auth_token')
        if (!token) {
          console.error('❌ No auth token found')
          set({ connectionStatus: 'error', error: 'Authentication required' })
          return
        }
        
        // Properly construct SSE URL with token
        const sseUrl = `http://localhost:8000/api/reviews/${reviewId}/stream?token=${encodeURIComponent(token)}`
        console.log('🔌 Connecting to SSE:', sseUrl)
        console.log('🔑 Using token:', token.substring(0, 20) + '...')
        
        const eventSource = new EventSource(sseUrl)
        
        eventSource.onopen = () => {
          console.log('✅ SSE connection opened for review:', reviewId)
          console.log('🔗 Connection readyState:', eventSource.readyState)
          set({ connectionStatus: 'connected', sseConnection: eventSource, connectedReviewId: reviewId, error: null })
        }
        
        eventSource.onmessage = (event) => {
          console.log('📨 Raw SSE event received:', event)
          console.log('📄 Event data:', event.data)
          
          try {
            const data = JSON.parse(event.data)
            console.log('📡 SSE message received:', data.type, data)
            
            const {
              addProcessingCell,
              removeProcessingCell,
              setRealTimeUpdate,
              updateReview,
            } = get()
            
            switch (data.type) {
              case 'heartbeat':
              case 'connected':
                console.log('💓 SSE heartbeat/connected')
                break
                
              case 'cell_processing_started':
                console.log('🔄 Cell processing started:', `${data.file_id}-${data.column_id}`)
                console.log('📝 Adding to processing cells...')
                addProcessingCell(`${data.file_id}-${data.column_id}`)
                
                // Force a state update to trigger re-render
                const currentState = get()
                console.log('🔄 Current processing cells after add:', currentState.processingCells.size)
                console.log('🔄 Processing cells Set:', Array.from(currentState.processingCells).slice(0, 3))
                break
                
              case 'cell_completed':
                console.log('✅ Cell completed:', `${data.file_id}-${data.column_id}`, data.result)
                const cellKey = `${data.file_id}-${data.column_id}`
                console.log('📝 Removing from processing cells and adding result...')
                removeProcessingCell(cellKey)
                setRealTimeUpdate(cellKey, {
                  extracted_value: data.result?.extracted_value ?? null,
                  confidence_score: data.result?.confidence_score ?? undefined,
                  source_reference: data.result?.source_reference ?? '',
                  status: 'completed',
                  replayed: data.replayed || false,
                  timestamp: Date.now() // Add timestamp for UI animations
                })
                
                // Log state after update
                const stateAfterComplete = get()
                console.log('🔄 Processing cells after remove:', stateAfterComplete.processingCells.size)
                console.log('🔄 Real-time updates count:', Object.keys(stateAfterComplete.realTimeUpdates).length)
                console.log('📦 New real-time update:', {
                  cellKey,
                  value: data.result?.extracted_value,
                  confidence: data.result?.confidence_score
                })
                break
                
              case 'cell_error':
                console.log('❌ Cell error:', `${data.file_id}-${data.column_id}`, data.error)
                const errorCellKey = `${data.file_id}-${data.column_id}`
                removeProcessingCell(errorCellKey)
                setRealTimeUpdate(errorCellKey, {
                  extracted_value: null,
                  confidence_score: undefined,
                  source_reference: '',
                  status: 'error',
                  error: data.error,
                  timestamp: Date.now()
                })
                break
                
              case 'progress_update':
                console.log('📊 Progress update:', data.completion_percentage)
                updateReview(data.review_id, {
                  completion_percentage: data.completion_percentage,
                })
                break
                
              case 'analysis_started':
              case 'review_status_changed':
                console.log('📝 Review status changed:', data.status)
                updateReview(data.review_id, {
                  status: data.status ?? 'processing',
                })
                break
                
              case 'analysis_completed':
                console.log('🎉 Analysis completed for review:', data.review_id)
                updateReview(data.review_id, {
                  status: 'completed',
                  completion_percentage: 100,
                })
                // **FIX: Don't immediately reload, let components handle refetch**
                setTimeout(() => {
                  console.log('🔄 Analysis complete, triggering refetch...')
                  // Components should listen to this status change and refetch
                }, 1000)
                break
                
              case 'column_analysis_completed':
                console.log('✅ Column analysis completed:', data.column_id, data.message)
                // Clear any remaining processing cells for this column
                if (data.column_id) {
                  set((state) => {
                    const cellsToRemove = Array.from(state.processingCells).filter(cellKey => 
                      cellKey.endsWith(`-${data.column_id}`)
                    )
                    
                    if (cellsToRemove.length > 0) {
                      console.log('🧹 Clearing stale processing cells:', cellsToRemove)
                      const newSet = new Set(state.processingCells)
                      cellsToRemove.forEach(cellKey => newSet.delete(cellKey))
                      return { processingCells: newSet }
                    }
                    
                    return state // No change needed
                  })
                }
                break
                
              case 'files_analysis_started':
                console.log('🚀 Files analysis started:', data.file_ids, data.message)
                // Files analysis started - this is just a notification
                break
                
              case 'files_analysis_completed':
                console.log('✅ Files analysis completed:', data.file_ids, data.message)
                // Files analysis completed - this is just a notification
                break
                
              case 'column_analysis_started':
                console.log('🔄 Column analysis started:', data.column_id, data.message)
                // Column analysis started - this is just a notification
                break
                
              case 'cell_updated':
                console.log('🔄 Cell updated:', `${data.file_id}-${data.column_id}`)
                const updateCellKey = `${data.file_id}-${data.column_id}`
                removeProcessingCell(updateCellKey)
                setRealTimeUpdate(updateCellKey, {
                  ...data.result,
                  status: 'completed',
                  timestamp: Date.now()
                })
                break
                
              case 'analysis_failed':
                console.log('❌ Analysis failed for review:', data.review_id, data.message)
                updateReview(data.review_id, {
                  status: 'error',
                })
                break
                
              case 'files_analysis_failed':
                console.log('❌ Files analysis failed:', data.file_ids, data.message)
                // Files analysis failed - this is just a notification
                break
                
              case 'column_analysis_failed':
                console.log('❌ Column analysis failed:', data.column_id, data.message)
                // Column analysis failed - this is just a notification
                break
                
              case 'files_added':
                console.log('📁 Files added to review:', data.file_ids, data.message)
                // Files added - this is just a notification
                break
                
              case 'column_added':
                console.log('➕ Column added to review:', data.column_id, data.message)
                // Column added - this is just a notification
                break
                
              case 'column_updated':
                console.log('📝 Column updated in review:', data.column_id, data.message)
                // Column updated - this is just a notification
                break
                
              case 'column_deleted':
                console.log('🗑️ Column deleted from review:', data.column_id, data.message)
                // Column deleted - this is just a notification
                break
                
              case 'result_updated':
                console.log('🔄 Result updated:', `${data.file_id}-${data.column_id}`)
                const resultCellKey = `${data.file_id}-${data.column_id}`
                setRealTimeUpdate(resultCellKey, {
                  ...data.result,
                  status: 'completed',
                  timestamp: Date.now()
                })
                break
                
              default:
                console.log('❓ Unhandled SSE message type:', data.type, data)
            }
          } catch (error) {
            console.error('❌ Error parsing SSE event:', error, event.data)
          }
        }
        
        eventSource.onerror = (error) => {
          console.error('❌ SSE connection error:', error)
          console.log('🔗 Connection readyState on error:', eventSource.readyState)
          console.log('🔗 Connection URL:', eventSource.url)
          
          set({ connectionStatus: 'error', error: 'Connection lost' })
          
          // **FIX: Improved auto-reconnect with backoff**
          setTimeout(() => {
            const { connectionStatus } = get()
            if (connectionStatus === 'error') {
              console.log('🔄 Attempting to reconnect SSE...')
              get().connectSSE(reviewId)
            }
          }, 3000) // Reduced to 3 seconds for faster reconnect
        }
        
        set({ sseConnection: eventSource })
        
      } catch (error) {
        console.error('❌ Failed to connect SSE:', error)
        set({ connectionStatus: 'error', error: 'Failed to establish connection' })
      }
    },
    
    disconnectSSE: () => {
      const { sseConnection } = get()
      if (sseConnection) {
        sseConnection.close()
        set({ sseConnection: null, connectedReviewId: null, connectionStatus: 'disconnected' })
      }
    },
    
    // Optimistic updates
    optimisticallyAddReview: (review) => set((state) => ({
      reviews: [...state.reviews, review]
    })),
    
    optimisticallyUpdateReviewStatus: (reviewId, status) => set((state) => ({
      reviews: state.reviews.map(review => 
        review.id === reviewId ? { ...review, status } : review
      ),
      selectedReview: state.selectedReview?.id === reviewId 
        ? { ...state.selectedReview, status }
        : state.selectedReview
    })),
  }))
)

// Stable empty arrays to prevent infinite re-renders
const EMPTY_ARRAY: any[] = []

// Selectors for optimized subscriptions
export const useReviews = () => {
  const reviews = useRealtimeStore((state) => state.reviews)
  return Array.isArray(reviews) ? reviews : EMPTY_ARRAY
}

export const useFiles = () => {
  const files = useRealtimeStore((state) => state.files)
  return Array.isArray(files) ? files : EMPTY_ARRAY
}

export const useSelectedFiles = () => {
  const selectedFiles = useRealtimeStore((state) => state.selectedFiles)
  return Array.isArray(selectedFiles) ? selectedFiles : EMPTY_ARRAY
}

export const useSelectedReview = () => useRealtimeStore((state) => state.selectedReview)
export const useProcessingCells = () => useRealtimeStore((state) => state.processingCells)
export const useRealTimeUpdates = () => useRealtimeStore((state) => state.realTimeUpdates)
export const useSidebarCollapsed = () => useRealtimeStore((state) => state.sidebarCollapsed)
export const useConnectionStatus = () => useRealtimeStore((state) => state.connectionStatus)
export const useStoreError = () => useRealtimeStore((state) => state.error)

// Individual action hooks to avoid object creation - these are stable
export const useUpdateReview = () => useRealtimeStore((state) => state.updateReview)
export const useSetSelectedReview = () => useRealtimeStore((state) => state.setSelectedReview)
export const useOptimisticallyUpdateReviewStatus = () => useRealtimeStore((state) => state.optimisticallyUpdateReviewStatus)

export const useToggleFileSelection = () => useRealtimeStore((state) => state.toggleFileSelection)
export const useClearFileSelection = () => useRealtimeStore((state) => state.clearFileSelection)
export const useSetSelectedFiles = () => useRealtimeStore((state) => state.setSelectedFiles)
export const useUpdateFile = () => useRealtimeStore((state) => state.updateFile)

export const useConnectSSE = () => useRealtimeStore((state) => state.connectSSE)
export const useDisconnectSSE = () => useRealtimeStore((state) => state.disconnectSSE)

export const useSetSidebarCollapsed = () => useRealtimeStore((state) => state.setSidebarCollapsed)
export const useSetLoading = () => useRealtimeStore((state) => state.setLoading)
export const useSetError = () => useRealtimeStore((state) => state.setError)

// Store data setters - these are stable Zustand functions
export const useSetReviews = () => useRealtimeStore((state) => state.setReviews)
export const useSetFiles = () => useRealtimeStore((state) => state.setFiles)

// Legacy grouped action hooks (memoized to prevent infinite loops) - DEPRECATED
// Use individual hooks above instead
export const useReviewActions = () => {
  const updateReview = useRealtimeStore((state) => state.updateReview)
  const setSelectedReview = useRealtimeStore((state) => state.setSelectedReview)
  const optimisticallyUpdateReviewStatus = useRealtimeStore((state) => state.optimisticallyUpdateReviewStatus)
  
  return useMemo(() => ({
    updateReview,
    setSelectedReview,
    optimisticallyUpdateReviewStatus,
  }), [updateReview, setSelectedReview, optimisticallyUpdateReviewStatus])
}

export const useFileActions = () => {
  const toggleFileSelection = useRealtimeStore((state) => state.toggleFileSelection)
  const clearFileSelection = useRealtimeStore((state) => state.clearFileSelection)
  const setSelectedFiles = useRealtimeStore((state) => state.setSelectedFiles)
  const updateFile = useRealtimeStore((state) => state.updateFile)
  
  return useMemo(() => ({
    toggleFileSelection,
    clearFileSelection,
    setSelectedFiles,
    updateFile,
  }), [toggleFileSelection, clearFileSelection, setSelectedFiles, updateFile])
}

export const useSSEActions = () => {
  const connectSSE = useRealtimeStore((state) => state.connectSSE)
  const disconnectSSE = useRealtimeStore((state) => state.disconnectSSE)
  
  return useMemo(() => ({
    connectSSE,
    disconnectSSE,
  }), [connectSSE, disconnectSSE])
}

export const useUIActions = () => {
  const setSidebarCollapsed = useRealtimeStore((state) => state.setSidebarCollapsed)
  const setLoading = useRealtimeStore((state) => state.setLoading)
  const setError = useRealtimeStore((state) => state.setError)
  
  return useMemo(() => ({
    setSidebarCollapsed,
    setLoading,
    setError,
  }), [setSidebarCollapsed, setLoading, setError])
}

export const useClearProcessingCells = () => useRealtimeStore((state) => state.clearProcessingCells)
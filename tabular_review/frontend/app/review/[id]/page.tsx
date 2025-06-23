'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { RefreshCw, ArrowLeft, AlertCircle, Menu, X } from 'lucide-react'
// import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

// Components
import { ReviewTable } from '@/components/ReviewTable'
import { ReviewFileSidebar } from '@/components/ReviewFileSidebar'
import { DocumentViewer } from '@/components/DocumentViewer'
import { AddColumnModal } from '@/components/AddColumnModal'
import { AddDocumentsModal } from '@/components/AddDocumentsModal'

// Optimized hooks
import { 
  useReview,
  useFiles,
  useAddDocuments,
  useStartAnalysis,
  queryKeys
} from '../../../hooks/useOptimizedApi'
import { useQueryClient } from '@tanstack/react-query'

// Store hooks
import {
  useRealtimeStore,
  useRealTimeUpdates,
  useProcessingCells,
  useConnectSSE,
  useDisconnectSSE,
  useConnectionStatus,
  useSetError,
  useStoreError,
  useClearProcessingCells
} from '../../../store/useRealtimeStore'

// Types
import { 
  NewColumn, 
  SelectedCell, 
  File,
  Review,
  RealTimeUpdates
} from '../../../types'

// API for column operations (not in optimized hooks yet)
import { useApi } from '../../../hooks/useApi'

// **DEBUG: Add debug panel for development**
const DebugPanel = ({ review, connectionStatus, processingCells, realTimeUpdates }: {
  review: Review
  connectionStatus: string
  processingCells: Set<string>
  realTimeUpdates: RealTimeUpdates
}) => {
  if (process.env.NODE_ENV !== 'development') return null
  
  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-90 text-white p-4 rounded-lg text-xs max-w-sm z-50">
      <div className="font-bold mb-2">🔧 Debug Panel</div>
      <div className="space-y-1">
        <div>Status: <span className={connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'}>{connectionStatus}</span></div>
        <div>Processing: {processingCells.size} cells</div>
        <div>Updates: {Object.keys(realTimeUpdates).length} cells</div>
        <div>Review Status: {review?.status}</div>
        <div>Files: {review?.files?.length || 0}</div>
        <div>Columns: {review?.columns?.length || 0}</div>
        {processingCells.size > 0 && (
          <div>
            <div className="text-yellow-400">Processing:</div>
            {Array.from(processingCells).slice(0, 3).map((cell: string) => (
              <div key={cell} className="ml-2 text-xs">{cell}</div>
            ))}
            {processingCells.size > 3 && <div className="ml-2">...and {processingCells.size - 3} more</div>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReviewDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const reviewId = params.id as string
  
  // Store hooks
  const realTimeUpdates = useRealTimeUpdates()
  const processingCells = useProcessingCells()
  const connectSSE = useConnectSSE()
  const disconnectSSE = useDisconnectSSE()
  const connectionStatus = useConnectionStatus()
  const setError = useSetError()
  const storeError = useStoreError()
  const clearProcessingCells = useClearProcessingCells()
  
  // **FIX: Load basic review first, then load with results separately - removed unused variables**
  const { data: basicReview, error: reviewError } = useReview(reviewId, false) // Basic review without results
  const { data: fullReview, isLoading: resultsLoading } = useReview(reviewId, true) // Full review with results
  const { data: files = [] } = useFiles()
  const addDocumentsMutation = useAddDocuments()
  const startAnalysisMutation = useStartAnalysis()
  
  // **FIX: Use fullReview if available, otherwise use basicReview**
  const review = fullReview || basicReview
  
  // API hook for column operations
  const { addColumnToReview, fetchDocumentMarkdown } = useApi()
  
  // Local state - Enhanced for mobile - removed unused showDocumentViewer
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false) // New mobile sidebar state
  const [showAddColumnModal, setShowAddColumnModal] = useState(false)
  const [showAddDocumentsModal, setShowAddDocumentsModal] = useState(false)
  const [newColumn, setNewColumn] = useState<NewColumn>({ 
    column_name: '', 
    prompt: '', 
    data_type: 'text' 
  })
  const [selectedNewFiles, setSelectedNewFiles] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')

  // **NEW: Mobile breakpoint detection**
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // **FIX 1: Connect SSE immediately when review is available, regardless of status**
  useEffect(() => {
    if (review && reviewId) {
      console.log('🔌 Connecting SSE immediately for review:', reviewId, 'status:', review.status)
      connectSSE(reviewId)
      
      return () => {
        console.log('🔌 Disconnecting SSE for review:', reviewId)
        disconnectSSE()
      }
    }
  }, [reviewId, review?.id, connectSSE, disconnectSSE])

  // **FIX 2: Add optimistic processing cells for newly created reviews - FIXED DEPENDENCY**
  useEffect(() => {
    if (review && review.status === 'processing' && review.files && review.columns) {
      // Check if this is a newly created review (very recent created_at)
      const createdAt = new Date(review.created_at)
      const now = new Date()
      const secondsAgo = (now.getTime() - createdAt.getTime()) / 1000
      
      // If created within last 30 seconds, add all cells to processing immediately
      if (secondsAgo < 30) {
        console.log('🚀 Newly created review detected, adding optimistic processing cells')
        const { addProcessingCell } = useRealtimeStore.getState()
        
        review.files.forEach(file => {
          review.columns?.forEach(column => {
            const cellKey = `${file.file_id}-${column.id}`
            // Only add if not already have results
            const hasResult = review.results?.some(r => r.file_id === file.file_id && r.column_id === column.id)
            if (!hasResult) {
              addProcessingCell(cellKey)
            }
          })
        })
      }
    }
  }, [review]) // Fixed: Added review dependency

  // **FIX: Clear processing cells when analysis completed and update review data**
  useEffect(() => {
    if (review && review.status === 'completed') {
      if (processingCells.size > 0) {
        clearProcessingCells()
      }
      // ensure latest results fetched
      queryClient.invalidateQueries({ queryKey: ['review', reviewId, true] })
    }
  }, [review?.status])

  // Error handling
  useEffect(() => {
    if (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Failed to load review')
    }
  }, [reviewError, setError])

  // Create a combined list of files for the sidebar
  const filteredFiles = useMemo(() => {
    if (!review) return []
    
    const reviewFiles: File[] = review.files?.map(reviewFile => ({
      id: reviewFile.file_id,
      original_filename: reviewFile.filename,
      file_size: reviewFile.file_size || 0,
      status: (reviewFile.status as 'queued' | 'processing' | 'completed' | 'failed') || 'completed',
      folder_id: review.folder_id,
      user_id: '',
      file_type: 'application/pdf',
      upload_date: '2024-01-01T00:00:00.000Z',
      file_path: '',
      storage_path: '',
      storage_url: '',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      processed_at: '2024-01-01T00:00:00.000Z',
      error_message: null
    })) || []

    if (review.folder_id) {
      const otherFolderFiles = files.filter((f: File) => 
        f.folder_id === review.folder_id && 
        !reviewFiles.some(rf => rf.id === f.id)
      )
      return [...reviewFiles, ...otherFolderFiles]
    }

    return reviewFiles
  }, [review, files])

  // Enhanced review with merged results - keep results as array for components
  const enhancedReview = review ? {
    ...review,
    results: review.results || []
  } : null

  // Handlers - Enhanced for mobile
  const handleStartAnalysis = useCallback(async () => {
    if (!review) return
    
    try {
      connectSSE(reviewId)
      
      if (review.files && review.columns) {
        const { addProcessingCell } = useRealtimeStore.getState()
        review.files.forEach(file => {
          review.columns?.forEach(column => {
            const cellKey = `${file.file_id}-${column.id}`
            addProcessingCell(cellKey)
          })
        })
      }
      
      queryClient.setQueryData(queryKeys.review(reviewId), (old: Review | undefined) => 
        old ? { ...old, status: 'processing' as const } : old
      )
      
      await startAnalysisMutation.mutateAsync(reviewId)
      queryClient.invalidateQueries({ queryKey: ['review', reviewId, true] })
    } catch (error) {
      console.error('Failed to start analysis:', error)
      setError('Failed to start analysis')
    }
  }, [review, reviewId, startAnalysisMutation, connectSSE, queryClient, setError])

  const handleCellClick = useCallback(async (reviewId: string, fileId: string, columnId: string, result: { extracted_value: string | null; source_reference?: string; confidence_score: number }) => {
    if (!result || !result.extracted_value) return
    
    const markdownContent = await fetchDocumentMarkdown(fileId)
    setSelectedCell({ 
      reviewId, 
      fileId, 
      columnId, 
      value: result.extracted_value,
      sourceRef: result.source_reference || 'No source reference',
      confidence: result.confidence_score,
      markdownContent
    })
  }, [fetchDocumentMarkdown])

  const handleAddColumn = useCallback(async () => {
    if (!review) return
    
    connectSSE(reviewId)
    
    const success = await addColumnToReview(review.id, newColumn)
    if (success) {
      queryClient.invalidateQueries({ queryKey: ['review', reviewId, true] })
      setNewColumn({ column_name: '', prompt: '', data_type: 'text' })
      setShowAddColumnModal(false)
    }
  }, [review, reviewId, newColumn, addColumnToReview, connectSSE, queryClient])

  const handleAddDocuments = useCallback(async () => {
    if (!review || selectedNewFiles.length === 0) return
    
    try {
      connectSSE(reviewId)
      
      await addDocumentsMutation.mutateAsync({
        reviewId: review.id,
        fileIds: selectedNewFiles
      })
      
      queryClient.invalidateQueries({ queryKey: ['review', reviewId, true] })
      
      setSelectedNewFiles([])
      setSearchQuery('')
      setShowAddDocumentsModal(false)
    } catch (error) {
      console.error('Failed to add documents:', error)
      setError('Failed to add documents')
    }
  }, [review, reviewId, selectedNewFiles, addDocumentsMutation, connectSSE, queryClient, setError])

  const handleDropFile = useCallback(async (fileId: string) => {
    if (!review) return
    
    try {
      const droppedFile = files.find((f: File) => f.id === fileId)
      if (!droppedFile) return
      
      if (review.folder_id && droppedFile.folder_id !== review.folder_id) {
        setError('Cannot add files from different folders to this review')
        return
      }
      
      const existingFileIds = review.files?.map(f => f.file_id) || []
      if (existingFileIds.includes(fileId)) return
      
      connectSSE(reviewId)
      
      await addDocumentsMutation.mutateAsync({
        reviewId: review.id,
        fileIds: [fileId]
      })
      
      queryClient.invalidateQueries({ queryKey: ['review', reviewId, true] })
    } catch (error) {
      console.error('Failed to add file:', error)
      setError('Failed to add file')
    }
  }, [review, reviewId, files, addDocumentsMutation, connectSSE, queryClient, setError])

  const handleFileSelection = useCallback((fileId: string) => {
    setSelectedNewFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    )
  }, [])

  // **NEW: Mobile sidebar handlers**
  const toggleMobileSidebar = useCallback(() => {
    setShowMobileSidebar(prev => !prev)
  }, [])

  const closeMobileSidebar = useCallback(() => {
    setShowMobileSidebar(false)
  }, [])

  // **FIX: Only show loading screen if we have absolutely no review data**
  if (!review) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 items-center justify-center">
        <div className="text-center p-8">
          <RefreshCw className="h-10 w-10 sm:h-12 sm:w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Review</h3>
          <p className="text-gray-600">Fetching review details...</p>
        </div>
      </div>
    )
  }

  if (storeError || reviewError) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-red-50 via-white to-red-50 items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Review</h2>
          <p className="text-gray-600 mb-6">{storeError || 'Failed to load review'}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => router.back()} variant="outline" className="touch-target">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
            <Button onClick={() => window.location.reload()} className="touch-target">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!review.files || !review.columns) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Review Structure Loading</h2>
          <p className="text-gray-600 mb-4">Loading review files and columns...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 relative">
      {/* **FIX: Show a loading indicator for results if still loading** */}
      {resultsLoading && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm hidden sm:inline">Loading analysis results...</span>
          <span className="text-sm sm:hidden">Loading...</span>
        </div>
      )}

      {/* Mobile Header with Sidebar Toggle */}
      {isMobile && (
        <div className="absolute top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 p-4 sm:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={toggleMobileSidebar} className="touch-target">
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-lg font-semibold text-gray-900 truncate max-w-[200px]" title={review.name}>
                {review.name}
              </h1>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/review')} className="touch-target">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobile && showMobileSidebar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={closeMobileSidebar}>
          <div className="absolute top-0 left-0 bottom-0 w-80 bg-white shadow-xl">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Files</h3>
              <Button variant="ghost" size="sm" onClick={closeMobileSidebar} className="touch-target">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="h-full overflow-hidden">
              <ReviewFileSidebar
                review={enhancedReview!}
                files={filteredFiles}
                isCollapsed={false}
                onToggleCollapse={closeMobileSidebar}
                onAddDocuments={() => {
                  setShowAddDocumentsModal(true)
                  closeMobileSidebar()
                }}
                isMobile={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Desktop File Sidebar */}
      {!isMobile && (
        <ReviewFileSidebar
          review={enhancedReview!}
          files={filteredFiles}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onAddDocuments={() => setShowAddDocumentsModal(true)}
          isMobile={false}
        />
      )}

      {/* Main Review Table - Enhanced for mobile */}
      <div className={`flex-1 flex flex-col min-w-0 ${isMobile ? 'pt-20' : ''}`}>
        <ReviewTable
          review={enhancedReview!}
          realTimeUpdates={realTimeUpdates}
          processingCells={processingCells}
          files={filteredFiles}
          onBack={() => router.push('/review')}
          onCellClick={handleCellClick}
          onAddColumn={() => setShowAddColumnModal(true)}
          onAddDocuments={() => setShowAddDocumentsModal(true)}
          onStartAnalysis={handleStartAnalysis}
          onDropFile={handleDropFile}
          isMobile={isMobile}
        />
      </div>

      {/* Modals - Enhanced for mobile */}
      <DocumentViewer
        selectedCell={selectedCell}
        onClose={() => setSelectedCell(null)}
        isMobile={isMobile}
      />

      <AddColumnModal
        isOpen={showAddColumnModal}
        review={enhancedReview}
        newColumn={newColumn}
        isLoading={false}
        onClose={() => setShowAddColumnModal(false)}
        onUpdateColumn={setNewColumn}
        onSubmit={handleAddColumn}
        isMobile={isMobile}
      />

      <AddDocumentsModal
        isOpen={showAddDocumentsModal}
        review={enhancedReview}
        files={filteredFiles}
        selectedFiles={selectedNewFiles}
        searchQuery={searchQuery}
        isLoading={addDocumentsMutation.isPending}
        onClose={() => {
          setShowAddDocumentsModal(false)
          setSelectedNewFiles([])
          setSearchQuery('')
        }}
        onFileSelect={handleFileSelection}
        onSearchChange={setSearchQuery}
        onSubmit={handleAddDocuments}
        isMobile={isMobile}
      />

      <DebugPanel
        review={review}
        connectionStatus={connectionStatus}
        processingCells={processingCells}
        realTimeUpdates={realTimeUpdates}
      />
    </div>
  )
}
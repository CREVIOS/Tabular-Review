import React, { useState, useMemo, useCallback } from 'react'
import { ArrowLeft, Plus, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Review, RealTimeUpdates, ReviewResult, File } from '../types'
import { DataTable } from './review-table/data-table'
import { createColumns, ReviewTableRow } from './review-table/columns'

interface ReviewTableProps {
  review: Review
  realTimeUpdates: RealTimeUpdates
  processingCells: Set<string>
  files: File[]
  onBack: () => void
  onCellClick: (reviewId: string, fileId: string, columnId: string, result: ReviewResult) => void
  onAddColumn: () => void
  onAddDocuments: () => void
  onStartAnalysis: (reviewId: string) => void
  onDropFile: (fileId: string) => void
  isMobile?: boolean
  folderContext?: {
    folderId: string
    folderName: string
    folderColor: string
  }
}

export const ReviewTable: React.FC<ReviewTableProps> = ({
  review,
  realTimeUpdates,
  processingCells,
  files,
  onBack,
  onCellClick,
  onAddColumn,
  onAddDocuments,
  onStartAnalysis,
  onDropFile,
  isMobile = false,
  folderContext
}) => {
  const [isDragOver, setIsDragOver] = useState(false)

  // Memoize the callback functions to prevent unnecessary re-renders
  const handleCellClick = useCallback((fileId: string, columnId: string, result: ReviewResult) => {
    onCellClick(review.id, fileId, columnId, result)
  }, [review.id, onCellClick])

  const handleViewFile = useCallback((fileId: string) => {
    // You can implement file viewing logic here
    console.log('View file:', fileId)
  }, [])

  // Transform review data into table format with real-time updates
  const tableData: ReviewTableRow[] = useMemo(() => {
    if (!review.files || !review.columns) return []

    return review.files.map(file => {
      const results: Record<string, ReviewResult | null> = {}
      
      // Initialize all columns with null
      review.columns?.forEach(column => {
        results[column.id] = null
      })
      
      // Fill in stored results from the array
      if (review.results && Array.isArray(review.results)) {
        review.results.forEach(result => {
          if (result.file_id === file.file_id) {
            results[result.column_id] = result
          }
        })
      }
      
      // CRITICAL: Override with real-time updates
      review.columns?.forEach(column => {
        const cellKey = `${file.file_id}-${column.id}`
        if (realTimeUpdates[cellKey]) {
          // Convert RealTimeUpdate to ReviewResult format
          const realtimeData = realTimeUpdates[cellKey]
          results[column.id] = {
            file_id: file.file_id,
            column_id: column.id,
            extracted_value: realtimeData.extracted_value,
            confidence_score: realtimeData.confidence_score || 0,
            source_reference: realtimeData.source_reference || '',
            error: realtimeData.error,
            timestamp: realtimeData.timestamp || Date.now()
          }
        }
      })

      // Find the full file info from the files array
      const fullFile = files.find(f => f.id === file.file_id)
      
      return {
        file,
        fileName: file.filename || fullFile?.original_filename || 'Unknown',
        fileStatus: file.status || fullFile?.status || 'unknown',
        results
      }
    })
  }, [review.files, review.columns, review.results, realTimeUpdates, files])

  // **FIX: Add fallback processing cells for newly created reviews**
  const enhancedProcessingCells = useMemo(() => {
    const enhanced = new Set(processingCells)
    
    // If review is processing and was created recently (within 60 seconds)
    if (review.status === 'processing' && review.created_at) {
      const createdAt = new Date(review.created_at)
      const now = new Date()
      const secondsAgo = (now.getTime() - createdAt.getTime()) / 1000
      
      console.log('🕒 Review age:', secondsAgo, 'seconds')
      
      if (secondsAgo < 60) {
        console.log('🎯 Adding fallback processing cells for new review')
        // Add cells that don't have results yet as processing
        review.files?.forEach(file => {
          review.columns?.forEach(column => {
            const cellKey = `${file.file_id}-${column.id}`
            const hasResult = review.results?.some(r => r.file_id === file.file_id && r.column_id === column.id)
            const hasRealtimeUpdate = realTimeUpdates[cellKey]
            
            if (!hasResult && !hasRealtimeUpdate) {
              enhanced.add(cellKey)
              console.log('➕ Added fallback processing cell:', cellKey)
            }
          })
        })
        console.log('📊 Total enhanced processing cells:', enhanced.size)
      }
    }
    
    return enhanced
  }, [processingCells, review, realTimeUpdates])

  // Create columns with callbacks - memoize to prevent infinite re-renders
  const columns = useMemo(() => {
    if (!review.columns) return []
    
    return createColumns({
      columns: review.columns,
      realTimeUpdates,
      processingCells: enhancedProcessingCells, // Use enhanced processing cells
      onCellClick: handleCellClick,
      onViewFile: handleViewFile,
      isMobile
    })
  }, [review.columns, realTimeUpdates, enhancedProcessingCells, handleCellClick, handleViewFile, isMobile])

  // Calculate real completion percentage based on actual data
  const calculatedCompletionPercentage = useMemo(() => {
    if (!review.files?.length || !review.columns?.length) return 0
    
    const totalCells = review.files.length * review.columns.length
    let completedCells = 0
    
    tableData.forEach(row => {
      Object.entries(row.results).forEach(([columnId, result]) => {
        if (result && (result.extracted_value !== null || result.error)) {
          completedCells++
        }
      })
    })
    
    return Math.round((completedCells / totalCells) * 100)
  }, [tableData, review.files?.length, review.columns?.length])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const fileId = e.dataTransfer.getData('text/plain')
    if (fileId) {
      onDropFile(fileId)
    }
  }, [onDropFile])

  const handleStartAnalysisClick = useCallback(() => {
    onStartAnalysis(review.id)
  }, [onStartAnalysis, review.id])

  // Debug log to check data flow
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('ReviewTable Debug:', {
        reviewFiles: review.files?.length || 0,
        reviewColumns: review.columns?.length || 0,
        realTimeUpdatesCount: Object.keys(realTimeUpdates).length,
        processingCellsCount: processingCells.size,
        enhancedProcessingCellsCount: enhancedProcessingCells.size,
        tableDataCount: tableData.length,
        completionPercentage: calculatedCompletionPercentage,
        reviewStatus: review.status,
        reviewCreatedAt: review.created_at
      })
      
      // Log sample cell states
      if (tableData.length > 0 && review.columns && review.columns.length > 0) {
        const firstFile = tableData[0]
        const firstColumn = review.columns[0]
        const cellKey = `${firstFile.file.file_id}-${firstColumn.id}`
        const hasResult = firstFile.results[firstColumn.id]
        const hasRealTimeUpdate = realTimeUpdates[cellKey]
        const isProcessing = enhancedProcessingCells.has(cellKey)
        
        console.log('Sample Cell Debug:', {
          cellKey,
          hasResult: !!hasResult,
          hasRealTimeUpdate: !!hasRealTimeUpdate,
          isProcessing,
          resultValue: hasResult?.extracted_value,
          fileName: firstFile.fileName
        })
      }
    }
  }, [review, realTimeUpdates, processingCells, tableData, calculatedCompletionPercentage])

  // Show empty state if no files
  if (!review.files || review.files.length === 0) {
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Simple Header - Enhanced for mobile */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
          <div className={`flex items-center justify-between ${isMobile ? 'p-3' : 'p-4 lg:p-6'}`}>
            <div className="flex items-center gap-3 min-w-0">
              {!isMobile && (
                <Button variant="ghost" size="sm" onClick={onBack} className="flex-shrink-0 touch-target">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <h1 className={`font-bold text-gray-900 truncate ${isMobile ? 'text-base' : 'text-lg lg:text-xl'}`} title={review.name}>
                    {review.name}
                  </h1>
                  {review.description && (
                    <p className={`text-gray-600 truncate ${isMobile ? 'text-xs' : 'text-xs lg:text-sm'}`} title={review.description}>
                      {review.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className={`flex items-center gap-2 flex-shrink-0 ${isMobile ? 'flex-col' : ''}`}>
              <Button
                variant="outline"
                size={isMobile ? "sm" : "sm"}
                onClick={onAddDocuments}
                className={`flex items-center gap-1 touch-target ${isMobile ? 'text-xs' : ''}`}
              >
                <Plus className="h-4 w-4" />
                <span className={isMobile ? 'hidden' : ''}>Add Documents</span>
                <span className={isMobile ? '' : 'hidden'}>Add</span>
              </Button>
              <Button
                variant="outline"
                size={isMobile ? "sm" : "sm"}
                onClick={onAddColumn}
                className={`flex items-center gap-1 touch-target ${isMobile ? 'text-xs' : ''}`}
              >
                <Plus className="h-4 w-4" />
                <span className={isMobile ? 'hidden' : ''}>Add Column</span>
                <span className={isMobile ? '' : 'hidden'}>Add</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Empty State - Enhanced for mobile */}
        <div className="flex-1 flex items-center justify-center">
          <div className={`text-center ${isMobile ? 'px-4 py-8' : 'py-12'}`}>
            <div className={`bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 ${isMobile ? 'w-16 h-16' : 'w-20 h-20'}`}>
              <FileText className={`text-gray-400 ${isMobile ? 'h-8 w-8' : 'h-10 w-10'}`} />
            </div>
            <h3 className={`font-semibold text-gray-700 mb-2 ${isMobile ? 'text-lg' : 'text-xl'}`}>No documents in this review</h3>
            <p className={`text-gray-500 mb-6 max-w-md mx-auto ${isMobile ? 'text-sm' : ''}`}>
              Get started by {isMobile ? 'adding' : 'dragging files from the sidebar or clicking the button below to add'} documents for analysis.
            </p>
            <Button onClick={onAddDocuments} className="bg-blue-600 hover:bg-blue-700 touch-target">
              <Plus className="h-4 w-4 mr-2" />
              Add Documents
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Show empty columns state
  if (!review.columns || review.columns.length === 0) {
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Header - Enhanced for mobile */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200">
          <div className={`flex items-center justify-between ${isMobile ? 'p-3' : 'p-4'}`}>
            {!isMobile && (
              <Button variant="ghost" size="sm" onClick={onBack} className="flex-shrink-0 touch-target">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Reviews
              </Button>
            )}
          </div>
        </div>

        {/* Empty Columns State - Enhanced for mobile */}
        <div className="flex-1 flex items-center justify-center">
          <div className={`text-center ${isMobile ? 'px-4 py-8' : 'py-12'}`}>
            <div className={`bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 ${isMobile ? 'w-16 h-16' : 'w-20 h-20'}`}>
              <Plus className={`text-gray-400 ${isMobile ? 'h-8 w-8' : 'h-10 w-10'}`} />
            </div>
            <h3 className={`font-semibold text-gray-700 mb-2 ${isMobile ? 'text-lg' : 'text-xl'}`}>No columns configured</h3>
            <p className={`text-gray-500 mb-6 max-w-md mx-auto ${isMobile ? 'text-sm' : ''}`}>
              Add columns to define what data you want to extract from the documents.
            </p>
            <Button onClick={onAddColumn} className="bg-blue-600 hover:bg-blue-700 touch-target">
              <Plus className="h-4 w-4 mr-2" />
              Add Column
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Minimal Header with Back Button - Enhanced for mobile */}
      {!isMobile && (
        <div className="flex-shrink-0 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between p-4">
            <Button variant="ghost" size="sm" onClick={onBack} className="flex-shrink-0 touch-target">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Reviews
            </Button>
            
            {/* **DEBUG: Real-time status indicator** */}
            {process.env.NODE_ENV === 'development' && (
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${enhancedProcessingCells.size > 0 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
                  <span>Processing: {enhancedProcessingCells.size}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${Object.keys(realTimeUpdates).length > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>Updates: {Object.keys(realTimeUpdates).length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${review.status === 'processing' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-300'}`}></div>
                  <span>Status: {review.status}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drag and Drop Table Container with Scrolling - Enhanced for mobile */}
      <div 
        className={`flex-1 overflow-auto relative ${isDragOver ? 'bg-blue-50' : ''}`}
        onDragOver={!isMobile ? handleDragOver : undefined}
        onDragLeave={!isMobile ? handleDragLeave : undefined}
        onDrop={!isMobile ? handleDrop : undefined}
      >
        {/* Drag Overlay - Desktop only */}
        {isDragOver && !isMobile && (
          <div className="absolute inset-0 bg-blue-50 bg-opacity-95 flex items-center justify-center z-50 pointer-events-none border-2 border-dashed border-blue-400">
            <div className="text-center">
              <Plus className="h-16 w-16 text-blue-500 mx-auto mb-4" />
              <p className="text-xl font-semibold text-blue-700">Drop file to add to review</p>
              <p className="text-sm text-blue-600 mt-2">File will be automatically analyzed</p>
            </div>
          </div>
        )}

        <div className={`min-h-full ${isMobile ? 'p-3' : 'p-6'}`}>
          <DataTable
            columns={columns}
            data={tableData}
            reviewName={review.name}
            reviewStatus={review.status}
            totalFiles={review.total_files || review.files?.length || 0}
            totalColumns={review.total_columns || review.columns?.length || 0}
            completionPercentage={review.completion_percentage || calculatedCompletionPercentage}
            reviewColumns={review.columns}
            onStartAnalysis={handleStartAnalysisClick}
            onAddColumn={onAddColumn}
            onAddDocuments={onAddDocuments}
            isMobile={isMobile}
          />
        </div>
      </div>
    </div>
  )
}
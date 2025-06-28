// Fixed RealTimeReviewTable.tsx
import React, { memo, useCallback, useMemo, useEffect, useState } from 'react'
// import * as XLSX from 'xlsx'
import { 
  FileText, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DataTable } from './data-table' 
import { createColumns, ReviewTableRow } from './columns' 
import { DocumentViewer } from '../DocumentViewer'
import {
  ReviewColumn as GlobalReviewColumn,
  ReviewResult as GlobalReviewResult,
  RealTimeUpdates as GlobalRealTimeUpdates,
  SelectedCell,
} from '@/types'

interface ReviewColumn {
  id: string
  column_name: string
  prompt: string
  column_order: number
  data_type: string
  created_at: string
}

interface ReviewFile {
  id: string
  file_id: string
  filename: string
  file_size: number
  status: string
  added_at: string
}

interface ReviewResult {
  id: string
  review_id: string
  file_id: string
  column_id: string
  extracted_value: string | null
  confidence_score: number | null
  source_reference: string | null
  created_at: string
  updated_at: string
}

interface CellData {
  value: string | null
  confidence: number
  source: string | null
  status: 'pending' | 'processing' | 'completed' | 'error'
  timestamp: number
}

type RealTimeUpdates = GlobalRealTimeUpdates

const useCellDataStore = () => {
  const [cellData, setCellData] = useState<Map<string, CellData>>(new Map())
  
  const updateCell = useCallback((fileId: string, columnId: string, data: CellData) => {
    setCellData(prev => {
      const newMap = new Map(prev)
      newMap.set(`${fileId}:${columnId}`, data)
      return newMap
    })
  }, [])
  
  const getCellData = useCallback((fileId: string, columnId: string): CellData | null => {
    return cellData.get(`${fileId}:${columnId}`) || null
  }, [cellData])
  
  const getAllCellData = useCallback(() => {
    return Array.from(cellData.values())
  }, [cellData])
  
  const getRealTimeUpdates = useCallback((): RealTimeUpdates => {
    const updates: RealTimeUpdates = {}
    cellData.forEach((data, key) => {
      if (data.status === 'completed' || data.status === 'error') {
        updates[key] = {
          extracted_value: data.value,
          confidence_score: data.confidence,
          source_reference: data.source || '',
          timestamp: data.timestamp,
          error: data.status === 'error'
        }
      }
    })
    return updates
  }, [cellData])
  
  const getProcessingCells = useCallback((): Set<string> => {
    const processing = new Set<string>()
    cellData.forEach((data, key) => {
      if (data.status === 'processing') {
        processing.add(key)
      }
    })
    return processing
  }, [cellData])
  
  return { updateCell, getCellData, getAllCellData, getRealTimeUpdates, getProcessingCells }
}

const CompletionStats = memo(({ 
  totalCells, 
  getAllCellData 
}: { 
  totalCells: number
  getAllCellData: () => CellData[]
}) => {
  const cellData = getAllCellData()
  
  const stats = useMemo(() => {
    let completed = 0
    let processing = 0
    let errors = 0
    let highConfidence = 0
    let totalConfidence = 0
    let validResults = 0
    
    cellData.forEach(cell => {
      if (cell.status === 'completed') {
        completed++
        if (cell.confidence > 0) {
          totalConfidence += cell.confidence
          validResults++
          if (cell.confidence >= 0.8) highConfidence++
        }
      } else if (cell.status === 'processing') {
        processing++
      } else if (cell.status === 'error') {
        errors++
      }
    })
    
    const avgConfidence = validResults > 0 ? totalConfidence / validResults : 0
    const percentage = Math.round((completed / totalCells) * 100)
    
    return { 
      completed, 
      processing, 
      errors, 
      percentage, 
      highConfidence,
      avgConfidence: Math.round(avgConfidence * 100)
    }
  }, [cellData, totalCells])
  
  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-3">
        <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
            style={{ width: `${stats.percentage}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-gray-900 tabular-nums">
          {stats.percentage}%
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium tabular-nums">{stats.completed}</span>
          <span className="text-xs text-gray-500">completed</span>
        </div>
        
        {stats.processing > 0 && (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-sm font-medium tabular-nums">{stats.processing}</span>
            <span className="text-xs text-gray-500">processing</span>
          </div>
        )}
        
        {stats.errors > 0 && (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium tabular-nums">{stats.errors}</span>
            <span className="text-xs text-gray-500">errors</span>
          </div>
        )}
      </div>
    </div>
  )
})

CompletionStats.displayName = 'CompletionStats'

const supabase = createClient();   
export default function RealTimeReviewTable({ 
  // onExport,
  reviewId,
  onStartAnalysis,
  onAddColumn,
  onAddDocuments,
  reviewName = "Document Review",
  reviewStatus = "draft"
}: {
  // onExport?: () => void
  reviewId: string
  onStartAnalysis?: () => void
  onAddColumn?: () => void
  onAddDocuments?: () => void
  reviewName?: string
  reviewStatus?: string
}) {
  // const supabase = createClient()

  // Internal state management
  const [columns, setColumns] = useState<ReviewColumn[]>([])
  const [files, setFiles] = useState<ReviewFile[]>([])
  const [results, setResults] = useState<ReviewResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)
  
  // Cell data store for real-time updates
  const { updateCell, getCellData, getAllCellData, getRealTimeUpdates, getProcessingCells } = useCellDataStore()

  // FIXED: Separate initial data fetching from real-time subscriptions
  // This prevents infinite loops by removing dependencies that change within the effect
  useEffect(() => {
    if (!reviewId) return

    let isMounted = true // Prevent state updates if component unmounts

    const fetchReviewData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log('🔄 Fetching review data for:', reviewId)
        
        // Fetch all data in parallel
        const [columnsResponse, filesResponse, resultsResponse] = await Promise.all([
          supabase
            .from('tabular_review_columns')
            .select('*')
            .eq('review_id', reviewId)
            .order('column_order'),
          
          supabase
            .from('tabular_review_files')
            .select(`
              *,
              files (
                original_filename,
                file_size,
                status
              )
            `)
            .eq('review_id', reviewId),
          
          supabase
            .from('tabular_review_results')
            .select('*')
            .eq('review_id', reviewId)
        ])

        // Check for errors
        if (columnsResponse.error) throw columnsResponse.error
        if (filesResponse.error) throw filesResponse.error
        if (resultsResponse.error) throw resultsResponse.error

        if (!isMounted) return // Component was unmounted

        // Transform files data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transformedFiles: ReviewFile[] = (filesResponse.data || []).map((file: any) => ({
          id: file.id,
          file_id: file.file_id,
          filename: file.files?.original_filename ?? '',
          file_size: file.files?.file_size ?? 0,
          status: file.files?.status ?? '',
          added_at: file.added_at ?? ''
        }))
        
        // Update state only once
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const columnsData = (columnsResponse.data || []).map((col: any) => ({
          ...col,
          data_type: col.data_type ?? '',
          created_at: col.created_at ?? '',
        }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resultsData = (resultsResponse.data || []).map((result: any) => ({
          ...result,
          created_at: result.created_at ?? '',
          updated_at: result.updated_at ?? '',
        }))

        setColumns(columnsData)
        setFiles(transformedFiles)
        setResults(resultsData)
        
        // Initialize cell data with existing results
        resultsData.forEach(result => {
          updateCell(result.file_id, result.column_id, {
            value: result.extracted_value,
            confidence: result.confidence_score || 0,
            source: result.source_reference,
            status: 'completed',
            timestamp: new Date(result.created_at ?? '').getTime()
          })
        })
        
        // Initialize pending cells for all file-column combinations
        columnsData.forEach(column => {
          transformedFiles.forEach(file => {
            const existingResult = resultsData.find(r => 
              r.file_id === file.file_id && r.column_id === column.id
            )
            
            if (!existingResult) {
              updateCell(file.file_id, column.id, {
                value: null,
                confidence: 0,
                source: null,
                status: 'pending',
                timestamp: Date.now()
              })
            }
          })
        })

        console.log('✅ Review data loaded successfully')
        
      } catch (err) {
        console.error('❌ Error fetching review data:', err)
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch review data')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchReviewData()

    return () => {
      isMounted = false
    }
  }, [reviewId, supabase, updateCell]) // FIXED: Removed 'columns' from dependencies

  // FIXED: Separate effect for real-time subscriptions
  useEffect(() => {
    if (!reviewId || loading) return

    console.log('🔔 Setting up real-time subscriptions for:', reviewId)

    // Set up real-time subscriptions
    const columnsChannel = supabase
      .channel(`columns-${reviewId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'tabular_review_columns',
          filter: `review_id=eq.${reviewId}`
        },
        (payload) => {
          console.log('📊 Columns change:', payload.eventType)
          if (payload.eventType === 'INSERT') {
            setColumns(prev => [...prev, payload.new as ReviewColumn])
          } else if (payload.eventType === 'UPDATE') {
            setColumns(prev => prev.map(col => 
              col.id === payload.new.id ? payload.new as ReviewColumn : col
            ))
          } else if (payload.eventType === 'DELETE') {
            setColumns(prev => prev.filter(col => col.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    const filesChannel = supabase
      .channel(`files-${reviewId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'tabular_review_files',
          filter: `review_id=eq.${reviewId}`
        },
        async (payload) => {
          console.log('📁 Files change:', payload.eventType)
          if (payload.eventType === 'INSERT') {
            // Fetch the new file with details
            const { data: newFileData } = await supabase
              .from('tabular_review_files')
              .select(`
                *,
                files (
                  original_filename,
                  file_size,
                  status
                )
              `)
              .eq('id', payload.new.id)
              .single()
            
            if (newFileData) {
              const newFile: ReviewFile = {
                id: newFileData.id,
                file_id: newFileData.file_id,
                filename: newFileData.files?.original_filename ?? '',
                file_size: newFileData.files?.file_size ?? 0,
                status: newFileData.files?.status ?? '',
                added_at: newFileData.added_at ?? ''
              }
              
              setFiles(prev => [...prev, newFile])
              
              // Initialize pending cells for new file (get current columns)
              setColumns(currentColumns => {
                currentColumns.forEach(column => {
                  updateCell(newFile.file_id, column.id, {
                    value: null,
                    confidence: 0,
                    source: null,
                    status: 'pending',
                    timestamp: Date.now()
                  })
                })
                return currentColumns // Don't change columns state
              })
            }
          } else if (payload.eventType === 'DELETE') {
            setFiles(prev => prev.filter(file => file.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    const resultsChannel = supabase
      .channel(`results-${reviewId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'tabular_review_results',
          filter: `review_id=eq.${reviewId}`
        },
        (payload) => {
          console.log('📈 Results change:', payload.eventType)
          if (payload.eventType === 'INSERT') {
            const result = payload.new as ReviewResult
            
            // Update cell data with new result
            updateCell(result.file_id, result.column_id, {
              value: result.extracted_value,
              confidence: result.confidence_score || 0,
              source: result.source_reference,
              status: 'completed',
              timestamp: new Date(result.created_at ?? '').getTime()
            })
            
            // Update results state
            setResults(prev => [...prev, result])
          } else if (payload.eventType === 'UPDATE') {
            const result = payload.new as ReviewResult
            
            // Update cell data
            updateCell(result.file_id, result.column_id, {
              value: result.extracted_value,
              confidence: result.confidence_score || 0,
              source: result.source_reference,
              status: 'completed',
              timestamp: new Date(result.updated_at ?? '').getTime()
            })
            
            // Update results state
            setResults(prev => prev.map(r => 
              r.id === result.id ? result : r
            ))
          }
        }
      )
      .subscribe()

    return () => {
      console.log('🔇 Cleaning up subscriptions for:', reviewId)
      supabase.removeChannel(columnsChannel)
      supabase.removeChannel(filesChannel)
      supabase.removeChannel(resultsChannel)
    }
  }, [reviewId, supabase, updateCell, loading]) // Only depend on loading to wait for initial fetch

  const tableData = useMemo<ReviewTableRow[]>(() => {
    if (!files.length) return []
    
    const makeTempResult = (
      fileId: string,
      columnId: string,
      partial: Partial<GlobalReviewResult> & {
        extracted_value: string | null
        confidence_score: number
        source_reference: string | null
        timestamp: number
        error?: boolean
      }
    ): GlobalReviewResult => ({
      id: '',
      review_id: reviewId,
      file_id: fileId,
      column_id: columnId,
      extracted_value: partial.extracted_value,
      confidence_score: partial.confidence_score,
      source_reference: partial.source_reference ?? '',
      created_at: new Date(partial.timestamp).toISOString(),
      updated_at: new Date(partial.timestamp).toISOString(),
    } as GlobalReviewResult)

    return files.map(file => {
      const resultsForFile: Record<string, GlobalReviewResult | null> = {}
      
      columns.forEach(column => {
        const cellData = getCellData(file.file_id, column.id)
        const existingResult = results.find(r => 
          r.file_id === file.file_id && r.column_id === column.id
        )
        
        if (cellData && (cellData.status === 'completed' || cellData.status === 'error')) {
          resultsForFile[column.id] = makeTempResult(file.file_id, column.id, {
            extracted_value: cellData.value,
            confidence_score: cellData.confidence,
            source_reference: cellData.source ?? '',
            timestamp: cellData.timestamp,
            error: cellData.status === 'error',
          })
        } else if (existingResult) {
          resultsForFile[column.id] = makeTempResult(file.file_id, column.id, {
            extracted_value: existingResult.extracted_value,
            confidence_score: existingResult.confidence_score ?? 0,
            source_reference: existingResult.source_reference ?? '',
            timestamp: new Date(existingResult.created_at).getTime(),
          })
        } else {
          resultsForFile[column.id] = null
        }
      })
      
      const row: ReviewTableRow = {
        file: {
          file_id: file.file_id,
          filename: file.filename,
          file_size: file.file_size,
          status: file.status,
        },
        fileName: file.filename,
        fileStatus: file.status,
        results: resultsForFile,
      }
      return row
    })
  }, [files, columns, getCellData, results, reviewId])

  // Create table columns
  const tableColumns = useMemo(() => {
    if (!columns.length) return []
    
    return createColumns({
      columns: columns as unknown as GlobalReviewColumn[],
      realTimeUpdates: getRealTimeUpdates() as GlobalRealTimeUpdates,
      processingCells: getProcessingCells(),
      onCellClick: (fileId: string, columnId: string, result: GlobalReviewResult) => {
        setSelectedCell({
          reviewId,
          fileId,
          columnId,
          value: result.extracted_value,
          sourceRef: result.source_reference ?? '',
          confidence: result.confidence_score,
        })
      },
      onViewFile: (fileId: string) => {
        setSelectedCell({
          reviewId,
          fileId,
          columnId: '',
          value: null,
          sourceRef: '',
          confidence: null,
        })
      }
    })
  }, [columns, getRealTimeUpdates, getProcessingCells, reviewId])

  // Export functionality
  // const handleExportData = useCallback(() => {
  //   if (onExport) {
  //     onExport()
  //     return
  //   }

  //   try {
  //     const wb = XLSX.utils.book_new()
  //     const exportData: (string | number | null)[][] = []
      
  //     // Headers
  //     const headers = ['Document', ...columns.map(col => col.column_name)]
  //     exportData.push(headers)
      
  //     // Data rows
  //     tableData.forEach(row => {
  //       const exportRow: (string | number | null)[] = [row.fileName]
        
  //       columns.forEach(column => {
  //         const result = row.results[column.id]
  //         let cellValue = result?.extracted_value || ''
          
  //         if (result?.confidence_score && result.confidence_score > 0) {
  //           const confidence = Math.round(result.confidence_score * 100)
  //           cellValue = cellValue ? `${cellValue} (${confidence}%)` : `(${confidence}%)`
  //         }
          
  //         exportRow.push(cellValue)
  //       })
        
  //       exportData.push(exportRow)
  //     })
      
  //     const ws = XLSX.utils.aoa_to_sheet(exportData)
  //     XLSX.utils.book_append_sheet(wb, ws, 'Review Data')
      
  //     // Add metadata sheet
  //     const metaData = [
  //       ['Review Information', ''],
  //       ['Review Name', reviewName],
  //       ['Status', reviewStatus],
  //       ['Total Files', files.length.toString()],
  //       ['Total Columns', columns.length.toString()],
  //       ['Export Date', new Date().toLocaleString()]
  //     ]
      
  //     const metaWs = XLSX.utils.aoa_to_sheet(metaData)
  //     XLSX.utils.book_append_sheet(wb, metaWs, 'Metadata')
      
  //     const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  //     const filename = `${reviewName.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_')}_${timestamp}.xlsx`
      
  //     XLSX.writeFile(wb, filename)
  //   } catch (error) {
  //     console.error('Error exporting to Excel:', error)
  //     alert('Failed to export data to Excel. Please try again.')
  //   }
  // }, [onExport, tableData, columns, reviewName, reviewStatus, files.length])
  
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading review data...</p>
        </div>
      </div>
    )
  }
  
  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg border border-gray-200">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Review</h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }
  
  // Empty state
  if (!files.length || !columns.length) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg border border-gray-200">
        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600">
            {!files.length 
              ? 'Add some documents to get started' 
              : 'Add some columns to begin analysis'
            }
          </p>
        </div>
      </div>
    )
  }
  
  const totalCells = files.length * columns.length
  const cellData = getAllCellData()
  const completedCells = cellData.filter(cell => cell.status === 'completed').length
  const completionPercentage = totalCells > 0 ? (completedCells / totalCells) * 100 : 0

  return (
    <div className="w-full space-y-4">
      {/* Enhanced header with statistics */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <CompletionStats totalCells={totalCells} getAllCellData={getAllCellData} />
      </div>
      
      {/* DataTable Integration */}
      <DataTable
        columns={tableColumns}
        data={tableData}
        reviewName={reviewName}
        reviewStatus={reviewStatus}
        onStartAnalysis={onStartAnalysis}
        onAddColumn={onAddColumn}
        onAddDocuments={onAddDocuments}
        totalFiles={files.length}
        totalColumns={columns.length}
        completionPercentage={completionPercentage}
        reviewColumns={columns.map(col => ({
          id: col.id,
          column_name: col.column_name,
          prompt: col.prompt,
          data_type: col.data_type
        }))}
      />

      {/* Document Viewer Modal */}
      {selectedCell && (
        <DocumentViewer
          selectedCell={selectedCell}
          onClose={() => setSelectedCell(null)}
          isMobile={false}
        />
      )}
    </div>
  )
}
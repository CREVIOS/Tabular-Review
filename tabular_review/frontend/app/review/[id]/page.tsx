// ReviewDetailPage.tsx - file/column addition capabilities
'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Plus, 
  FileText, 
  AlertCircle, 
  CheckCircle, 

  Download
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RealTimeReviewTable from '@/components/review-table/RealTimeReviewtable'
import AddFilesModal from './AddFilesModal'
import AddColumnModal from './AddColumnModal'

interface ToastProps {
  type: 'success' | 'error' | 'info'
  message: string
  onClose: () => void
}

const Toast = ({ type, message, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose])
  
  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: AlertCircle
  }
  
  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  }
  
  const Icon = icons[type]
  
  return (
    <div className={`fixed top-4 right-4 p-4 rounded-lg border shadow-lg z-50 ${colors[type]} max-w-md`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-auto text-lg leading-none">&times;</button>
      </div>
    </div>
  )
}

export default function ReviewDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const reviewId = params.id as string
  
  // State
  const [showAddFilesModal, setShowAddFilesModal] = useState(false)
  const [showAddColumnModal, setShowAddColumnModal] = useState(false)
  const [isAddingColumn, setIsAddingColumn] = useState(false)
  const [toasts, setToasts] = useState<Array<{id: string; type: 'success' | 'error' | 'info'; message: string}>>([])
  
  // Toast management
  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, type, message }])
  }, [])
  
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])
  
  // Handle export with error handling
  const handleExport = useCallback(async () => {
    if (!reviewId) {
      addToast('error', 'No review ID available to export')
      return
    }
    try {
      // Fetch columns
      const { data: columnsData, error: columnsError } = await supabase
        .from('tabular_review_columns')
        .select('*')
        .eq('review_id', reviewId)
        .order('column_order')
      if (columnsError) throw columnsError
      // Fetch files with file details
      const { data: filesData, error: filesError } = await supabase
        .from('tabular_review_files')
        .select(`
          *,
          files (
            original_filename,
            file_size,
            status
          )
        `)
        .eq('review_id', reviewId)
      if (filesError) throw filesError
      // Transform files data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transformedFiles = (filesData || []).map((file: any) => ({
        id: file.id,
        file_id: file.file_id,
        filename: file.files?.original_filename ?? '',
        file_size: file.files?.file_size ?? 0,
        status: file.files?.status ?? '',
        added_at: file.added_at ?? ''
      }))
      // Fetch results
      const { data: resultsData, error: resultsError } = await supabase
        .from('tabular_review_results')
        .select('*')
        .eq('review_id', reviewId)
      if (resultsError) throw resultsError
      // Build a lookup for results
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resultMap = new Map<string, any>()
      resultsData?.forEach(result => {
        resultMap.set(`${result.file_id}:${result.column_id}`, result)
      })
      // Build CSV headers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const headers = ['Document', ...columnsData.map((c: any) => c.column_name)]
      // Build CSV rows
      const rows = transformedFiles.map(file => {
        const row = [file.filename]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        columnsData.forEach((column: any) => {
          const result = resultMap.get(`${file.file_id}:${column.id}`)
          row.push(result?.extracted_value ?? '')
        })
        return row
      })
      // Create CSV
      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')
      // Download
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `review_${reviewId}_${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      addToast('success', 'Data exported successfully!')
    } catch (error) {
      console.error('Export error:', error)
      addToast('error', 'Failed to export data')
    }
  }, [reviewId, supabase, addToast])
  
  // Handle modal close with confirmation if operations are in progress
  const handleCloseAddFilesModal = useCallback(() => {
    setShowAddFilesModal(false)
  }, [])
  
  const handleCloseAddColumnModal = useCallback(() => {
    setShowAddColumnModal(false)
    setIsAddingColumn(false)
  }, [])
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 flex">
      <div className="w-full mx-auto px-4 py-12 sm:px-8">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push('/review')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors shadow-sm border border-gray-200 bg-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Review Analysis
                </h1>
                <p className="text-base text-gray-600 mt-1">
                  Real-time document analysis and data extraction
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
              >
                <Download className="h-4 w-4" />
                Export Data
              </button>
            </div>
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowAddFilesModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <FileText className="h-4 w-4" />
              Add Documents
            </button>
            <button 
              onClick={() => { setShowAddColumnModal(true); setIsAddingColumn(true); }}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              disabled={isAddingColumn}
            >
              <Plus className="h-4 w-4" />
              {isAddingColumn ? 'Adding Column...' : 'Add Column'}
            </button>
          </div>
        </div>
        {/* Real-time table */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-10">
          <RealTimeReviewTable 
            // onExport={handleExport}
            reviewId={reviewId}
          />
        </div>
        {/* Modals */}
        <AddFilesModal
          isOpen={showAddFilesModal}
          onClose={handleCloseAddFilesModal}
          reviewId={reviewId}
          existingFileIds={[]}
        />
        <AddColumnModal
          isOpen={showAddColumnModal}
          onClose={handleCloseAddColumnModal}
          reviewId={reviewId}
          existingColumns={[]}
        />
        {/* Toast notifications */}
        <div className="fixed top-6 right-6 z-50 space-y-3">
          {toasts.map(toast => (
            <Toast
              key={toast.id}
              type={toast.type}
              message={toast.message}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
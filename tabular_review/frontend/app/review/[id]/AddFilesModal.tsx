// AddFilesModal.tsx - File addition modal with comprehensive error handling
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Search, FileText, AlertCircle, CheckCircle, Loader2, Folder } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FileItem {
  id: string
  original_filename: string
  file_size: number
  status: string
  folder_id: string | null
  created_at: string
  folder?: {
    name: string
  }
}

interface AddFilesModalProps {
  isOpen: boolean
  onClose: () => void
  reviewId: string
  existingFileIds: string[]
}

export default function AddFilesModal({ 
  isOpen, 
  onClose, 
  reviewId, 
  existingFileIds 
}: AddFilesModalProps) {
  const [availableFiles, setAvailableFiles] = useState<FileItem[]>([])
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed'>('completed')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const supabase = createClient()
  
  // Fetch available files
  const fetchFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/files?page_size=100')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`)
      }
      
      const data = await response.json()
      setAvailableFiles(data.files || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [])
  
  // Load files when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchFiles()
      setSelectedFileIds([])
      setSearchQuery('')
      setError(null)
    }
  }, [isOpen, fetchFiles])
  
  // Filter available files
  const filteredFiles = useMemo(() => {
    return availableFiles.filter(file => {
      // Exclude files already in review
      if (existingFileIds.includes(file.id)) return false
      
      // Filter by status
      if (filterStatus === 'completed' && file.status !== 'completed') return false
      
      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          file.original_filename.toLowerCase().includes(query) ||
          file.folder?.name?.toLowerCase().includes(query)
        )
      }
      
      return true
    })
  }, [availableFiles, existingFileIds, filterStatus, searchQuery])
  
  // Handle file selection
  const toggleFileSelection = useCallback((fileId: string) => {
    setSelectedFileIds(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    )
  }, [])
  
  const selectAll = useCallback(() => {
    setSelectedFileIds(filteredFiles.map(f => f.id))
  }, [filteredFiles])
  
  const deselectAll = useCallback(() => {
    setSelectedFileIds([])
  }, [])
  
  const handleSubmit = useCallback(async () => {
    if (selectedFileIds.length === 0) return
    setIsSubmitting(true)
    setError(null)
    setSuccessMessage(null)
    try {
      // Get Supabase session and access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required. Please log in again.')
      }
      // Backend URL
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const url = `${backendUrl}/api/reviews/${reviewId}/files`
      // POST to backend API
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ file_ids: selectedFileIds })
      })

      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        console.log(data)
        throw new Error(data.error || data.message || data.detail || 'Failed to add files')
      }
      setSuccessMessage('Files added successfully! Analysis will start automatically.')
      setTimeout(() => {
        setIsSubmitting(false)
        setSuccessMessage(null)
        onClose()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add files')
      setIsSubmitting(false)
    }
  }, [selectedFileIds, reviewId, onClose, supabase])
  
  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Add Documents</h2>
            <p className="text-sm text-gray-600 mt-1">
              Select completed documents to add to your review
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Connection Status Warning */}
        {/* No longer needed as we're not using websockets */}
        
        {/* Progress Indicator */}
        {isSubmitting && (
          <div className="mx-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Adding {selectedFileIds.length} documents...
              </span>
            </div>
          </div>
        )}
        {successMessage && (
          <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-800">{successMessage}</span>
            </div>
          </div>
        )}
        
        {/* Search and Filters */}
        <div className="p-6 border-b bg-gray-50">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'completed')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="completed">Completed Only</option>
              <option value="all">All Documents</option>
            </select>
          </div>
          
          {/* Selection Controls */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-4">
              <button
                onClick={selectAll}
                disabled={filteredFiles.length === 0}
                className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
              >
                Select All ({filteredFiles.length})
              </button>
              <button
                onClick={deselectAll}
                disabled={selectedFileIds.length === 0}
                className="text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-400"
              >
                Deselect All
              </button>
            </div>
            <span className="text-sm text-gray-600">
              {selectedFileIds.length} selected
            </span>
          </div>
        </div>
        
        {/* File List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-600">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="text-sm font-medium">{error}</p>
              <button
                onClick={fetchFiles}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Try Again
              </button>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <FileText className="h-8 w-8 mb-2" />
              <p className="text-sm font-medium">No documents available</p>
              <p className="text-xs text-gray-400 mt-1">
                {searchQuery ? 'Try a different search term' : 'Upload some documents first'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedFileIds.includes(file.id) ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                  onClick={() => toggleFileSelection(file.id)}
                >
                  <div className="flex items-start gap-3 sm:items-center">
                    <input
                      type="checkbox"
                      checked={selectedFileIds.includes(file.id)}
                      onChange={() => toggleFileSelection(file.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5 sm:mt-0 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start sm:items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                        <div className="flex-1 min-w-0">
                          <p 
                            className="font-medium text-gray-900 break-words leading-tight text-sm"
                            title={file.original_filename}
                          >
                            {file.original_filename}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {file.status === 'completed' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <div className="h-4 w-4 bg-yellow-400 rounded-full" />
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="bg-gray-100 px-2 py-1 rounded">
                          {formatFileSize(file.file_size)}
                        </span>
                        <span className={`px-2 py-1 rounded font-medium ${
                          file.status === 'completed' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {file.status}
                        </span>
                        {file.folder && (
                          <div className="flex items-center gap-1 bg-blue-100 px-2 py-1 rounded">
                            <Folder className="h-3 w-3" />
                            <span className="text-blue-700">{file.folder.name}</span>
                          </div>
                        )}
                        <span className="hidden sm:inline">
                          {new Date(file.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 sm:p-6 border-t bg-gray-50 space-y-3">
          {error && !loading && (
            <div className="flex items-center gap-2 text-red-600 justify-center sm:justify-start">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm text-center sm:text-left">{error}</span>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={selectedFileIds.length === 0 || isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                `Add ${selectedFileIds.length} Document${selectedFileIds.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
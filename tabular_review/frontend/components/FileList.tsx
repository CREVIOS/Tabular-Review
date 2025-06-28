import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { 
  Files, 
  Search, 
  Filter, 
  Plus, 
  Folder, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Loader2,
  Sparkles,
  HardDrive,

} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'

interface File {
  id: string
  original_filename: string
  file_size: number
  status: 'queued' | 'processing' | 'completed' | 'failed'
  created_at: string
  folder_id: string | null
}

interface Folder {
  id: string
  name: string
  description: string | null
  color: string
  file_count: number
  total_size: number
}

interface Review {
  id: string
  name: string
  status: string
}

interface FileListProps {
  files: File[]
  selectedFiles: string[]
  searchQuery: string
  selectedReview: Review | null
  onFileSelect: (fileId: string) => void
  onSearchChange: (query: string) => void
  onCreateReview: () => void
  onDragStart: (fileId: string) => void
}

export default function FileList({
  files,
  selectedFiles,
  searchQuery,
  selectedReview,
  onFileSelect,
  onSearchChange,
  onCreateReview,
  onDragStart
}: FileListProps) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [, setLoading] = useState(false)

  useEffect(() => {
    fetchFolders()
  }, [])

  const fetchFolders = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        console.error('No authentication session found')
        return
      }

      const response = await fetch('http://localhost:8000/api/folders/', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setFolders(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error)
    } finally {
      setLoading(false)
    }
  }

  // Memoized filtered files for performance
  const filteredFiles = useMemo(() => {
    let result = files

    // Filter by folder
    if (selectedFolderId === 'uncategorized') {
      result = result.filter(f => !f.folder_id)
    } else if (selectedFolderId) {
      result = result.filter(f => f.folder_id === selectedFolderId)
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(f => f.status === statusFilter)
    }

    // Filter by search query
    if (searchQuery) {
      result = result.filter(f => 
        f.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return result
  }, [files, selectedFolderId, statusFilter, searchQuery])

  const completedFiles = filteredFiles.filter(f => f.status === 'completed')
  const stats = {
    completed: filteredFiles.filter(f => f.status === 'completed').length,
    processing: filteredFiles.filter(f => f.status === 'processing').length,
    failed: filteredFiles.filter(f => f.status === 'failed').length,
    queued: filteredFiles.filter(f => f.status === 'queued').length
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "processing":
        return <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
      case "completed":
        return <CheckCircle className="h-3 w-3 text-green-600" />
      case "failed":
        return <AlertCircle className="h-3 w-3 text-red-600" />
      default:
        return <Clock className="h-3 w-3 text-gray-600" />
    }
  }

  const getFolderInfo = (folderId: string | null) => {
    if (!folderId) return null
    return folders.find(f => f.id === folderId)
  }

  const handleDragStart = (e: React.DragEvent, fileId: string) => {
    e.dataTransfer.setData('text/plain', fileId)
    onDragStart(fileId)
  }

  // Memoized folder selection handlers
  const handleSelectAllFolders = useCallback(() => setSelectedFolderId(null), [])
  const handleSelectUncategorized = useCallback(() => setSelectedFolderId('uncategorized'), [])
  const handleSelectFolder = useCallback((folderId: string) => () => setSelectedFolderId(folderId), [])

  // Memoized handleSelectAll to prevent re-renders
  const handleSelectAll = useCallback(() => {
    const allSelected = completedFiles.every(f => selectedFiles.includes(f.id))
    
    if (allSelected) {
      // Deselect all
      completedFiles.forEach(f => {
        if (selectedFiles.includes(f.id)) {
          onFileSelect(f.id)
        }
      })
    } else {
      // Select all completed files
      completedFiles.forEach(f => {
        if (!selectedFiles.includes(f.id)) {
          onFileSelect(f.id)
        }
      })
    }
  }, [completedFiles, selectedFiles, onFileSelect])

  // Memoized file selection handler
  const handleFileSelect = useCallback((fileId: string) => () => {
    onFileSelect(fileId)
  }, [onFileSelect])

  // Memoized filter handlers to prevent infinite re-renders
  const handleFilterAll = useCallback(() => setStatusFilter('all'), [])
  const handleFilterCompleted = useCallback(() => setStatusFilter('completed'), [])
  const handleFilterProcessing = useCallback(() => setStatusFilter('processing'), [])
  const handleFilterFailed = useCallback(() => setStatusFilter('failed'), [])

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Files className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Documents</h2>
              <p className="text-xs text-gray-500">{files.length} total files</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-9"
          />
        </div>

        {/* Quick Filters */}
        <div className="flex items-center space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Filter className="h-3 w-3 mr-1" />
                {statusFilter === 'all' ? 'All' : statusFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleFilterAll}>
                All Files
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleFilterCompleted}>
                Completed Only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleFilterProcessing}>
                Processing
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleFilterFailed}>
                Failed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {completedFiles.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleSelectAll} className="h-8">
              {completedFiles.every(f => selectedFiles.includes(f.id)) ? 'None' : 'All'}
            </Button>
          )}
        </div>
      </div>

      {/* Folder Navigation */}
      <div className="px-4 py-3 border-b border-gray-200 space-y-2">
        <Button
          variant={selectedFolderId === null ? 'default' : 'outline'}
          size="sm"
          onClick={handleSelectAllFolders}
          className="w-full justify-start h-8"
        >
          <HardDrive className="h-4 w-4 mr-2" />
          All Files
          <Badge variant="outline" className="ml-auto text-xs">
            {files.length}
          </Badge>
        </Button>

        <Button
          variant={selectedFolderId === 'uncategorized' ? 'default' : 'outline'}
          size="sm"
          onClick={handleSelectUncategorized}
          className="w-full justify-start h-8"
        >
          <FileText className="h-4 w-4 mr-2" />
          Uncategorized
          <Badge variant="outline" className="ml-auto text-xs">
            {files.filter(f => !f.folder_id).length}
          </Badge>
        </Button>

        {folders.map(folder => (
          <Button
            key={folder.id}
            variant={selectedFolderId === folder.id ? 'default' : 'outline'}
            size="sm"
            onClick={handleSelectFolder(folder.id)}
            className="w-full justify-start h-8"
          >
            <div 
              className="w-3 h-3 rounded mr-2"
              style={{ backgroundColor: folder.color }}
            />
            <span className="truncate">{folder.name}</span>
            <Badge variant="outline" className="ml-auto text-xs">
              {files.filter(f => f.folder_id === folder.id).length}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Stats Bar */}
      {(selectedFolderId || statusFilter !== 'all' || searchQuery) && (
        <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-600 mb-2">
            Showing {filteredFiles.length} files
          </div>
          <div className="grid grid-cols-4 gap-1 text-xs">
            <div className="text-center">
              <div className="font-medium text-green-600">{stats.completed}</div>
              <div className="text-gray-500">Ready</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-blue-600">{stats.processing}</div>
              <div className="text-gray-500">Processing</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-red-600">{stats.failed}</div>
              <div className="text-gray-500">Failed</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-600">{stats.queued}</div>
              <div className="text-gray-500">Queued</div>
            </div>
          </div>
        </div>
      )}

      {/* Selected Files Info */}
      {selectedFiles.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-200 bg-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {selectedFiles.length} selected
              </span>
            </div>
            <Button
              size="sm"
              onClick={onCreateReview}
              className="bg-blue-600 hover:bg-blue-700 h-8"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Create Review
            </Button>
          </div>
        </div>
      )}

      {/* Files List */}
      <div className="flex-1 overflow-y-auto">
        {filteredFiles.length === 0 ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Files className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="font-medium text-gray-900 mb-1">No files found</h3>
            <p className="text-sm text-gray-500">
              {searchQuery || statusFilter !== 'all' || selectedFolderId
                ? 'Try adjusting your filters'
                : 'Upload files to get started'
              }
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredFiles.map(file => {
              const folderInfo = getFolderInfo(file.folder_id)
              const isSelected = selectedFiles.includes(file.id)
              const isCompleted = file.status === 'completed'
              
              return (
                <Card
                  key={file.id}
                  draggable={isCompleted}
                  onDragStart={(e) => isCompleted && handleDragStart(e, file.id)}
                  className={`transition-all duration-200 cursor-pointer group ${
                    isSelected ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200' : 
                    'hover:shadow-sm hover:border-gray-300'
                  } ${!isCompleted ? 'opacity-60' : ''} ${
                    isCompleted ? 'hover:scale-[1.02]' : ''
                  }`}
                  onClick={isCompleted ? handleFileSelect(file.id) : undefined}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center space-x-3">
                      {/* File Icon */}
                      <div className="flex-shrink-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-blue-100' : 'bg-gray-100 group-hover:bg-blue-100'
                        }`}>
                          <FileText className={`h-4 w-4 ${
                            isSelected ? 'text-blue-600' : 'text-gray-600 group-hover:text-blue-600'
                          }`} />
                        </div>
                      </div>

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate" title={file.original_filename}>
                          {file.original_filename}
                        </div>
                        
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {formatFileSize(file.file_size)}
                          </span>
                          
                          {folderInfo && (
                            <>
                              <span className="text-xs text-gray-400">•</span>
                              <div className="flex items-center space-x-1">
                                <div 
                                  className="w-2 h-2 rounded"
                                  style={{ backgroundColor: folderInfo.color }}
                                />
                                <span className="text-xs text-gray-500 truncate max-w-20">
                                  {folderInfo.name}
                                </span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Status */}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(file.status)}
                            <span className="text-xs text-gray-600 capitalize">
                              {file.status}
                            </span>
                          </div>
                          
                          {isSelected && (
                            <CheckCircle className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Drag Hint */}
                    {isCompleted && selectedReview && (
                      <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                        <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
                          Drag to add to review
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      {selectedFiles.length === 0 && completedFiles.length > 0 && (
        <div className="p-4 border-t border-gray-200">
          <Button
            onClick={onCreateReview}
            className="w-full bg-green-600 hover:bg-green-700 h-10"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Review
          </Button>
          <p className="text-xs text-gray-500 text-center mt-2">
            Select files above, or create review without selection
          </p>
        </div>
      )}
    </div>
  )
}
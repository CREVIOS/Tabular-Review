import React, { useState, useEffect } from 'react'
import { 
  ArrowLeft,
  Files,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Search,
  Filter,
  Download,
  Trash2,
  FileText,
  Plus,
  Sparkles,
  FolderOpen,
  Grid3x3,
  List,
  MoreVertical,
  Table
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface File {
  id: string
  original_filename: string
  file_size: number
  status: 'queued' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
  folder_id: string | null
}

interface Folder {
  id: string
  name: string
  description: string | null
  color: string
  file_count: number
  total_size: number
  created_at: string
  updated_at: string
}

interface FolderDetailViewProps {
  folder: Folder
  onBack: () => void
  onCreateReview: (folderId: string, selectedFiles?: string[]) => void
  onViewReviews?: (folderId: string) => void
}

export default function FolderDetailView({ folder, onBack, onCreateReview, onViewReviews }: FolderDetailViewProps) {
  const [files, setFiles] = useState<File[]>([])
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  useEffect(() => {
    fetchFolderFiles()
  }, [folder.id])

  const fetchFolderFiles = async () => {
    try {
      setLoading(true)
      setError(null)

      const token = localStorage.getItem('auth_token')
      if (!token) {
        setError('Authentication required')
        return
      }

      const response = await fetch(`http://localhost:8000/api/files/?folder_id=${folder.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setFiles(Array.isArray(data) ? data : [])
    } catch (error: any) {
      console.error('Failed to fetch folder files:', error)
      setError(error.message || 'Failed to fetch files')
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "queued":
        return "text-gray-600 bg-gray-100 border-gray-200"
      case "processing":
        return "text-blue-600 bg-blue-100 border-blue-200"
      case "completed":
        return "text-green-600 bg-green-100 border-green-200"
      case "failed":
        return "text-red-600 bg-red-100 border-red-200"
      default:
        return "text-gray-600 bg-gray-100 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "processing":
        return <Loader2 className="h-3 w-3 animate-spin" />
      case "completed":
        return <CheckCircle className="h-3 w-3" />
      case "failed":
        return <AlertCircle className="h-3 w-3" />
      default:
        return <Clock className="h-3 w-3" />
    }
  }

  const handleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    )
  }

  const handleSelectAll = () => {
    const completedFiles = filteredFiles.filter(f => f.status === 'completed')
    if (selectedFiles.length === completedFiles.length) {
      setSelectedFiles([])
    } else {
      setSelectedFiles(completedFiles.map(f => f.id))
    }
  }

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || file.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const fileStats = {
    total: files.length,
    completed: files.filter(f => f.status === 'completed').length,
    processing: files.filter(f => f.status === 'processing').length,
    failed: files.filter(f => f.status === 'failed').length,
    queued: files.filter(f => f.status === 'queued').length
  }

  const completedFiles = files.filter(f => f.status === 'completed')
  const canCreateReview = completedFiles.length > 0

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-gray-200 rounded"></div>
            <div className="h-6 bg-gray-200 rounded w-48"></div>
          </div>
          <div className="h-4 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 sm:h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Button variant="ghost" size="sm" onClick={onBack} className="touch-target">
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Back to Folders</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <div 
            className="p-2 rounded-lg flex-shrink-0"
            style={{ backgroundColor: `${folder.color}20` }}
          >
            <FolderOpen className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: folder.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{folder.name}</h2>
            {folder.description && (
              <p className="text-sm sm:text-base text-gray-600 line-clamp-2">{folder.description}</p>
            )}
          </div>
        </div>

        {/* View Mode Toggle - Mobile friendly */}
        <div className="flex items-center gap-1 border rounded-lg self-end sm:self-auto">
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="touch-target"
          >
            <List className="h-4 w-4" />
            <span className="ml-1 sm:hidden">List</span>
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="touch-target"
          >
            <Grid3x3 className="h-4 w-4" />
            <span className="ml-1 sm:hidden">Grid</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards - Mobile Responsive Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4">
        <Card className="border-l-4 border-l-gray-500">
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-lg sm:text-2xl font-bold text-gray-900">{fileStats.total}</div>
            <div className="text-xs sm:text-sm text-gray-600">Total</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-lg sm:text-2xl font-bold text-green-600">{fileStats.completed}</div>
            <div className="text-xs sm:text-sm text-gray-600">Done</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-lg sm:text-2xl font-bold text-blue-600">{fileStats.processing}</div>
            <div className="text-xs sm:text-sm text-gray-600">Processing</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-lg sm:text-2xl font-bold text-yellow-600">{fileStats.queued}</div>
            <div className="text-xs sm:text-sm text-gray-600">Queued</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-lg sm:text-2xl font-bold text-red-600">{fileStats.failed}</div>
            <div className="text-xs sm:text-sm text-gray-600">Failed</div>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar - Mobile Responsive */}
      <div className="bg-white p-3 sm:p-4 rounded-lg border space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 touch-target"
            />
          </div>
          
          {/* Filters and Select All */}
          <div className="flex gap-2 sm:gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="touch-target text-sm">
                  <Filter className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Status: </span>
                  {statusFilter === 'all' ? 'All' : statusFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                  All Status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('completed')}>
                  Completed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('processing')}>
                  Processing
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('failed')}>
                  Failed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('queued')}>
                  Queued
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {filteredFiles.filter(f => f.status === 'completed').length > 0 && (
              <Button variant="outline" onClick={handleSelectAll} className="touch-target text-sm">
                <span className="hidden sm:inline">
                  {selectedFiles.length === completedFiles.length ? 'Deselect All' : 'Select All'}
                </span>
                <span className="sm:hidden">
                  {selectedFiles.length === completedFiles.length ? 'None' : 'All'}
                </span>
              </Button>
            )}
          </div>
        </div>

        {/* Action Buttons - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {onViewReviews && (
            <Button
              variant="outline"
              onClick={() => onViewReviews(folder.id)}
              className="border-gray-300 hover:bg-gray-50 touch-target text-sm"
            >
              <Table className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">View Reviews</span>
              <span className="sm:hidden">Reviews</span>
            </Button>
          )}
          
          <Button
            onClick={() => onCreateReview(folder.id)}
            disabled={!canCreateReview}
            className="bg-blue-600 hover:bg-blue-700 touch-target text-sm"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Create Review (Entire Folder)</span>
            <span className="sm:hidden">Create Review (All)</span>
          </Button>
          
          {selectedFiles.length > 0 && (
            <Button
              onClick={() => onCreateReview(folder.id, selectedFiles)}
              className="bg-green-600 hover:bg-green-700 touch-target text-sm"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Create Review ({selectedFiles.length} files)</span>
              <span className="sm:hidden">Review ({selectedFiles.length})</span>
            </Button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Selected Files Info */}
      {selectedFiles.length > 0 && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected for tabular review creation
          </AlertDescription>
        </Alert>
      )}

      {/* Files List/Grid - Mobile Responsive */}
      {filteredFiles.length === 0 ? (
        <div className="text-center py-8 sm:py-12 px-4">
          <div className="w-16 h-16 sm:w-24 sm:h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Files className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
            {searchQuery || statusFilter !== 'all' ? 'No files found' : 'No files in this folder'}
          </h3>
          <p className="text-sm sm:text-base text-gray-600">
            {searchQuery || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria' 
              : 'Upload files to this folder to get started'
            }
          </p>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4'
          : 'space-y-2 sm:space-y-3'
        }>
          {filteredFiles.map(file => (
            <Card
              key={file.id}
              className={`transition-all duration-200 hover:shadow-md cursor-pointer ${
                selectedFiles.includes(file.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              } ${file.status !== 'completed' ? 'opacity-60' : ''}`}
              onClick={() => file.status === 'completed' && handleFileSelection(file.id)}
            >
              <CardContent className={viewMode === 'grid' ? 'p-3 sm:p-4' : 'p-3'}>
                <div className={`flex items-center ${
                  viewMode === 'grid' ? 'flex-col text-center' : 'justify-between'
                }`}>
                  <div className={`flex items-center gap-2 sm:gap-3 ${
                    viewMode === 'grid' ? 'flex-col' : 'min-w-0 flex-1'
                  }`}>
                    <div className={`flex-shrink-0 ${viewMode === 'grid' ? 'mb-2' : ''}`}>
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                      </div>
                    </div>
                    
                    <div className={`min-w-0 ${viewMode === 'grid' ? 'text-center' : 'flex-1'}`}>
                      <div className={`font-medium text-gray-900 ${
                        viewMode === 'grid' ? 'text-xs sm:text-sm' : 'text-sm'
                      } truncate`} title={file.original_filename}>
                        {file.original_filename}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500">
                        {formatFileSize(file.file_size)}
                      </div>
                    </div>
                  </div>

                  <div className={`flex items-center gap-2 ${viewMode === 'grid' ? 'mt-2' : ''}`}>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${getStatusColor(file.status)}`}>
                      {getStatusIcon(file.status)}
                      <span className="capitalize hidden sm:inline">{file.status}</span>
                    </div>
                    
                    {selectedFiles.includes(file.id) && (
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!canCreateReview && files.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            No completed files available for tabular review. Files must be processed before they can be used in reviews.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
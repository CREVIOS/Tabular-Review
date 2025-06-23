"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  FolderOpen, 
  Plus, 
  Upload, 
  Sparkles, 
  Grid3x3,
  List,
  Search,
  RefreshCw,
  FileText,
  Eye
} from 'lucide-react'
import { auth } from '@/lib/api'
import { fetchDocumentsData, formatFileSize } from '@/lib/documents-api'
import type { Folder } from '@/types/documents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

// Components
import FolderDetailView from '@/components/FolderWithDetailView'
import { FileUpload } from '@/components/documents/file-upload'

const folderColors = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
]

export default function FolderManagementPage() {
  const router = useRouter()
  
  // State
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  
  // Create folder modal state
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [showUploadToFolder, setShowUploadToFolder] = useState(false)
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null)
  const [newFolderData, setNewFolderData] = useState({
    name: '',
    description: '',
    color: folderColors[0]
  })

  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      const authenticated = auth.isAuthenticated()
      setIsAuthenticated(authenticated)
      
      if (!authenticated) {
        router.push('/login')
        return
      }
      
      fetchFolders()
    }
    
    checkAuth()
  }, [router])

  const fetchFolders = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Use the new optimized API endpoint
      const documentsData = await fetchDocumentsData()
      setFolders(documentsData.folders)
      
    } catch (error: unknown) {
      console.error('Failed to fetch folders:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch folders'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const createFolder = async () => {
    try {
      if (!newFolderData.name.trim()) {
        setError('Folder name is required')
        return
      }

      const token = localStorage.getItem('auth_token')
      if (!token) {
        setError('Authentication required')
        return
      }

      const response = await fetch('http://localhost:8000/api/folders/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newFolderData.name.trim(),
          description: newFolderData.description.trim() || null,
          color: newFolderData.color
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      const newFolder = await response.json()
      setFolders(prev => [newFolder, ...prev])
      setShowCreateFolder(false)
      setNewFolderData({ name: '', description: '', color: folderColors[0] })
      setError(null)
    } catch (error: unknown) {
      console.error('Failed to create folder:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create folder'
      setError(errorMessage)
    }
  }

  const handleFolderSelect = (folder: Folder) => {
    setSelectedFolder(folder)
  }

  const handleCreateReview = (folderId: string, selectedFiles?: string[]) => {
    // Navigate to the review page and pass the folder context
    const params = new URLSearchParams()
    params.set('folderId', folderId)
    if (selectedFiles && selectedFiles.length > 0) {
      params.set('fileIds', selectedFiles.join(','))
    }
    router.push(`/review?${params.toString()}`)
  }

  const handleUploadToFolder = (folderId: string) => {
    if (!folderId) {
      console.error('No folder ID provided for upload')
      setError('Invalid folder selected for upload')
      return
    }
    
    console.log('Setting upload folder ID:', folderId)
    setUploadFolderId(folderId)
    setShowUploadToFolder(true)
  }

  const handleUploadSuccess = () => {
    setShowUploadToFolder(false)
    setUploadFolderId(null)
    fetchFolders() // Refresh to update file counts
  }

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (folder.description && folder.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="flex items-center justify-center h-[80vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Checking authentication...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Redirect if not authenticated (this will only run client-side)
  if (isAuthenticated === false) {
    return null // Return empty since we're redirecting in the useEffect
  }

  if (selectedFolder) {
    return (
      <FolderDetailView
        folder={selectedFolder}
        onBack={() => setSelectedFolder(null)}
        onCreateReview={handleCreateReview}
        onViewReviews={(folderId) => router.push(`/review?folderId=${folderId}`)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header - Responsive */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
              <FolderOpen className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
              Folder Management
            </h1>
          </div>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto mb-6 sm:mb-8 px-4">
            Organize your documents into folders and create AI-powered reviews
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 sm:mb-6">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Action Bar - Mobile Responsive */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
            {/* Search and View Toggle - Mobile: Stacked, Desktop: Side by side */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 sm:max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 touch-target"
                />
              </div>
              
              {/* View Mode Toggle - Mobile friendly */}
              <div className="flex items-center gap-1 border rounded-lg self-start sm:self-auto">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="touch-target"
                >
                  <Grid3x3 className="h-4 w-4" />
                  <span className="ml-1 sm:hidden">Grid</span>
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="touch-target"
                >
                  <List className="h-4 w-4" />
                  <span className="ml-1 sm:hidden">List</span>
                </Button>
              </div>
            </div>

            {/* Actions - Mobile: Full width buttons, Desktop: Inline */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <Button 
                onClick={fetchFolders} 
                variant="outline" 
                disabled={loading}
                className="touch-target"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 touch-target">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Folder
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-md mx-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Folder</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Folder Name *
                      </label>
                      <Input
                        placeholder="e.g., Contracts, Invoices, Reports"
                        value={newFolderData.name}
                        onChange={(e) => setNewFolderData(prev => ({ ...prev, name: e.target.value }))}
                        className="touch-target"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description (Optional)
                      </label>
                      <Textarea
                        placeholder="Brief description of this folder's purpose..."
                        value={newFolderData.description}
                        onChange={(e) => setNewFolderData(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        className="touch-target"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Color
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {folderColors.map(color => (
                          <button
                            key={color}
                            onClick={() => setNewFolderData(prev => ({ ...prev, color }))}
                            className={`w-10 h-10 rounded-lg transition-all touch-target ${
                              newFolderData.color === color ? 'ring-2 ring-gray-400 ring-offset-2' : ''
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                      <Button onClick={createFolder} className="flex-1 touch-target">
                        Create Folder
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setShowCreateFolder(false)}
                        className="flex-1 touch-target"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Folders Grid/List - Responsive */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Loading folders...</p>
            </div>
          </div>
        ) : filteredFolders.length === 0 ? (
          <div className="text-center py-12 sm:py-16 px-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <FolderOpen className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-4">
              {searchQuery ? 'No folders found' : 'No folders yet'}
            </h3>
            <p className="text-gray-600 mb-6 sm:mb-8 max-w-md mx-auto">
              {searchQuery 
                ? 'Try adjusting your search criteria' 
                : 'Create your first folder to organize documents and start building tabular reviews.'
              }
            </p>
            {!searchQuery && (
              <Button 
                onClick={() => setShowCreateFolder(true)} 
                className="bg-blue-600 hover:bg-blue-700 touch-target"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Folder
              </Button>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6'
            : 'space-y-3 sm:space-y-4'
          }>
            {filteredFolders.map(folder => (
              <Card
                key={folder.id}
                className={`transition-all duration-200 hover:shadow-lg cursor-pointer group ${
                  viewMode === 'list' ? 'flex items-center' : ''
                }`}
              >
                <CardContent className={`p-4 sm:p-6 ${viewMode === 'list' ? 'flex items-center w-full' : ''}`}>
                  <div className={`flex items-center gap-3 sm:gap-4 ${
                    viewMode === 'list' ? 'flex-1' : 'flex-col text-center'
                  }`}>
                    {/* Folder Icon */}
                    <div 
                      className={`p-3 sm:p-4 rounded-xl ${viewMode === 'grid' ? 'mb-3 sm:mb-4' : ''}`}
                      style={{ backgroundColor: `${folder.color}20` }}
                    >
                      <FolderOpen 
                        className={`h-6 w-6 sm:h-8 sm:w-8 ${viewMode === 'list' ? 'sm:h-6 sm:w-6' : ''}`}
                        style={{ color: folder.color }} 
                      />
                    </div>
                    
                    {/* Folder Info */}
                    <div className={`min-w-0 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                      <h3 className={`font-bold text-gray-900 group-hover:text-blue-700 transition-colors ${
                        viewMode === 'grid' ? 'text-base sm:text-lg mb-2' : 'text-sm sm:text-base mb-1'
                      }`}>
                        {folder.name}
                      </h3>
                      
                      {folder.description && (
                        <p className={`text-gray-600 ${
                          viewMode === 'grid' 
                            ? 'text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2' 
                            : 'text-xs sm:text-sm mb-2 line-clamp-1'
                        }`}>
                          {folder.description}
                        </p>
                      )}
                      
                      <div className={`flex ${
                        viewMode === 'grid' ? 'justify-center' : 'justify-start'
                      } gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4`}>
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span>{folder.file_count} files</span>
                        </div>
                        <div>
                          {formatFileSize(folder.total_size)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions - Mobile friendly */}
                    <div className={`flex gap-1 sm:gap-2 ${
                      viewMode === 'grid' 
                        ? 'justify-center w-full flex-wrap' 
                        : 'flex-col sm:flex-row'
                    }`}>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleFolderSelect(folder)
                        }}
                        className="bg-blue-600 hover:bg-blue-700 touch-target text-xs flex-1 sm:flex-initial"
                      >
                        <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span className="hidden sm:inline">View</span>
                        <span className="sm:hidden">View</span>
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUploadToFolder(folder.id)
                        }}
                        className="touch-target text-xs flex-1 sm:flex-initial"
                      >
                        <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span className="hidden sm:inline">Upload</span>
                        <span className="sm:hidden">Upload</span>
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCreateReview(folder.id)
                        }}
                        className="touch-target text-xs flex-1 sm:flex-initial"
                      >
                        <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span className="hidden sm:inline">Review</span>
                        <span className="sm:hidden">Review</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Upload to Folder Modal */}
        <Dialog open={showUploadToFolder} onOpenChange={setShowUploadToFolder}>
          <DialogContent className="w-[95vw] max-w-4xl mx-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Upload Files to {folders.find(f => f.id === uploadFolderId)?.name || 'Folder'}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              {uploadFolderId && (
                <FileUpload 
                  onUploadSuccess={handleUploadSuccess}
                  folderId={uploadFolderId}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
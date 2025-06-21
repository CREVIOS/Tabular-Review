import React, { useState, useEffect } from 'react'
import { 
  Folder, 
  Plus, 
  Files, 
  Edit3, 
  Trash2, 
  Upload, 
  MoreVertical,
  FolderOpen,
  HardDrive,
  Search
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription } from '@/components/ui/alert'

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

interface FolderDashboardProps {
  onFolderSelect: (folderId: string | null) => void
  selectedFolderId: string | null
}

export default function FolderDashboard({ onFolderSelect, selectedFolderId }: FolderDashboardProps) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Create folder state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderDescription, setNewFolderDescription] = useState('')
  const [newFolderColor, setNewFolderColor] = useState('#3b82f6')
  const [isCreating, setIsCreating] = useState(false)
  
  // Edit folder state
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  // Color options for folders
  const colorOptions = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // yellow
    '#ef4444', // red
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#ec4899', // pink
    '#6b7280'  // gray
  ]

  useEffect(() => {
    fetchFolders()
  }, [])

  const fetchFolders = async () => {
    try {
      setLoading(true)
      setError(null)

      const token = localStorage.getItem('auth_token')
      if (!token) {
        setError('Authentication required')
        return
      }

      const response = await fetch('http://localhost:8000/api/folders/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setFolders(data)
    } catch (error: any) {
      console.error('Failed to fetch folders:', error)
      setError(error.message || 'Failed to fetch folders')
    } finally {
      setLoading(false)
    }
  }

  const createFolder = async () => {
    if (!newFolderName.trim()) return

    try {
      setIsCreating(true)
      const token = localStorage.getItem('auth_token')

      const response = await fetch('http://localhost:8000/api/folders/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newFolderName.trim(),
          description: newFolderDescription.trim() || null,
          color: newFolderColor
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to create folder')
      }

      const newFolder = await response.json()
      setFolders(prev => [...prev, newFolder])
      
      // Reset form
      setNewFolderName('')
      setNewFolderDescription('')
      setNewFolderColor('#3b82f6')
      setIsCreateDialogOpen(false)
      
    } catch (error: any) {
      setError(error.message || 'Failed to create folder')
    } finally {
      setIsCreating(false)
    }
  }

  const updateFolder = async () => {
    if (!editingFolder) return

    try {
      setIsUpdating(true)
      const token = localStorage.getItem('auth_token')

      const response = await fetch(`http://localhost:8000/api/folders/${editingFolder.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editingFolder.name,
          description: editingFolder.description,
          color: editingFolder.color
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to update folder')
      }

      const updatedFolder = await response.json()
      setFolders(prev => prev.map(f => f.id === updatedFolder.id ? updatedFolder : f))
      
      setEditingFolder(null)
      setIsEditDialogOpen(false)
      
    } catch (error: any) {
      setError(error.message || 'Failed to update folder')
    } finally {
      setIsUpdating(false)
    }
  }

  const deleteFolder = async (folderId: string) => {
    if (!confirm('Are you sure you want to delete this folder? Files will be moved to uncategorized.')) {
      return
    }

    try {
      const token = localStorage.getItem('auth_token')

      const response = await fetch(`http://localhost:8000/api/folders/${folderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to delete folder')
      }

      setFolders(prev => prev.filter(f => f.id !== folderId))
      
      // If this was the selected folder, deselect it
      if (selectedFolderId === folderId) {
        onFolderSelect(null)
      }
      
    } catch (error: any) {
      setError(error.message || 'Failed to delete folder')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (folder.description && folder.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Folder className="h-6 w-6 text-blue-600" />
            Folders
          </h2>
          <p className="text-gray-600">Organize your documents into folders</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
              <DialogDescription>
                Create a new folder to organize your documents
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Folder Name</label>
                <Input
                  placeholder="Enter folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Description (Optional)</label>
                <Input
                  placeholder="Enter folder description"
                  value={newFolderDescription}
                  onChange={(e) => setNewFolderDescription(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Color</label>
                <div className="flex gap-2 mt-2">
                  {colorOptions.map(color => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 ${
                        newFolderColor === color ? 'border-gray-900' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewFolderColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createFolder} disabled={isCreating || !newFolderName.trim()}>
                {isCreating ? 'Creating...' : 'Create Folder'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search folders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Uncategorized Files Card */}
      <Card
        className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
          selectedFolderId === null ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
        }`}
        onClick={() => onFolderSelect(null)}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <HardDrive className="h-6 w-6 text-gray-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Uncategorized</h3>
              <p className="text-sm text-gray-500">Files not in any folder</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-gray-900">All Files</div>
              <div className="text-xs text-gray-500">View all documents</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Folders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredFolders.map(folder => (
          <Card
            key={folder.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              selectedFolderId === folder.id ? 'ring-2 ring-blue-500' : 'hover:scale-105'
            }`}
            style={{ backgroundColor: selectedFolderId === folder.id ? `${folder.color}10` : undefined }}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${folder.color}20` }}
                  onClick={() => onFolderSelect(folder.id)}
                >
                  <FolderOpen 
                    className="h-6 w-6" 
                    style={{ color: folder.color }} 
                  />
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      setEditingFolder(folder)
                      setIsEditDialogOpen(true)
                    }}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => deleteFolder(folder.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div onClick={() => onFolderSelect(folder.id)}>
                <h3 className="font-semibold text-gray-900 mb-1 truncate">
                  {folder.name}
                </h3>
                {folder.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                    {folder.description}
                  </p>
                )}
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-gray-600">
                    <Files className="h-4 w-4" />
                    <span>{folder.file_count} files</span>
                  </div>
                  <div className="text-gray-500">
                    {formatFileSize(folder.total_size)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Folder Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Folder</DialogTitle>
            <DialogDescription>
              Update folder name, description, and color
            </DialogDescription>
          </DialogHeader>
          {editingFolder && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Folder Name</label>
                <Input
                  placeholder="Enter folder name"
                  value={editingFolder.name}
                  onChange={(e) => setEditingFolder(prev => prev ? {...prev, name: e.target.value} : null)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <Input
                  placeholder="Enter folder description"
                  value={editingFolder.description || ''}
                  onChange={(e) => setEditingFolder(prev => prev ? {...prev, description: e.target.value} : null)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Color</label>
                <div className="flex gap-2 mt-2">
                  {colorOptions.map(color => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 ${
                        editingFolder.color === color ? 'border-gray-900' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setEditingFolder(prev => prev ? {...prev, color} : null)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateFolder} disabled={isUpdating || !editingFolder?.name.trim()}>
              {isUpdating ? 'Updating...' : 'Update Folder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Empty State */}
      {filteredFolders.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Folder className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchQuery ? 'No folders found' : 'No folders yet'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchQuery 
              ? 'Try adjusting your search terms' 
              : 'Create your first folder to organize your documents'
            }
          </p>
          {!searchQuery && (
            <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Create First Folder
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
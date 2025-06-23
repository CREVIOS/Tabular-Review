import React, { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { IconCloudUpload, IconX } from '@tabler/icons-react'
import { Folder, Files } from 'lucide-react'

interface Folder {
  id: string
  name: string
  description: string | null
  color: string
  file_count: number
  total_size: number
}

interface FileUploadWithFoldersProps {
  onUploadSuccess: () => void
  selectedFolderId?: string | null
  onFolderChange?: (folderId: string | null) => void
}

export default function FileUploadWithFolders({ 
  onUploadSuccess, 
  selectedFolderId, 
  onFolderChange 
}: FileUploadWithFoldersProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [loadingFolders, setLoadingFolders] = useState(true)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(selectedFolderId || null)
  const [error, setError] = useState<string | null>(null)

  // Fetch folders on component mount
  useEffect(() => {
    fetchFolders()
  }, [])

  // Update currentFolderId when selectedFolderId prop changes
  useEffect(() => {
    setCurrentFolderId(selectedFolderId || null)
  }, [selectedFolderId])

  const fetchFolders = async () => {
    try {
      setLoadingFolders(true)
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
    } catch (error: Error | unknown) {
      console.error('Failed to fetch folders:', error)
      setError('Failed to load folders')
    } finally {
      setLoadingFolders(false)
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Filter files based on allowed types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    
    const validFiles = acceptedFiles.filter(file => {
      if (allowedTypes.includes(file.type)) {
        return true
      }
      
      // Additional check by extension for files with incorrect MIME types
      const extension = '.' + file.name.split('.').pop()?.toLowerCase()
      const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx']
      return allowedExtensions.includes(extension)
    })
    
    setSelectedFiles(prev => [...prev, ...validFiles])
    
    // Show warning for rejected files
    const rejectedCount = acceptedFiles.length - validFiles.length
    if (rejectedCount > 0) {
      setError(`${rejectedCount} file(s) were rejected. Please upload PDF, Word, Excel, or text files only.`)
    } else {
      setError(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxSize: 50 * 1024 * 1024, // 50MB limit
    multiple: true
  })

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index))
  }

  const handleFolderChange = (folderId: string | null) => {
    setCurrentFolderId(folderId)
    onFolderChange?.(folderId)
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    setUploading(true)
    setError(null)
    
    try {
      console.log('Starting upload:', selectedFiles.map(f => ({ name: f.name, type: f.type, size: f.size })))
      console.log('Target folder:', currentFolderId)
      
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('Authentication token not found')
      }

      // Create FormData and append files
      const formData = new FormData()
      selectedFiles.forEach(file => {
        formData.append('files', file)
      })
      
      // Add folder_id if selected
      if (currentFolderId) {
        formData.append('folder_id', currentFolderId)
      }

      const response = await fetch('http://localhost:8000/api/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Don't set Content-Type header - let browser set it with boundary for FormData
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log('Upload successful:', result)
      
      setSelectedFiles([])
      onUploadSuccess()
      
    } catch (error: unknown) {
      console.error('Upload failed:', error)
      setError(error instanceof Error ? error.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getSelectedFolderName = () => {
    if (!currentFolderId) return 'Uncategorized'
    const folder = folders.find(f => f.id === currentFolderId)
    return folder?.name || 'Unknown Folder'
  }

  return (
    <div className="space-y-6">
      {/* Folder Selection */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Select Destination</h3>
            </div>
            
            {loadingFolders ? (
              <div className="animate-pulse">
                <div className="h-10 bg-gray-200 rounded-md"></div>
              </div>
            ) : (
              <Select
                value={currentFolderId || 'uncategorized'}
                onValueChange={(value) => handleFolderChange(value === 'uncategorized' ? null : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a folder">
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4" />
                      <span>{getSelectedFolderName()}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncategorized">
                    <div className="flex items-center gap-2">
                      <Files className="h-4 w-4 text-gray-500" />
                      <span>Uncategorized</span>
                    </div>
                  </SelectItem>
                  {folders.map(folder => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: folder.color }}
                        />
                        <span>{folder.name}</span>
                        <span className="text-xs text-gray-500">({folder.file_count} files)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <div className="text-sm text-gray-600">
              Files will be uploaded to: <span className="font-semibold">{getSelectedFolderName()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Upload Area */}
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            <IconCloudUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            {isDragActive ? (
              <div>
                <p className="text-lg font-medium text-blue-600">Drop the files here...</p>
                <p className="text-sm text-blue-500 mt-1">
                  Files will be added to {getSelectedFolderName()}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-lg font-medium text-gray-700">Drop files here or click to browse</p>
                <p className="text-sm text-gray-500 mt-1">
                  Support for PDF, Word, Excel, and text files (max 50MB each)
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Files will be uploaded to: {getSelectedFolderName()}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">
                  Selected Files ({selectedFiles.length})
                </h3>
                <div className="text-sm text-gray-500">
                  Destination: <span className="font-semibold">{getSelectedFolderName()}</span>
                </div>
              </div>
              
              <div className="space-y-3">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Files className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <div className="text-xs text-gray-500">
                          {file.type || 'Unknown type'} • {formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <IconX className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Uploading to {getSelectedFolderName()}...
                    </>
                  ) : (
                    <>
                      <IconCloudUpload className="h-4 w-4 mr-2" />
                      Upload {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} to {getSelectedFolderName()}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Quick Stats */}
      {selectedFiles.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          Total size: {formatFileSize(selectedFiles.reduce((sum, file) => sum + file.size, 0))} • 
          Uploading to: <span className="font-semibold">{getSelectedFolderName()}</span>
        </div>
      )}
    </div>
  )
}
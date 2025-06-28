"use client"
import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
// import { files } from '@/lib/api'
import { 
  IconCloudUpload, 
  IconX, 
  IconAlertCircle, 
  IconFiles, 
  IconFolder,
  IconCheck,
  IconExclamationMark,
  IconLoader2
} from '@tabler/icons-react'

interface FileWithStatus {
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  id: string
}

interface FileUploadProps {
  onUploadSuccess: () => void
  folderId?: string | null
}

// Maximum concurrent uploads
const MAX_CONCURRENT_UPLOADS = 10

export function FileUpload({ onUploadSuccess, folderId }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileWithStatus[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Generate unique ID for each file
  const generateFileId = () => Math.random().toString(36).substr(2, 9)

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
    
    // Convert to FileWithStatus objects
    const newFiles: FileWithStatus[] = validFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0,
      id: generateFileId()
    }))
    
    setSelectedFiles(prev => [...prev, ...newFiles])
    
    // Show warning for rejected files
    const rejectedCount = acceptedFiles.length - validFiles.length
    if (rejectedCount > 0) {
      setError(`${rejectedCount} file(s) were rejected. Please upload PDF, Word, Excel, or text files only.`)
      setTimeout(() => setError(null), 5000)
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

  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFolderSelect = () => {
    if (folderInputRef.current) {
      folderInputRef.current.click()
    }
  }

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) {
      onDrop(files)
    }
    event.target.value = ''
  }

  const handleFolderInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) {
      onDrop(files)
    }
    event.target.value = ''
  }

  const removeFile = (id: string) => {
    setSelectedFiles(files => files.filter(f => f.id !== id))
  }

  const updateFileStatus = (id: string, updates: Partial<FileWithStatus>) => {
    setSelectedFiles(prev => prev.map(f => 
      f.id === id ? { ...f, ...updates } : f
    ))
  }

  // Upload a single file with progress simulation
  const uploadSingleFile = async (fileWithStatus: FileWithStatus): Promise<void> => {
    const { file, id } = fileWithStatus
    
    try {
      updateFileStatus(id, { status: 'uploading', progress: 0 })
      
      // Create FormData for single file upload
      const formData = new FormData()
      formData.append('files', file)
      if (folderId) {
        formData.append('folder_id', folderId)
      }

      // Simulate progress for better UX (since fetch doesn't provide upload progress)
      const progressInterval = setInterval(() => {
        setSelectedFiles(prev => prev.map(f => 
          f.id === id 
            ? { ...f, progress: Math.min(f.progress + Math.random() * 15, 85) }
            : f
        ))
      }, 200)

      try {
        // Use fetch to work with our middleware
        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
          // Let Next.js middleware handle authentication
        })

        clearInterval(progressInterval)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Upload failed' }))
          const errorMsg = errorData.error || `Upload failed (${response.status})`
          updateFileStatus(id, { status: 'error', error: errorMsg })
          throw new Error(errorMsg)
        }

        const result = await response.json()
        updateFileStatus(id, { status: 'success', progress: 100 })
        console.log(`Successfully uploaded ${file.name}:`, result)
        
      } catch (fetchError) {
        clearInterval(progressInterval)
        throw fetchError
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Upload failed'
      updateFileStatus(id, { status: 'error', error: errorMsg })
      throw error
    }
  }

  // Handle concurrent uploads in batches
  const handleConcurrentUpload = async () => {
    if (selectedFiles.length === 0) return

    setUploading(true)
    setError(null)
    setUploadProgress(0)
    
    try {
      const pendingFiles = selectedFiles.filter(f => f.status === 'pending')
      console.log(`Starting concurrent upload of ${pendingFiles.length} files`)
      
      let completedCount = 0
      const totalFiles = pendingFiles.length
      
      // Process files in batches of MAX_CONCURRENT_UPLOADS
      for (let i = 0; i < pendingFiles.length; i += MAX_CONCURRENT_UPLOADS) {
        const batch = pendingFiles.slice(i, i + MAX_CONCURRENT_UPLOADS)
        console.log(`Processing batch ${Math.floor(i / MAX_CONCURRENT_UPLOADS) + 1}: ${batch.length} files`)
        
        // Upload batch concurrently
        const batchPromises = batch.map(fileWithStatus => 
          uploadSingleFile(fileWithStatus)
            .then(() => {
              completedCount++
              setUploadProgress(Math.round((completedCount / totalFiles) * 100))
            })
            .catch(error => {
              completedCount++
              setUploadProgress(Math.round((completedCount / totalFiles) * 100))
              console.error(`Failed to upload ${fileWithStatus.file.name}:`, error)
            })
        )
        
        // Wait for all files in this batch to complete
        await Promise.allSettled(batchPromises)
      }
      
      // Check results
      const finalFiles = selectedFiles
      const successCount = finalFiles.filter(f => f.status === 'success').length
      const errorCount = finalFiles.filter(f => f.status === 'error').length
      
      console.log(`Upload completed: ${successCount} success, ${errorCount} errors`)
      
      if (successCount > 0) {
        onUploadSuccess()
      }
      
      if (errorCount > 0) {
        setError(`${errorCount} file(s) failed to upload. Check individual file status for details.`)
      }
      
    } catch (error) {
      console.error('Upload process failed:', error)
      setError('Upload process failed. Please try again.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const getStatusIcon = (status: FileWithStatus['status']) => {
    switch (status) {
      case 'pending':
        return null
      case 'uploading':
        return <IconLoader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'success':
        return <IconCheck className="h-4 w-4 text-green-500" />
      case 'error':
        return <IconExclamationMark className="h-4 w-4 text-red-500" />
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const successCount = selectedFiles.filter(f => f.status === 'success').length
  const errorCount = selectedFiles.filter(f => f.status === 'error').length
  const pendingCount = selectedFiles.filter(f => f.status === 'pending').length
  const uploadingCount = selectedFiles.filter(f => f.status === 'uploading').length

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.xls,.xlsx"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        {...({ 
          webkitdirectory: "", 
          directory: "" 
        } as React.InputHTMLAttributes<HTMLInputElement> & { 
          webkitdirectory?: string; 
          directory?: string; 
        })}
        multiple
        onChange={handleFolderInputChange}
        className="hidden"
      />

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer transition-colors touch-target ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <IconCloudUpload className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
            {isDragActive ? (
              <p className="text-sm sm:text-base">Drop the files here...</p>
            ) : (
              <div>
                <p className="text-base sm:text-lg font-medium mb-1">
                  Drop files or folders here
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground px-2 mb-4">
                  Support for PDF, Word, Excel, and text files (max 50MB each)
                  <br />
                  Concurrent uploads (up to {MAX_CONCURRENT_UPLOADS} files at once)
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="bg-white border-blue-300 text-blue-700 hover:bg-blue-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFileSelect()
                    }}
                    disabled={uploading}
                  >
                    <IconFiles className="h-4 w-4 mr-2" />
                    Select Files
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="bg-white border-green-300 text-green-700 hover:bg-green-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFolderSelect()
                    }}
                    disabled={uploading}
                  >
                    <IconFolder className="h-4 w-4 mr-2" />
                    Select Folder
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Overall Upload Progress */}
      {uploading && uploadProgress > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </CardContent>
        </Card>
      )}

      {selectedFiles.length > 0 && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-medium text-sm sm:text-base">
                  Selected Files ({selectedFiles.length})
                </h3>
                {(successCount > 0 || errorCount > 0 || uploadingCount > 0) && (
                  <div className="flex items-center gap-2 text-xs">
                    {successCount > 0 && (
                      <span className="text-green-600 flex items-center gap-1">
                        <IconCheck className="h-3 w-3" />
                        {successCount}
                      </span>
                    )}
                    {uploadingCount > 0 && (
                      <span className="text-blue-600 flex items-center gap-1">
                        <IconLoader2 className="h-3 w-3 animate-spin" />
                        {uploadingCount}
                      </span>
                    )}
                    {errorCount > 0 && (
                      <span className="text-red-600 flex items-center gap-1">
                        <IconExclamationMark className="h-3 w-3" />
                        {errorCount}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFiles([])}
                className="text-gray-500 hover:text-gray-700"
                disabled={uploading}
              >
                Clear All
              </Button>
            </div>
            
            <div className="space-y-3 max-h-60 sm:max-h-80 overflow-y-auto">
              {selectedFiles.map((fileWithStatus) => (
                <div 
                  key={fileWithStatus.id} 
                  className="p-3 sm:p-4 bg-muted rounded-lg border border-border/50"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* File name and status */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex-1 min-w-0">
                          <p 
                            className="text-sm font-medium text-foreground break-words leading-tight"
                            title={fileWithStatus.file.name}
                          >
                            {fileWithStatus.file.name}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {getStatusIcon(fileWithStatus.status)}
                        </div>
                      </div>
                      
                      {/* File info */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="bg-background px-2 py-1 rounded text-xs border">
                          {fileWithStatus.file.type?.split('/')[1]?.toUpperCase() || 'FILE'}
                        </span>
                        <span>{formatFileSize(fileWithStatus.file.size)}</span>
                        {fileWithStatus.status === 'uploading' && (
                          <span className="text-blue-600 font-medium">
                            {fileWithStatus.progress}%
                          </span>
                        )}
                      </div>
                      
                      {/* Progress bar */}
                      {fileWithStatus.status === 'uploading' && (
                        <div className="w-full">
                          <Progress value={fileWithStatus.progress} className="h-2" />
                        </div>
                      )}
                      
                      {/* Error message */}
                      {fileWithStatus.status === 'error' && fileWithStatus.error && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                          {fileWithStatus.error}
                        </div>
                      )}
                      
                      {/* Success message */}
                      {fileWithStatus.status === 'success' && (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <IconCheck className="h-3 w-3" />
                          <span>Upload completed</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Remove button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(fileWithStatus.id)}
                      className="flex-shrink-0 h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 transition-colors"
                      disabled={uploading && fileWithStatus.status === 'uploading'}
                      title="Remove file"
                    >
                      <IconX className="h-4 w-4" />
                      <span className="sr-only">Remove file</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            {pendingCount > 0 && (
              <Button
                onClick={handleConcurrentUpload}
                disabled={uploading}
                className="w-full mt-3 sm:mt-4 touch-target"
              >
                {uploading ? (
                  <>
                    <IconLoader2 className="animate-spin h-4 w-4 mr-2" />
                    Uploading {uploadingCount} of {selectedFiles.length} files...
                  </>
                ) : (
                  `Upload ${pendingCount} file${pendingCount !== 1 ? 's' : ''} (Concurrent)`
                )}
              </Button>
            )}
            
            {pendingCount === 0 && selectedFiles.length > 0 && (
              <div className="text-center text-sm text-muted-foreground mt-3">
                Upload completed: {successCount} successful, {errorCount} failed
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
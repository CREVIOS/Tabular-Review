"use client"
import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { files } from '@/lib/api'
import { IconCloudUpload, IconX, IconAlertCircle, IconFiles, IconFolder } from '@tabler/icons-react'

interface FileUploadProps {
  onUploadSuccess: () => void
  folderId?: string | null
}

export function FileUpload({ onUploadSuccess, folderId }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Filter files based on allowed types (matching backend security)
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
      setTimeout(() => setError(null), 5000) // Clear error after 5 seconds
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
    // Reset the input to allow selecting the same files again
    event.target.value = ''
  }

  const handleFolderInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) {
      onDrop(files)
    }
    // Reset the input to allow selecting the same folder again
    event.target.value = ''
  }

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    setUploading(true)
    setError(null)
    
    try {
      console.log('Starting upload:', selectedFiles.map(f => ({ name: f.name, type: f.type, size: f.size })))
      console.log('Upload target folder:', folderId)
      
      // Ensure we have at least one file
      if (selectedFiles.length === 0) {
        throw new Error('Please select at least one file to upload')
      }
      
      // Use the API helper which should work better with the backend
      await files.upload(selectedFiles, folderId)
      
      setSelectedFiles([])
      onUploadSuccess()
    } catch (error: unknown) {
      console.error('Upload failed:', error)
      const errorObj = error as { response?: { data?: { detail?: string } }; message?: string }
      const errorMessage = errorObj.response?.data?.detail || (error instanceof Error ? error.message : 'Upload failed. Please try again.')
      setError(errorMessage)
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
        // ts error 
        /* @ts-expect-error reason */
        webkitdirectory=""
        directory=""
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
                </p>
                
                {/* Upload Options */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="bg-white border-blue-300 text-blue-700 hover:bg-blue-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFileSelect()
                    }}
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

      {selectedFiles.length > 0 && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm sm:text-base">
                Selected Files ({selectedFiles.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFiles([])}
                className="text-gray-500 hover:text-gray-700"
              >
                Clear All
              </Button>
            </div>
            <div className="space-y-2 max-h-60 sm:max-h-80 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-2 sm:p-3 bg-muted rounded gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-medium truncate" title={file.name}>
                      {file.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {file.type || 'Unknown type'} • {formatFileSize(file.size)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="touch-target flex-shrink-0"
                  >
                    <IconX className="h-4 w-4" />
                    <span className="sr-only">Remove file</span>
                  </Button>
                </div>
              ))}
            </div>
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full mt-3 sm:mt-4 touch-target"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Uploading...
                </>
              ) : (
                `Upload ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}`
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

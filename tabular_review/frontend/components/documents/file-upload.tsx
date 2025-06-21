"use client"
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { files } from '@/lib/api'
import { IconCloudUpload, IconX, IconAlertCircle } from '@tabler/icons-react'

interface FileUploadProps {
  onUploadSuccess: () => void
  folderId?: string | null
}

export function FileUpload({ onUploadSuccess, folderId }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      alert(`${rejectedCount} file(s) were rejected. Please upload PDF, Word, Excel, or text files only.`)
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
                  Drop files here or click to browse
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground px-2">
                  Support for PDF, Word, Excel, and text files (max 50MB each)
                </p>
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
            <h3 className="font-medium mb-3 text-sm sm:text-base">
              Selected Files ({selectedFiles.length})
            </h3>
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
              {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

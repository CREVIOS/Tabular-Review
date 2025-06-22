// app/upload/page.tsx
"use client"

import { useState, useCallback, useRef } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, File, X, CheckCircle, AlertCircle, Clock, CloudUpload, Sparkles, FolderOpen, FileStack } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { files as fileApi } from "@/lib/api"

interface UploadFile {
  id: string
  file: File
  status: "pending" | "uploading" | "success" | "error"
  progress: number
  errorMessage?: string
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: "pending",
      progress: 0,
    }))
    
    setFiles((prev) => [...prev, ...newFiles])
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
    multiple: true,
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
    const selectedFiles = Array.from(event.target.files || [])
    if (selectedFiles.length > 0) {
      onDrop(selectedFiles)
    }
  }

  const handleFolderInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    if (selectedFiles.length > 0) {
      onDrop(selectedFiles)
    }
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id))
  }

  const uploadFiles = async () => {
    if (files.length === 0) return

    setIsUploading(true)
    
    try {
      // Update files to show uploading status
      setFiles((prev) =>
        prev.map((file) => ({ ...file, status: "uploading" as const, progress: 0 }))
      )

      const fileList = files.map(f => f.file)
      await fileApi.upload(fileList, null)
      
      // Update files to show success status
      setFiles((prev) =>
        prev.map((file) => ({ 
          ...file, 
          status: "success" as const, 
          progress: 100 
        }))
      )

      console.log("Upload successful", `${files.length} files uploaded successfully`)

      // Clear files after a short delay
      setTimeout(() => {
        setFiles([])
      }, 2000)

    } catch (error) {
      // Update files to show error status
      setFiles((prev) =>
        prev.map((file) => ({ 
          ...file, 
          status: "error" as const,
          errorMessage: "Upload failed"
        }))
      )

      console.log("Upload failed", "Please try again", error)
    } finally {
      setIsUploading(false)
    }
  }

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-gray-500" />
      case "uploading":
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const pendingFiles = files.filter(f => f.status === "pending").length
  const successFiles = files.filter(f => f.status === "success").length
  const uploadingFiles = files.filter(f => f.status === "uploading").length

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
              <CloudUpload className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">Upload Documents</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Upload multiple files or entire folders to start your AI-powered analysis
          </p>
        </div>

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
          /* @ts-ignore */
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderInputChange}
          className="hidden"
        />

        {/* Main Upload Area */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          {/* Upload Zone */}
          <div className="p-8">
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300
                ${isDragActive 
                  ? 'border-blue-400 bg-blue-50 scale-105' 
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }
              `}
            >
              <input {...getInputProps()} />
              <div className="space-y-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Upload className={`h-8 w-8 transition-colors ${
                    isDragActive ? 'text-blue-600' : 'text-blue-500'
                  }`} />
                </div>
                
                {isDragActive ? (
                  <div>
                    <p className="text-2xl font-semibold text-blue-600 mb-2">Drop files here!</p>
                    <p className="text-blue-500">Release to upload your documents</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl font-semibold text-gray-900 mb-2">
                      Drag & drop files or folders
                    </p>
                    <p className="text-gray-600 mb-6">
                      or choose from the options below
                    </p>
                    
                    {/* Upload Options */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <Button 
                        variant="outline" 
                        className="bg-white border-2 border-blue-300 text-blue-700 hover:bg-blue-50 px-6 py-3"
                        onClick={handleFileSelect}
                      >
                        <FileStack className="h-5 w-5 mr-2" />
                        Select Multiple Files
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="bg-white border-2 border-green-300 text-green-700 hover:bg-green-50 px-6 py-3"
                        onClick={handleFolderSelect}
                      >
                        <FolderOpen className="h-5 w-5 mr-2" />
                        Select Entire Folder
                      </Button>
                    </div>
                    
                    <div className="mt-4 text-sm text-gray-500">
                      <p className="mb-1">✓ Multiple files at once</p>
                      <p className="mb-1">✓ Entire folder with subfolders</p>
                      <p>✓ Drag & drop from your file manager</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Files List & Actions */}
          {files.length > 0 && (
            <>
              {/* Quick Stats */}
              <div className="px-8 py-4 bg-gray-50 border-y border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-700">
                        Ready: <span className="font-bold text-blue-600">{pendingFiles}</span>
                      </span>
                    </div>
                    {uploadingFiles > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-gray-700">
                          Uploading: <span className="font-bold text-yellow-600">{uploadingFiles}</span>
                        </span>
                      </div>
                    )}
                    {successFiles > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700">
                          Completed: <span className="font-bold text-green-600">{successFiles}</span>
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setFiles([])}
                      disabled={isUploading}
                    >
                      Clear All
                    </Button>
                    <Button 
                      size="sm"
                      onClick={uploadFiles}
                      disabled={isUploading || pendingFiles === 0}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                    >
                      {isUploading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Upload {pendingFiles} File{pendingFiles !== 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Files List */}
              <div className="p-8 space-y-3 max-h-96 overflow-y-auto">
                {files.map((uploadFile) => (
                  <div
                    key={uploadFile.id}
                    className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <File className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-medium text-gray-900 truncate">
                          {uploadFile.file.name}
                        </p>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          uploadFile.status === 'pending' ? 'bg-gray-100 text-gray-700' :
                          uploadFile.status === 'uploading' ? 'bg-blue-100 text-blue-700' :
                          uploadFile.status === 'success' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {uploadFile.status === 'pending' ? 'Ready' :
                           uploadFile.status === 'uploading' ? 'Uploading' :
                           uploadFile.status === 'success' ? 'Complete' : 'Error'}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">
                          {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        {uploadFile.status === "uploading" && (
                          <Progress value={uploadFile.progress} className="flex-1 max-w-32" />
                        )}
                      </div>
                      
                      {uploadFile.errorMessage && (
                        <p className="text-sm text-red-500 mt-1">{uploadFile.errorMessage}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {getStatusIcon(uploadFile.status)}
                      {uploadFile.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(uploadFile.id)}
                          disabled={isUploading}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-4">
            Supported formats: PDF, Word (.doc/.docx), Excel (.xls/.xlsx), Text (.txt) • Maximum size: 50MB per file
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Secure Upload</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Bulk Upload</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Folder Support</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>AI Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
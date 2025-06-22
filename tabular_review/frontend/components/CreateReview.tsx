import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  X, 
  Files, 
  Folder, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  FileText,
  Target,
  Wand2,
  Search,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Folder {
  id: string
  name: string
  description: string | null
  color: string
  file_count: number
  total_size: number
}

interface File {
  id: string
  original_filename: string
  file_size: number
  status: 'queued' | 'processing' | 'completed' | 'failed'
  folder_id: string
  created_at: string
}

interface ReviewColumn {
  column_name: string
  prompt: string
  data_type: string
  column_order?: number
}

interface CreateReviewData {
  name: string
  description: string
  review_scope: 'files' | 'folder'
  folder_id?: string
  file_ids?: string[]
  columns: ReviewColumn[]
}

interface EnhancedCreateReviewProps {
  initialFolderId?: string | null
  selectedFiles?: string[]
  onSuccess: (reviewId: string) => void
  onCancel: () => void
}

export default function EnhancedCreateReview({ 
  initialFolderId,
  selectedFiles: initialSelectedFiles = [],
  onSuccess, 
  onCancel 
}: EnhancedCreateReviewProps) {
  // Form state
  const [reviewData, setReviewData] = useState<CreateReviewData>({
    name: '',
    description: '',
    review_scope: initialSelectedFiles.length > 0 ? 'files' : (initialFolderId ? 'folder' : 'files'),
    folder_id: initialFolderId || undefined,
    file_ids: initialSelectedFiles,
    columns: [{ column_name: '', prompt: '', data_type: 'text' }]
  })

  // UI state
  const [currentStep, setCurrentStep] = useState(1)
  const [folders, setFolders] = useState<Folder[]>([])
  const [availableFiles, setAvailableFiles] = useState<File[]>([])
  const [loadingFolders, setLoadingFolders] = useState(true)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileSearchQuery, setFileSearchQuery] = useState('')
  const [showFileSelector, setShowFileSelector] = useState(false)

  useEffect(() => {
    fetchFolders()
    fetchFiles()
  }, [])

  // Auto-set initial scope based on props
  useEffect(() => {
    if (initialFolderId && initialSelectedFiles.length === 0) {
      setReviewData(prev => ({
        ...prev,
        review_scope: 'folder',
        folder_id: initialFolderId
      }))
    } else if (initialSelectedFiles.length > 0) {
      setReviewData(prev => ({
        ...prev,
        review_scope: 'files',
        file_ids: initialSelectedFiles
      }))
    }
  }, [initialFolderId, initialSelectedFiles])

  const fetchFolders = async () => {
    try {
      setLoadingFolders(true)
      const token = localStorage.getItem('auth_token')
      
      if (!token) return

      const response = await fetch('http://localhost:8000/api/folders/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setFolders(data.filter((f: Folder) => f.file_count > 0))
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error)
    } finally {
      setLoadingFolders(false)
    }
  }

  const fetchFiles = async () => {
    try {
      setLoadingFiles(true)
      const token = localStorage.getItem('auth_token')
      
      if (!token) return

      const response = await fetch('http://localhost:8000/api/files/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        // Only include completed files for review creation
        setAvailableFiles(data.filter((f: File) => f.status === 'completed'))
      }
    } catch (error) {
      console.error('Failed to fetch files:', error)
    } finally {
      setLoadingFiles(false)
    }
  }

  const updateReviewData = (updates: Partial<CreateReviewData>) => {
    setReviewData(prev => ({ ...prev, ...updates }))
  }

  const addColumn = () => {
    const newColumns = [...reviewData.columns, { column_name: '', prompt: '', data_type: 'text' }]
    updateReviewData({ columns: newColumns })
  }

  const removeColumn = (index: number) => {
    if (reviewData.columns.length > 1) {
      const newColumns = reviewData.columns.filter((_, i) => i !== index)
      updateReviewData({ columns: newColumns })
    }
  }

  const updateColumn = (index: number, field: keyof ReviewColumn, value: string) => {
    const newColumns = [...reviewData.columns]
    newColumns[index] = { ...newColumns[index], [field]: value }
    updateReviewData({ columns: newColumns })
  }

  // File selection functions
  const handleFileToggle = (fileId: string) => {
    const currentFiles = reviewData.file_ids || []
    const updatedFiles = currentFiles.includes(fileId)
      ? currentFiles.filter(id => id !== fileId)
      : [...currentFiles, fileId]
    
    updateReviewData({ file_ids: updatedFiles })
  }

  const removeSelectedFile = (fileId: string) => {
    const updatedFiles = (reviewData.file_ids || []).filter(id => id !== fileId)
    updateReviewData({ file_ids: updatedFiles })
  }

  const getSelectedFiles = (): File[] => {
    return availableFiles.filter(file => reviewData.file_ids?.includes(file.id))
  }

  const getFilteredAvailableFiles = (): File[] => {
    let filtered = availableFiles.filter(file => !reviewData.file_ids?.includes(file.id))
    
    if (fileSearchQuery) {
      filtered = filtered.filter(file => 
        file.original_filename.toLowerCase().includes(fileSearchQuery.toLowerCase())
      )
    }
    
    return filtered
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const validateForm = () => {
    if (!reviewData.name.trim()) {
      setError('Review name is required')
      return false
    }

    if (reviewData.review_scope === 'folder' && !reviewData.folder_id) {
      setError('Please select a folder for folder-based review')
      return false
    }

    if (reviewData.review_scope === 'files' && (!reviewData.file_ids || reviewData.file_ids.length === 0)) {
      setError('Please select files for file-based review')
      return false
    }

    const validColumns = reviewData.columns.filter(col => col.column_name.trim() && col.prompt.trim())
    if (validColumns.length === 0) {
      setError('At least one complete column (name and prompt) is required')
      return false
    }

    return true
  }

  const handleSubmit = async () => {
    setError(null)
    
    if (!validateForm()) return

    setLoading(true)

    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('Authentication required')
      }

      // Filter out incomplete columns and prepare data
      const validColumns = reviewData.columns
        .filter(col => col.column_name.trim() && col.prompt.trim())
        .map((col, index) => ({
          column_name: col.column_name.trim(),
          prompt: col.prompt.trim(),
          data_type: col.data_type,
          column_order: index
        }))

      const submitData = {
        name: reviewData.name.trim(),
        description: reviewData.description.trim() || null,
        review_scope: reviewData.review_scope,
        columns: validColumns,
        ...(reviewData.review_scope === 'folder' 
          ? { folder_id: reviewData.folder_id }
          : { file_ids: reviewData.file_ids }
        )
      }

      console.log('Creating review:', submitData)

      const response = await fetch('http://localhost:8000/api/reviews/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log('Review created successfully:', result)
      
      onSuccess(result.id)
      
    } catch (error: unknown) {
      console.error('Failed to create review:', error)
      setError(error instanceof Error ? error.message : 'Failed to create review')
    } finally {
      setLoading(false)
    }
  }

  const getSelectedFolderInfo = () => {
    if (!reviewData.folder_id) return null
    return folders.find(f => f.id === reviewData.folder_id)
  }

  // Validation
  const isStep1Valid = reviewData.name.trim().length > 0
  const isStep2Valid = reviewData.columns.every(col => col.column_name.trim() && col.prompt.trim())
  const canCreate = isStep1Valid && isStep2Valid && (
    (reviewData.review_scope === 'files' && reviewData.file_ids && reviewData.file_ids.length > 0) ||
    (reviewData.review_scope === 'folder' && reviewData.folder_id)
  )

  const selectedFolder = getSelectedFolderInfo()
  const currentSelectedFiles = getSelectedFiles()

  const steps = [
    { id: 1, title: 'Review Details', description: 'Name and scope selection' },
    { id: 2, title: 'Analysis Columns', description: 'Define data extraction' },
    { id: 3, title: 'Review & Create', description: 'Confirm and start' }
  ]

  const getCurrentStepStatus = (stepId: number) => {
    if (stepId < currentStep) return 'completed'
    if (stepId === currentStep) return 'current'
    return 'upcoming'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Create Tabular Review</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Extract structured data from documents using AI-powered analysis
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-8">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                      getCurrentStepStatus(step.id) === 'completed'
                        ? 'bg-green-500 border-green-500 text-white'
                        : getCurrentStepStatus(step.id) === 'current'
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}>
                      {getCurrentStepStatus(step.id) === 'completed' ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        <span className="text-sm font-bold">{step.id}</span>
                      )}
                    </div>
                    <div className="mt-2 text-center">
                      <div className={`text-sm font-medium ${
                        getCurrentStepStatus(step.id) === 'current' ? 'text-blue-600' : 'text-gray-600'
                      }`}>
                        {step.title}
                      </div>
                      <div className="text-xs text-gray-500 max-w-24">
                        {step.description}
                      </div>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-16 h-0.5 mx-4 ${
                      getCurrentStepStatus(step.id) === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Form Card */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  currentStep === 1 ? 'bg-blue-100 text-blue-600' :
                  currentStep === 2 ? 'bg-green-100 text-green-600' :
                  'bg-purple-100 text-purple-600'
                }`}>
                  {currentStep === 1 ? <FileText className="h-5 w-5" /> :
                   currentStep === 2 ? <Target className="h-5 w-5" /> :
                   <Wand2 className="h-5 w-5" />}
                </div>
                <CardTitle className="text-xl">
                  {steps[currentStep - 1]?.title}
                </CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onCancel}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Step 1: Review Details */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-in slide-in-from-right duration-300">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Review Configuration</h3>
                  <p className="text-gray-600">Configure your review name and scope</p>
                </div>

                <div className="space-y-6 max-w-2xl mx-auto">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Review Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g., Contract Analysis, Invoice Processing, etc."
                      value={reviewData.name}
                      onChange={(e) => updateReviewData({ name: e.target.value })}
                      className="h-12 text-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                    {reviewData.name && (
                      <div className="mt-2 flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm">Looks good!</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Description <span className="text-gray-400">(Optional)</span>
                    </label>
                    <Textarea
                      placeholder="Brief description of what this review will analyze..."
                      value={reviewData.description}
                      onChange={(e) => updateReviewData({ description: e.target.value })}
                      rows={3}
                      className="text-base border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  {/* Review Scope */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Review Scope <span className="text-red-500">*</span>
                    </label>
                    <RadioGroup
                      value={reviewData.review_scope}
                      onValueChange={(value: 'files' | 'folder') => updateReviewData({ review_scope: value })}
                      className="space-y-4"
                    >
                      <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <RadioGroupItem value="files" id="files" />
                        <Label htmlFor="files" className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-3">
                            <Files className="h-5 w-5 text-blue-600" />
                            <div>
                              <div className="font-medium">Selected Files</div>
                              <div className="text-sm text-gray-500">
                                Process only specific files ({reviewData.file_ids?.length || 0} selected)
                              </div>
                            </div>
                          </div>
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <RadioGroupItem value="folder" id="folder" />
                        <Label htmlFor="folder" className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-3">
                            <Folder className="h-5 w-5 text-purple-600" />
                            <div>
                              <div className="font-medium">Entire Folder</div>
                              <div className="text-sm text-gray-500">
                                Process all completed files in a folder
                              </div>
                            </div>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>

                    {/* File Selection Interface */}
                    {reviewData.review_scope === 'files' && (
                      <div className="mt-4 space-y-4">
                        {/* Current Selection */}
                        {currentSelectedFiles.length > 0 && (
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Files className="h-4 w-4 text-blue-600" />
                                <span className="font-semibold text-blue-900 text-sm">Selected Files ({currentSelectedFiles.length})</span>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowFileSelector(!showFileSelector)}
                                className="text-blue-700 border-blue-300 hover:bg-blue-100"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add More
                              </Button>
                            </div>
                            
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {currentSelectedFiles.map(file => (
                                <div key={file.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <FileText className="h-4 w-4 text-gray-600 flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-gray-900 truncate">
                                        {file.original_filename}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {formatFileSize(file.file_size)}
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeSelectedFile(file.id)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Add Files Button if no files selected */}
                        {currentSelectedFiles.length === 0 && (
                          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                            <Files className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <h4 className="text-lg font-medium text-gray-900 mb-2">No files selected</h4>
                            <p className="text-gray-500 mb-4">Choose files to include in this review</p>
                            <Button
                              onClick={() => setShowFileSelector(true)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Select Files
                            </Button>
                          </div>
                        )}

                        {/* File Selector Modal */}
                        {showFileSelector && (
                          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
                              <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-lg font-semibold text-gray-900">Select Files for Review</h3>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowFileSelector(false)}
                                  >
                                    <X className="h-5 w-5" />
                                  </Button>
                                </div>
                                <div className="mt-4">
                                  <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                    <Input
                                      placeholder="Search files..."
                                      value={fileSearchQuery}
                                      onChange={(e) => setFileSearchQuery(e.target.value)}
                                      className="pl-10"
                                    />
                                  </div>
                                </div>
                              </div>
                              
                              <div className="p-6 overflow-y-auto max-h-96">
                                {loadingFiles ? (
                                  <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                    <span>Loading files...</span>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {getFilteredAvailableFiles().length === 0 ? (
                                      <div className="text-center py-8 text-gray-500">
                                        {fileSearchQuery ? 'No files match your search' : 'No available files to add'}
                                      </div>
                                    ) : (
                                      getFilteredAvailableFiles().map(file => (
                                        <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                                          <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <FileText className="h-4 w-4 text-gray-600 flex-shrink-0" />
                                            <div className="min-w-0 flex-1">
                                              <p className="text-sm font-medium text-gray-900 truncate">
                                                {file.original_filename}
                                              </p>
                                              <p className="text-xs text-gray-500">
                                                {formatFileSize(file.file_size)} • {new Date(file.created_at).toLocaleDateString()}
                                              </p>
                                            </div>
                                          </div>
                                          <Button
                                            size="sm"
                                            onClick={() => handleFileToggle(file.id)}
                                            className="bg-blue-600 hover:bg-blue-700"
                                          >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add
                                          </Button>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              <div className="p-6 border-t border-gray-200 bg-gray-50">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">
                                    {currentSelectedFiles.length} files selected
                                  </span>
                                  <Button
                                    onClick={() => setShowFileSelector(false)}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    Done
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Folder Selection */}
                    {reviewData.review_scope === 'folder' && (
                      <div className="mt-4 space-y-3">
                        <Label>Select Folder *</Label>
                        {loadingFolders ? (
                          <div className="flex items-center justify-center p-4 border rounded-lg">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading folders...
                          </div>
                        ) : (
                          <Select
                            value={reviewData.folder_id || ''}
                            onValueChange={(value) => updateReviewData({ folder_id: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a folder to process">
                                {selectedFolder && (
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-4 h-4 rounded"
                                      style={{ backgroundColor: selectedFolder.color }}
                                    />
                                    <span>{selectedFolder.name}</span>
                                    <span className="text-xs text-gray-500">({selectedFolder.file_count} files)</span>
                                  </div>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {folders.map(folder => (
                                <SelectItem key={folder.id} value={folder.id}>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-4 h-4 rounded"
                                      style={{ backgroundColor: folder.color }}
                                    />
                                    <span>{folder.name}</span>
                                    <span className="text-xs text-gray-500">
                                      ({folder.file_count} files • {formatFileSize(folder.total_size)})
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                              {folders.length === 0 && (
                                <SelectItem value="" disabled>
                                  No folders with files available
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}

                    {/* Folder Info */}
                    {reviewData.review_scope === 'folder' && selectedFolder && (
                      <div className="mt-4 bg-purple-50 border border-purple-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div 
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: selectedFolder.color }}
                          />
                          <span className="font-semibold text-purple-900 text-sm">{selectedFolder.name}</span>
                        </div>
                        <div className="text-purple-700 text-sm">
                          {selectedFolder.file_count} files • {formatFileSize(selectedFolder.total_size)}
                        </div>
                        {selectedFolder.description && (
                          <div className="text-purple-600 text-sm mt-1">
                            {selectedFolder.description}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Analysis Columns */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right duration-300">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Analysis Configuration</h3>
                  <p className="text-gray-600">Define what data to extract from each document</p>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-gray-900">Extraction Columns</h4>
                    <Button 
                      variant="outline" 
                      onClick={addColumn}
                      className="bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Column
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {reviewData.columns.map((column, index) => (
                      <div key={index} className="group">
                        <div className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-300 transition-all duration-200 bg-white">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                            </div>
                            
                            <div className="flex-1 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Column Name <span className="text-red-500">*</span>
                                  </label>
                                  <Input
                                    placeholder="e.g., Contract Value, Company Name"
                                    value={column.column_name}
                                    onChange={(e) => updateColumn(index, 'column_name', e.target.value)}
                                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                  />
                                </div>
                                
                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Data Type
                                  </label>
                                  <Select
                                    value={column.data_type}
                                    onValueChange={(value) => updateColumn(index, 'data_type', value)}
                                  >
                                    <SelectTrigger className="h-11">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="text">Text</SelectItem>
                                      <SelectItem value="number">Number</SelectItem>
                                      <SelectItem value="date">Date</SelectItem>
                                      <SelectItem value="boolean">Yes/No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  Extraction Prompt <span className="text-red-500">*</span>
                                </label>
                                <Textarea
                                  placeholder="Describe what data to extract. Be specific about format and location..."
                                  value={column.prompt}
                                  onChange={(e) => updateColumn(index, 'prompt', e.target.value)}
                                  rows={3}
                                  className="border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                />
                              </div>

                              {/* Validation Feedback */}
                              {column.column_name && column.prompt && (
                                <div className="flex items-center gap-2 text-green-600">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span className="text-sm font-medium">Column configured correctly</span>
                                </div>
                              )}
                            </div>

                            {reviewData.columns.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeColumn(index)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tips */}
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
                    <h5 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Pro Tips for Better Results
                    </h5>
                    <ul className="space-y-2 text-sm text-purple-800">
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500">•</span>
                        <span>Be specific: "Extract contract value in USD format" vs "Find money"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500">•</span>
                        <span>Include format preferences: "Date in MM/DD/YYYY format"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500">•</span>
                        <span>Use clear column names: "Invoice Total" not "Amount"</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Review & Create */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-in slide-in-from-right duration-300">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Ready to Start Analysis!</h3>
                  <p className="text-gray-600">Review your configuration and start the AI analysis</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Review Details Summary */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
                    <h4 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Review Configuration
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm text-blue-700 font-medium">Name:</span>
                        <p className="font-semibold text-blue-900">{reviewData.name}</p>
                      </div>
                      {reviewData.description && (
                        <div>
                          <span className="text-sm text-blue-700 font-medium">Description:</span>
                          <p className="text-blue-800 text-sm">{reviewData.description}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-sm text-blue-700 font-medium">Scope:</span>
                        <p className="font-semibold text-blue-900 capitalize">
                          {reviewData.review_scope === 'folder' ? 'Entire Folder' : 'Selected Files'}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-blue-700 font-medium">Target:</span>
                        <p className="font-semibold text-blue-900">
                          {reviewData.review_scope === 'folder' 
                            ? selectedFolder?.name 
                            : `${reviewData.file_ids?.length || 0} files`
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Columns Summary */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6">
                    <h4 className="font-bold text-green-900 mb-4 flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Analysis Columns ({reviewData.columns.filter(col => col.column_name.trim() && col.prompt.trim()).length})
                    </h4>
                    <div className="space-y-2">
                      {reviewData.columns
                        .filter(col => col.column_name.trim() && col.prompt.trim())
                        .map((column, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="w-5 h-5 bg-green-500 text-white rounded text-xs flex items-center justify-center font-bold">
                            {index + 1}
                          </span>
                          <span className="font-medium text-green-900 text-sm">{column.column_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {column.data_type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Expected Results */}
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
                  <h4 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
                    <Wand2 className="h-5 w-5" />
                    What Happens Next?
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">1</div>
                      <span className="text-purple-800 text-sm font-medium">AI analyzes documents</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">2</div>
                      <span className="text-purple-800 text-sm font-medium">Extracts structured data</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">3</div>
                      <span className="text-purple-800 text-sm font-medium">Real-time results table</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-8 border-t border-gray-200">
              <div className="flex gap-3">
                {currentStep > 1 && (
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="px-6"
                  >
                    Previous
                  </Button>
                )}
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={onCancel}
                  className="px-6"
                >
                  Cancel
                </Button>
                
                {currentStep < 3 ? (
                  <Button
                    onClick={() => setCurrentStep(currentStep + 1)}
                    disabled={
                      (currentStep === 1 && !isStep1Valid) ||
                      (currentStep === 2 && !isStep2Valid)
                    }
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-6"
                  >
                    Next Step
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={!canCreate || loading}
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 px-8 shadow-lg hover:shadow-xl transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Creating Review...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Create & Start Analysis
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
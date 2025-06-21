import React from 'react'
import { X, Plus, Loader2, FileText, Search, Folder } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { File, Review } from '../types'

interface AddDocumentsModalProps {
  isOpen: boolean
  review: Review | null
  files: File[]
  selectedFiles: string[]
  searchQuery: string
  isLoading: boolean
  onClose: () => void
  onFileSelect: (fileId: string) => void
  onSearchChange: (query: string) => void
  onSubmit: () => void
  isMobile?: boolean
}

export const AddDocumentsModal: React.FC<AddDocumentsModalProps> = ({
  isOpen,
  review,
  files,
  selectedFiles,
  searchQuery,
  isLoading,
  onClose,
  onFileSelect,
  onSearchChange,
  onSubmit,
  isMobile = false
}) => {
  if (!isOpen || !review) return null

  // Filter files by review's folder first, then by search query
  const folderFiles = files.filter(file => file.folder_id === review.folder_id)
  const filteredFiles = folderFiles.filter(file => 
    file.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Filter out files already in the review
  const existingFileIds = review.files?.map(f => f.file_id) || []
  const availableFiles = filteredFiles.filter(file => !existingFileIds.includes(file.id))

  const canSubmit = selectedFiles.length > 0 && !isLoading

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl w-full flex flex-col shadow-2xl ${isMobile ? 'max-w-[95vw] h-[90vh]' : 'max-w-3xl h-[80vh]'}`}>
        {/* Header - Enhanced for mobile */}
        <div className={`flex items-center justify-between border-b border-gray-200 ${isMobile ? 'p-4' : 'p-6'}`}>
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Folder className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className={`font-semibold text-gray-900 ${isMobile ? 'text-lg' : 'text-xl'}`}>Add Documents to Review</h3>
              <p className={`text-gray-500 truncate ${isMobile ? 'text-xs' : 'text-sm'}`}>Select documents from this folder to add to your review</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className={`touch-target ${isMobile ? 'h-10 w-10 p-0' : 'h-9 w-9 p-0'}`}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Search Bar - Enhanced for mobile */}
        <div className={`border-b border-gray-100 ${isMobile ? 'p-4' : 'p-6'}`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search documents in this folder..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className={`pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500 touch-target ${isMobile ? 'h-11 text-base' : 'h-10'}`}
            />
          </div>
          {review.folder_id && (
            <div className="flex items-center space-x-2 mt-3">
              <Badge variant="outline" className="text-xs">
                Folder: {review.folder_id}
              </Badge>
              <span className="text-xs text-gray-500">
                {folderFiles.length} documents in folder • {availableFiles.length} available to add
              </span>
            </div>
          )}
        </div>
        
        {/* File List - Enhanced for mobile */}
        <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-4' : 'p-6'}`}>
          {availableFiles.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className={`text-center ${isMobile ? 'py-6' : 'pt-8 pb-8'}`}>
                <FileText className={`text-gray-300 mx-auto mb-4 ${isMobile ? 'h-10 w-10' : 'h-12 w-12'}`} />
                {folderFiles.length === 0 ? (
                  <>
                    <h4 className={`font-medium text-gray-900 mb-2 ${isMobile ? 'text-base' : 'text-lg'}`}>No documents in this folder</h4>
                    <p className={`text-gray-500 ${isMobile ? 'text-sm' : 'text-sm'}`}>Upload documents to this folder first to add them to your review.</p>
                  </>
                ) : existingFileIds.length === folderFiles.length ? (
                  <>
                    <h4 className={`font-medium text-gray-900 mb-2 ${isMobile ? 'text-base' : 'text-lg'}`}>All documents already added</h4>
                    <p className={`text-gray-500 ${isMobile ? 'text-sm' : 'text-sm'}`}>All documents from this folder are already in your review.</p>
                  </>
                ) : (
                  <>
                    <h4 className={`font-medium text-gray-900 mb-2 ${isMobile ? 'text-base' : 'text-lg'}`}>No matching documents</h4>
                    <p className={`text-gray-500 ${isMobile ? 'text-sm' : 'text-sm'}`}>Try adjusting your search terms to find more documents.</p>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className={`grid gap-3 ${isMobile ? 'gap-2' : ''}`}>
              {availableFiles.map((file) => (
                <Card
                  key={file.id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md touch-target ${
                    selectedFiles.includes(file.id)
                      ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => onFileSelect(file.id)}
                >
                  <CardContent className={isMobile ? 'p-3' : 'p-4'}>
                    <div className="flex items-center space-x-3">
                      <Checkbox 
                        checked={selectedFiles.includes(file.id)}
                        onChange={() => onFileSelect(file.id)}
                        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-gray-900 truncate ${isMobile ? 'text-sm' : 'text-sm'}`} title={file.original_filename}>
                          {file.original_filename}
                        </p>
                        <div className={`flex items-center space-x-4 mt-1 ${isMobile ? 'space-x-3' : ''}`}>
                          <span className="text-xs text-gray-500">
                            {formatFileSize(file.file_size)}
                          </span>
                          <Badge 
                            variant={file.status === 'completed' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {file.status === 'completed' ? 'Ready' : 
                             file.status === 'processing' ? 'Processing' : 'Pending'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer - Enhanced for mobile */}
        <div className={`border-t border-gray-200 bg-gray-50/50 ${isMobile ? 'p-4' : 'p-6'}`}>
          {selectedFiles.length > 0 && (
            <div className={`bg-blue-50 border border-blue-200 rounded-lg mb-4 ${isMobile ? 'p-3' : 'p-3'}`}>
              <div className={`text-blue-800 ${isMobile ? 'text-sm' : 'text-sm'}`}>
                <strong>{selectedFiles.length}</strong> document{selectedFiles.length !== 1 ? 's' : ''} selected 
                • Will be analyzed across <strong>{review.total_columns || 0}</strong> column{(review.total_columns || 0) !== 1 ? 's' : ''}
              </div>
            </div>
          )}
          <div className={`flex gap-3 ${isMobile ? 'flex-col' : 'justify-end'}`}>
            <Button 
              variant="outline" 
              onClick={onClose} 
              className={`touch-target ${isMobile ? 'h-11' : 'h-10'}`}
            >
              Cancel
            </Button>
            <Button 
              onClick={onSubmit}
              disabled={!canSubmit}
              className={`touch-target ${isMobile ? 'h-11' : 'h-10'}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add {selectedFiles.length} Document{selectedFiles.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
} 
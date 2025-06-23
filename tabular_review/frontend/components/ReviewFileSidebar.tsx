import React, { useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight, FileText, Folder, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { File, Review } from '../types'

interface ReviewFileSidebarProps {
  review: Review
  files: File[]
  isCollapsed: boolean
  onToggleCollapse: () => void
  onAddDocuments: () => void
  isMobile?: boolean
}

export const ReviewFileSidebar: React.FC<ReviewFileSidebarProps> = ({
  review,
  files,
  isCollapsed,
  onToggleCollapse,
  onAddDocuments,
  isMobile = false
}) => {
  const [searchQuery, setSearchQuery] = useState('')

  // Use all files passed to the component - filtering is already done in parent
  const folderFiles = useMemo(() => {
    return files // Use all files passed to the component
  }, [files])

  // Get files already in the review
  const reviewFileIds = useMemo(() => {
    const ids = new Set(review.files?.map(f => f.file_id) || [])
    return ids
  }, [review.files])

  // Filter files by search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return folderFiles
    return folderFiles.filter(file => 
      file.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [folderFiles, searchQuery])

  // Separate files into in-review and available
  const filesInReview = filteredFiles.filter(file => reviewFileIds.has(file.id))
  const availableFiles = filteredFiles.filter(file => !reviewFileIds.has(file.id))

  const handleDragStart = (e: React.DragEvent, fileId: string) => {
    e.dataTransfer.setData('text/plain', fileId)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const FileItem = ({ file, isInReview }: { file: File; isInReview: boolean }) => (
    <div
      draggable={!isInReview}
      onDragStart={(e) => !isInReview && handleDragStart(e, file.id)}
      className={`group p-3 rounded-lg border transition-all duration-200 touch-target ${
        isInReview 
          ? 'bg-blue-50 border-blue-200 cursor-default' 
          : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm cursor-grab active:cursor-grabbing'
      }`}
    >
      <div className="flex items-center space-x-3">
        <div className={`p-2 rounded-lg ${
          isInReview ? 'bg-blue-100' : 'bg-gray-100 group-hover:bg-blue-100'
        }`}>
          <FileText className={`h-4 w-4 ${
            isInReview ? 'text-blue-600' : 'text-gray-600 group-hover:text-blue-600'
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate" title={file.original_filename}>
            {file.original_filename}
          </p>
          <div className="flex items-center space-x-2 mt-1">
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
            {isInReview && (
              <Badge variant="outline" className="text-xs">
                In Review
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (isCollapsed && !isMobile) {
    return (
      <div className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="h-9 w-9 p-0 mb-4 touch-target"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="flex flex-col items-center space-y-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Folder className="h-4 w-4 text-blue-600" />
          </div>
          <div className="writing-mode-vertical text-xs text-gray-500 font-medium">
            Files
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${isMobile ? 'w-full h-full' : 'w-80'} bg-white ${!isMobile ? 'border-r border-gray-200' : ''} flex flex-col`}>
      {/* Header - Enhanced for mobile */}
      <div className="p-4 border-b border-gray-200">
        {!isMobile && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Folder className="h-4 w-4 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Review Files</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="h-9 w-9 p-0 touch-target"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Search - Enhanced for mobile */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`pl-10 touch-target ${isMobile ? 'h-11 text-base' : 'h-9'}`}
          />
        </div>

        {/* Stats - Enhanced for mobile */}
        <div className={`flex items-center justify-between text-xs text-gray-500 ${isMobile ? 'mt-4' : 'mt-3'}`}>
          <span>{folderFiles.length} files in folder</span>
          <span>{filesInReview.length} in review</span>
        </div>
      </div>

      {/* File List - Enhanced for mobile */}
      <div className={`flex-1 overflow-y-auto space-y-4 ${isMobile ? 'p-4 pb-20' : 'p-4'}`}>
        {/* Files in Review */}
        {filesInReview.length > 0 && (
          <div>
            <h4 className={`font-semibold text-gray-700 mb-3 flex items-center ${isMobile ? 'text-base' : 'text-sm'}`}>
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              In Review ({filesInReview.length})
            </h4>
            <div className={`space-y-2 ${isMobile ? 'space-y-3' : ''}`}>
              {filesInReview.map(file => (
                <FileItem key={file.id} file={file} isInReview={true} />
              ))}
            </div>
          </div>
        )}

        {/* Available Files */}
        {availableFiles.length > 0 && (
          <div>
            <h4 className={`font-semibold text-gray-700 mb-3 flex items-center ${isMobile ? 'text-base' : 'text-sm'}`}>
              <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
              Available to Add ({availableFiles.length})
            </h4>
            <div className={`space-y-2 ${isMobile ? 'space-y-3' : ''}`}>
              {availableFiles.map(file => (
                <FileItem key={file.id} file={file} isInReview={false} />
              ))}
            </div>
            <div className={`text-gray-500 italic ${isMobile ? 'mt-4 text-sm' : 'mt-3 text-xs'}`}>
              💡 {isMobile ? 'Tap files in the table to view them' : 'Drag files to the table to add them to the review'}
            </div>
          </div>
        )}

        {/* Empty States */}
        {filteredFiles.length === 0 && (
          <div className="text-center py-8">
            <FileText className={`text-gray-300 mx-auto mb-3 ${isMobile ? 'h-12 w-12' : 'h-8 w-8'}`} />
            <p className={`text-gray-500 mb-2 ${isMobile ? 'text-base' : 'text-sm'}`}>
              {searchQuery 
                ? 'No files match your search'
                : folderFiles.length === 0
                  ? 'No files available'
                  : 'No files in this folder'
              }
            </p>
            {folderFiles.length === 0 && (
              <p className={`text-gray-400 ${isMobile ? 'text-sm' : 'text-xs'}`}>
                Try uploading files or checking if the review is associated with the correct folder
              </p>
            )}
          </div>
        )}

        {/* Add More Documents Button */}
        {availableFiles.length === 0 && filesInReview.length > 0 && !searchQuery && (
          <div className="pt-4">
            <Button
              variant="outline"
              onClick={onAddDocuments}
              className={`w-full touch-target ${isMobile ? 'h-11' : ''}`}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Browse All Files
            </Button>
          </div>
        )}
      </div>
    </div>
  )
} 
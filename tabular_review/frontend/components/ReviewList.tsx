import React, { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Files } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Review } from '../types'
import { ReviewDataTable } from './review-list/data-table'
import { createReviewColumns, ReviewTableRow } from './review-list/columns'
import FileList from './FileList'
import { createClient } from '@/lib/supabase/client'

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
  created_at: string
  folder_id: string | null
}

interface ReviewListProps {
  reviews: Review[]
  selectedFiles: string[]
  files: File[]
  searchQuery: string
  onSelectReview: (review: Review) => void
  onCreateReview: () => void
  onFileSelect: (fileId: string) => void
  onSearchChange: (query: string) => void
  onDragStart: (fileId: string) => void
}

export const ReviewList: React.FC<ReviewListProps> = ({
  reviews = [],
  selectedFiles = [],
  files = [],
  searchQuery,
  onSelectReview,
  onCreateReview,
  onFileSelect,
  onSearchChange,
  onDragStart
}) => {
  const [folders, setFolders] = useState<Folder[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [, setLoading] = useState(false)

  // Fetch folders for filtering
  useEffect(() => {
    fetchFolders()
  }, [])

  const fetchFolders = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        console.error('No authentication session found')
        return
      }

      const response = await fetch('http://localhost:8000/api/folders/', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setFolders(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error)
    } finally {
      setLoading(false)
    }
  }

  // Transform reviews data to include folder info
  const tableData: ReviewTableRow[] = useMemo(() => {
    // Safety check: ensure reviews is an array
    if (!Array.isArray(reviews)) {
      console.warn('Reviews is not an array:', reviews)
      return []
    }
    
    return reviews.map(review => {
      const folder = folders.find(f => f.id === review.folder_id)
      return {
        ...review,
        folderName: folder?.name || '',
        folderColor: folder?.color || '#6b7280'
      }
    })
  }, [reviews, folders])

  // Create columns with handlers
  const columns = useMemo(() => {
    return createReviewColumns({
      onSelectReview,
      onDeleteReview: undefined // We can add delete functionality later
    })
  }, [onSelectReview])

  return (
    <div className="flex h-full bg-gray-50">
      {/* Collapsible File Sidebar */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'w-0' : 'w-80'} overflow-hidden`}>
        <FileList
          files={files}
          selectedFiles={selectedFiles}
          searchQuery={searchQuery}
          selectedReview={null}
          onFileSelect={onFileSelect}
          onSearchChange={onSearchChange}
          onCreateReview={onCreateReview}
          onDragStart={onDragStart}
        />
      </div>

      {/* Sidebar Toggle */}
      <div className="flex-shrink-0 bg-white border-r border-gray-200 flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="h-9 w-9 p-0"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
        
        {sidebarCollapsed && (
          <div className="mt-4 writing-mode-vertical text-xs text-gray-500 font-medium">
            <Files className="h-4 w-4 mx-auto mb-2" />
          </div>
        )}
      </div>

      {/* Main Review Table */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full p-6">
          <ReviewDataTable
            columns={columns}
            data={tableData}
            selectedFiles={selectedFiles}
            onCreateReview={onCreateReview}
            folders={folders.map(f => ({ id: f.id, name: f.name, color: f.color }))}
          />
        </div>
      </div>
    </div>
  )
} 
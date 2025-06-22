// /review/page.tsx

'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { 
  RefreshCw, 
  Plus, 
  Search, 
  LayoutGrid, 
  LayoutList,
  FileText,
  BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// Optimized hooks with caching
import { 
  useReviewsWithFiles} from '../../hooks/useOptimizedApi'

// Store - using individual hooks for better performance
import {
  useReviews,
  useSetReviews,
  useSetFiles,
  useSelectedFiles,
  useSetSelectedFiles,
  useSetError,
} from '../../store/useRealtimeStore'

// Components
import { ReviewDataTable } from '../../components/review-list/data-table'
import { createReviewColumns, ReviewTableRow } from '../../components/review-list/columns'
import EnhancedCreateReview from '../../components/CreateReview'

// Types
import { Review } from '../../types'

export default function TabularReviewPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Get folder context from URL parameters
  const folderId = searchParams.get('folderId')
  const fileIds = useMemo(() => {
  return searchParams.get('fileIds')?.split(',').filter(Boolean) || [];
}, [searchParams]);
  
  // Store state - using individual hooks for better performance
  const reviews = useReviews()
  const selectedFiles = useSelectedFiles()
  const setSelectedFiles = useSetSelectedFiles()
  const setError = useSetError()
  // const error = useStoreError()
  const setReviews = useSetReviews()
  const setFiles = useSetFiles()
  
  // Local state
  const [isCreatingReview, setIsCreatingReview] = useState(!!folderId || fileIds.length > 0)
  const [folders, setFolders] = useState<Array<{ id: string; name: string; color: string }>>([])
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  
  // Optimized API hooks with caching
  const { 
    data: reviewsWithFiles, 
    isLoading, 
    error: apiError
  } = useReviewsWithFiles()
  
  // const startAnalysisMutation = useStartAnalysis()

  // Initialize store with data
  useEffect(() => {
    if (reviewsWithFiles) {
      const reviewsArray = Array.isArray(reviewsWithFiles.reviews) ? reviewsWithFiles.reviews : []
      const filesArray = Array.isArray(reviewsWithFiles.files) ? reviewsWithFiles.files : []
      
      setReviews(reviewsArray)
      setFiles(filesArray)
    }
  }, [reviewsWithFiles, setReviews, setFiles])

  // Initialize selected files from URL
  useEffect(() => {
    if (fileIds.length > 0) {
      setSelectedFiles(fileIds)
    }
  }, [fileIds, setSelectedFiles])

  // Fetch folders separately
  useEffect(() => {
    const fetchFolders = async () => {
      try {
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
          setFolders(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        console.error('Failed to fetch folders:', error)
      }
    }

    fetchFolders()
  }, [])

  // Error handling
  useEffect(() => {
    if (apiError) {
      setError(apiError instanceof Error ? apiError.message : 'An error occurred')
    }
  }, [apiError, setError])

  // Transform reviews data to include folder info - with safety checks
  const tableData: ReviewTableRow[] = useMemo(() => {
    if (!Array.isArray(reviews)) {
      return []
    }
    
    const transformedData = reviews.map(review => {
      const folder = folders.find(f => f.id === review.folder_id)
      return {
        ...review,
        folderName: folder?.name || '',
        folderColor: folder?.color || '#6b7280'
      }
    })
    
    return transformedData
  }, [reviews, folders])

  // Filter reviews based on search and status
  const filteredReviews = useMemo(() => {
    let filtered = tableData
    
    if (searchQuery) {
      filtered = filtered.filter(review => 
        review.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        review.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        review.folderName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(review => review.status === statusFilter)
    }
    
    return filtered
  }, [tableData, searchQuery, statusFilter])

  // Calculate stats
  //   const stats = useMemo(() => {
  //   const total = reviews.length
  //   const completed = reviews.filter(r => r.status === 'completed').length
  //   const processing = reviews.filter(r => r.status === 'processing').length
  //   const failed = reviews.filter(r => r.status === 'failed').length
  //   const totalFiles = reviews.reduce((sum, r) => sum + (r.total_files || 0), 0)
  //   const avgCompletion = total > 0 ? reviews.reduce((sum, r) => sum + (r.completion_percentage || 0), 0) / total : 0
    
  //   return {
  //     total,
  //     completed,
  //     processing,
  //     failed,
  //     totalFiles,
  //     avgCompletion: Math.round(avgCompletion)
  //   }
  // }, [reviews])

  // Create columns with handlers
  const columns = useMemo(() => {
    return createReviewColumns({
      onSelectReview: (review: Review) => {
        router.push(`/review/${review.id}`)
      },
      onDeleteReview: undefined
    })
  }, [router])

  const handleCreateReview = (reviewId: string) => {
    setIsCreatingReview(false)
    setSelectedFiles([])
    router.push(`/review/${reviewId}`)         
  }

  // const handleQuickAction = (action: string) => {
  //   switch (action) {
  //     case 'create':
  //       setIsCreatingReview(true)
  //       break
  //     case 'templates':
  //       // Navigate to templates
  //       break
  //     case 'analytics':
  //       // Navigate to analytics
  //       break
  //   }
  // }

  if (isLoading && !reviewsWithFiles) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Reviews</h3>
              <p className="text-gray-600">Fetching your tabular reviews...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isCreatingReview) {
    return (
      <EnhancedCreateReview
        initialFolderId={folderId}
        selectedFiles={selectedFiles}
        onSuccess={handleCreateReview}
        onCancel={() => {
          setIsCreatingReview(false)
          setSelectedFiles([])
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Tabular Reviews
                </h1>
                <p className="text-gray-600 mt-1">
                  AI-powered document analysis and data extraction
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                onClick={() => setIsCreatingReview(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg flex-1 sm:flex-initial touch-target"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Review
              </Button>
            </div>
          </div>

        </div>

        {/* Main Content */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="text-xl font-semibold">Your Reviews</CardTitle>
              
              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search reviews..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 touch-target"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white touch-target"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                  <option value="draft">Draft</option>
                </select>

                {/* View Mode Toggle */}
                <div className="flex border rounded-lg">
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className="touch-target"
                  >
                    <LayoutList className="h-4 w-4" />
                    <span className="ml-1 sm:hidden">Table</span>
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="touch-target"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    <span className="ml-1 sm:hidden">Grid</span>
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {viewMode === 'table' ? (
              <ReviewDataTable
                columns={columns}
                data={filteredReviews}
                selectedFiles={selectedFiles}
                onCreateReview={() => setIsCreatingReview(true)}
                folders={folders}
              />
            ) : (
              <div className="p-6">
                {filteredReviews.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <BarChart3 className="h-12 w-12 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">
                      {searchQuery || statusFilter !== 'all' ? 'No reviews found' : 'No reviews yet'}
                    </h3>
                    <p className="text-gray-600 mb-8 max-w-md mx-auto">
                      {searchQuery || statusFilter !== 'all' 
                        ? 'Try adjusting your search criteria or filters' 
                        : 'Create your first review to start extracting structured data from documents.'
                      }
                    </p>
                    {!searchQuery && statusFilter === 'all' && (
                      <Button 
                        onClick={() => setIsCreatingReview(true)}
                        className="bg-blue-600 hover:bg-blue-700 touch-target"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Review
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredReviews.map((review) => (
                      <Card 
                        key={review.id} 
                        className="hover:shadow-lg transition-all duration-200 cursor-pointer border border-gray-200"
                        onClick={() => router.push(`/review/${review.id}`)}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 truncate mb-1" title={review.name}>
                                {review.name}
                              </h3>
                              {review.description && (
                                <p className="text-sm text-gray-600 line-clamp-2" title={review.description}>
                                  {review.description}
                                </p>
                              )}
                            </div>
                            <Badge variant={
                              review.status === 'completed' ? 'default' :
                              review.status === 'processing' ? 'secondary' :
                              review.status === 'error' ? 'destructive' : 'outline'
                            }>
                              {review.status}
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            {/* Progress */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-600">Progress</span>
                                <span className="text-xs font-medium">{Math.round(review.completion_percentage || 0)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all duration-300 ${
                                    (review.completion_percentage || 0) >= 100 ? 'bg-green-500' :
                                    (review.completion_percentage || 0) >= 50 ? 'bg-blue-500' : 'bg-yellow-500'
                                  }`}
                                  style={{ width: `${review.completion_percentage || 0}%` }}
                                />
                              </div>
                            </div>

                            {/* Stats */}
                            <div className="flex items-center justify-between text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                <span>{review.total_files || 0} files</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <BarChart3 className="h-3 w-3" />
                                <span>{review.total_columns || 0} columns</span>
                              </div>
                            </div>

                            {/* Folder */}
                            {review.folderName && (
                              <div className="flex items-center gap-2 text-sm">
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: review.folderColor }}
                                />
                                <span className="text-gray-600 truncate">{review.folderName}</span>
                              </div>
                            )}

                            {/* Date */}
                            <div className="text-xs text-gray-500">
                              Created {new Date(review.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
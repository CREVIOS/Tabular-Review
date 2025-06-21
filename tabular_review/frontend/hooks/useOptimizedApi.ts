import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { Review, File } from '../types'
import { NewColumn } from '../types'
import { useRealtimeStore } from '../store/useRealtimeStore'

const EMPTY_ARRAY: Review[] = []

// API Client with better error handling and retries
class ApiClient {
  private baseUrl = 'http://localhost:8000/api'
  private token: string | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token')
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    }

    const response = await fetch(url, config)
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }
    
    return response.json()
  }

  
  // Batch API calls
  async batchRequest<T>(requests: Array<{ endpoint: string; options?: RequestInit }>): Promise<T[]> {
    const promises = requests.map(({ endpoint, options }) => 
      this.request<T>(endpoint, options)
    )
    return Promise.all(promises)
  }

  // Files
  async getFiles(): Promise<File[]> {
    try {
      const result = await this.request<File[]>('/files/')
      return Array.isArray(result) ? result : []
    } catch (error) {
      console.error('Failed to fetch files:', error)
      return []
    }
  }

  async getFilesByFolder(folderId: string): Promise<File[]> {
    try {
      const result = await this.request<File[]>(`/files/?folder_id=${folderId}`)
      return Array.isArray(result) ? result : []
    } catch (error) {
      console.error('Failed to fetch files by folder:', error)
      return []
    }
  }

  // Reviews
  async getReviews(): Promise<Review[]> {
    try {
      const result = await this.request<any>('/reviews/')
      // Handle paginated response
      if (result && result.reviews && Array.isArray(result.reviews)) {
        return result.reviews
      }
      // Handle direct array response
      return Array.isArray(result) ? result : []
    } catch (error) {
      console.error('Failed to fetch reviews:', error)
      return []
    }
  }


  async getReview(id: string, includeResults = false): Promise<Review> {
    return this.request<Review>(
      `/reviews/${id}?include_results=${includeResults ? 'true' : 'false'}`
    );
  }
  

  async getDocumentMarkdown(fileId: string): Promise<string> {
    return this.request<string>(`/files/${fileId}/markdown`)
  }


  async getReviewsWithFiles() {
    const [reviews, files] = await Promise.all([
      this.getReviews(),  // <- already unwraps the paging envelope
      this.getFiles(),
    ])
    return { reviews, files }
  }
  

  // Folders
  async getFolders() {
    return this.request('/folders')
  }

  // Real-time data
  async getReviewStats() {
    return this.request('/reviews/stats')
  }

  // Public method for mutations
  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    })
  }
}

const apiClient = new ApiClient()

// Query Keys for better cache management
export const queryKeys = {
  files: ['files'] as const,
  filesByFolder: (folderId: string) => ['files', 'folder', folderId] as const,
  reviews: ['reviews'] as const,
  review: (id: string) => ['reviews', id] as const,
  folders: ['folders'] as const,
  reviewsWithFiles: ['reviews-with-files'] as const,
  stats: ['stats'] as const,
}


// Optimized Hooks
export function useFiles() {
  return useQuery({
    queryKey: queryKeys.files,
    queryFn: () => apiClient.getFiles(),
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}
export function useAddColumn() {
    const queryClient = useQueryClient()
    
    return useMutation({
      mutationFn: async ({ reviewId, column }: { reviewId: string; column: NewColumn }) => {
        return apiClient.post(`/reviews/${reviewId}/columns`, column)
      },
      onSuccess: (_, { reviewId }) => {
        // Invalidate review to refetch with new column
        queryClient.invalidateQueries({ queryKey: queryKeys.review(reviewId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews })
      },
    })
  }
  
  export function useUpdateColumn() {
    const queryClient = useQueryClient()
    
    return useMutation({
      mutationFn: async ({ 
        reviewId, 
        columnId, 
        data 
      }: { 
        reviewId: string; 
        columnId: string; 
        data: any 
      }) => {
        return apiClient.put(`/reviews/${reviewId}/columns/${columnId}`, data)
      },
      onSuccess: (_, { reviewId }) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.review(reviewId) })
      },
    })
  }
  
  export function useDeleteColumn() {
    const queryClient = useQueryClient()
    
    return useMutation({
      mutationFn: async ({ reviewId, columnId }: { reviewId: string; columnId: string }) => {
        return apiClient.delete(`/reviews/${reviewId}/columns/${columnId}`)
      },
      onSuccess: (_, { reviewId }) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.review(reviewId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews })
      },
    })
  }
  
  // Document markdown query
  export function useDocumentMarkdown(fileId: string | null) {
    return useQuery({
      queryKey: ['document-markdown', fileId],
      queryFn: () => apiClient.getDocumentMarkdown(fileId!),
      enabled: !!fileId,
      staleTime: 1000 * 60 * 10, // 10 minutes - markdown rarely changes
    })
  }

  export function useBatchOperations() {
    const queryClient = useQueryClient()
    
    return {
      // Prefetch multiple reviews at once
      prefetchReviews: async (reviewIds: string[]) => {
        const promises = reviewIds.map(id =>
          queryClient.prefetchQuery({
            queryKey: queryKeys.review(id),
            queryFn: () => apiClient.getReview(id),
            staleTime: 1000 * 60 * 5,
          })
        )
        await Promise.all(promises)
      },
      
      // Invalidate multiple queries at once
      invalidateReviewData: (reviewId: string) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.review(reviewId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews })
        queryClient.invalidateQueries({ queryKey: queryKeys.reviewsWithFiles })
        queryClient.invalidateQueries({ queryKey: queryKeys.stats })
      },
    }
  }

  
export function useFilesByFolder(folderId: string | null) {
  return useQuery({
    queryKey: queryKeys.filesByFolder(folderId || ''),
    queryFn: () => folderId ? apiClient.getFilesByFolder(folderId) : apiClient.getFiles(),
    enabled: !!folderId,
    staleTime: 1000 * 60 * 2,
  })
}

export const useReviews = () => {
    const reviews = useRealtimeStore((state) => state.reviews)
    // Only return EMPTY_ARRAY if reviews is truly not an array
    // Empty arrays are fine and should be returned as-is
    return Array.isArray(reviews) ? reviews : EMPTY_ARRAY
  }
  

  export function useReview(id: string | null, includeResults = false) {
    return useQuery({
      queryKey: ['review', id, includeResults],   // include flag in the key
      queryFn: () => apiClient.getReview(id!, includeResults),
      enabled: !!id,
      staleTime: 30_000,
    });
  }
  

export function useFolders() {
  return useQuery({
    queryKey: queryKeys.folders,
    queryFn: () => apiClient.getFolders(),
    staleTime: 1000 * 60 * 10, // 10 minutes - folders rarely change
  })
}

// Batch query for reviews + files (faster initial load)
export function useReviewsWithFiles() {
  return useQuery({
    queryKey: queryKeys.reviewsWithFiles,
    queryFn: () => apiClient.getReviewsWithFiles(),
    staleTime: 1000 * 60 * 2,
  })
}

export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => apiClient.getReviewStats(),
    refetchInterval: 1000 * 30, // Real-time stats every 30 seconds
    staleTime: 1000 * 15,
  })
}

// Optimized mutations with automatic cache updates
export function useCreateReview() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: any): Promise<Review> => {
      return apiClient.post<Review>('/reviews/', data)
    },
    onSuccess: (newReview) => {
      // Optimistically update cache
      queryClient.setQueryData(queryKeys.review(newReview.id), newReview)   // seed detail cache
      queryClient.setQueryData(queryKeys.reviews, (old: Review[] = []) => 
        [...old, newReview]
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewsWithFiles })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
    },
  })
}

export function useAddDocuments() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ reviewId, fileIds }: { reviewId: string; fileIds: string[] }) => {
        return apiClient.post(`/reviews/${reviewId}/files`, { file_ids: fileIds })
    },
    onSuccess: (_, { reviewId }) => {
      // Invalidate specific review and related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.review(reviewId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
    },
  })
}

export function useStartAnalysis() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (reviewId: string) => {
        return apiClient.post(`/reviews/${reviewId}/analyze`, {})
    },
    onSuccess: (_, reviewId) => {
      // Update review status optimistically
      queryClient.setQueryData(queryKeys.review(reviewId), (old: Review | undefined) => 
        old ? { ...old, status: 'processing' } : old
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
    },
  })
}

// Prefetch helper for faster navigation
export function usePrefetch() {
  const queryClient = useQueryClient()
  
  return {
    prefetchReview: (id: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.review(id),
        queryFn: () => apiClient.getReview(id),
        staleTime: 1000 * 60 * 5,
      })
    },
    prefetchFiles: () => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.files,
        queryFn: () => apiClient.getFiles(),
        staleTime: 1000 * 60 * 5,
      })
    },
  }
} 


export const optimizedApiHooks = {
    // Queries
    useFiles,
    useFilesByFolder,
    useReviews,
    useReview,
    useFolders,
    useReviewsWithFiles,
    useStats,
    useDocumentMarkdown,
    
    // Mutations
    useCreateReview,
    useAddDocuments,
    useStartAnalysis,
    useAddColumn,
    useUpdateColumn,
    useDeleteColumn,
    
    // Utilities
    usePrefetch,
    useBatchOperations,
  }


  export const queryClientConfig = {
    defaultOptions: {
      queries: {
        // Stale time: how long until data is considered stale
        staleTime: 1000 * 60 * 5, // 5 minutes default
        
        // Cache time: how long to keep unused data in cache
        cacheTime: 1000 * 60 * 30, // 30 minutes
        
        // Retry configuration
        retry: (failureCount: number, error: any) => {
          if (error.status === 404) return false
          if (error.status === 401) return false
          return failureCount < 2
        },
        
        // Refetch on window focus
        refetchOnWindowFocus: false,
        
        // Background refetch interval
        refetchInterval: false,
      },
      mutations: {
        // Retry configuration for mutations
        retry: 1,
      },
    },
  }
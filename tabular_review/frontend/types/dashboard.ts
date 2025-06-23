export interface DashboardStats {
  totalDocuments: number
  totalReviews: number
  totalFolders: number
  recentDocuments: any[]
  recentReviews: any[]
}

export interface DashboardResponse {
  documents: any[]
  reviews: any[]
  folders: any[]
  stats: DashboardStats
  timestamp: string
  errors?: string[]
}

export interface DashboardError {
  error: string
  documents: any[]
  reviews: any[]
  folders: any[]
  stats: DashboardStats
} 
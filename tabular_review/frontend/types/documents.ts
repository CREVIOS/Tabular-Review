export interface DocumentsStats {
  totalFolders: number
  totalFiles: number
  totalSize: number
  averageFilesPerFolder?: number
}

export interface FileStats {
  total: number
  completed: number
  processing: number
  failed: number
  queued: number
}

export interface Folder {
  id: string
  name: string
  description: string | null
  color: string
  file_count: number
  total_size: number
  created_at: string
  updated_at: string
}

export interface File {
  id: string
  original_filename: string
  file_size: number
  status: 'queued' | 'processing' | 'completed' | 'failed'
  folder_id: string | null | undefined
  user_id: string
  file_type: string
  upload_date: string
  processed_date?: string
  file_path: string
  columns?: string[]
  row_count?: number
  error_message?: string | null
}

export interface DocumentsResponse {
  folders: Folder[]
  stats: DocumentsStats
  timestamp: string
}

export interface FolderDetailsResponse {
  folders: Folder[]
  files: File[]
  selectedFolder?: Folder
  fileStats: FileStats
  timestamp: string
  errors?: string[]
}

export interface DocumentsError {
  error: string
  folders: Folder[]
  stats: DocumentsStats
} 
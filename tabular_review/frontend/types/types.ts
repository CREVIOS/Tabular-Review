export interface User {
    id: string
    email: string
    full_name?: string
    is_active: boolean
    created_at: string
  }
  
  export interface FileRecord {
    id: string
    user_id: string
    original_filename: string
    file_size: number
    file_type?: string
    status: 'queued' | 'processing' | 'completed' | 'failed'
    created_at: string
    processed_at?: string
    error_message?: string
    total_chunks?: number
  }
  
  export interface MarkdownContent {
    id: string
    file_id: string
    content: string
    word_count?: number
    created_at: string
  }
  

  
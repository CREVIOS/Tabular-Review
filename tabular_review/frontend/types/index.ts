// types.ts - Updated with proper integration

export interface Review {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'queued' | 'processing' | 'completed' | 'error';
  total_files: number;
  total_columns: number;
  completion_percentage: number;
  created_at: string;
  folder_id: string | null;
  files?: ReviewFile[];
  columns?: ReviewColumn[];
  results?: ReviewResult[];
  error?: string;
}

export interface ReviewFile {
  file_id: string;
  filename: string;
  file_size?: number;
  status?: string;
  // Add these for compatibility
  id?: string; // Sometimes file_id is used as id
  name?: string; // Alternative to filename
}

export interface ReviewColumn {
  id: string;
  column_name: string;
  prompt: string;
  data_type: string;
  column_order: number;
}

export interface ReviewResult {
  file_id: string;
  column_id: string;
  extracted_value: string | null;
  confidence_score: number;
  source_reference: string;
  error?: boolean;
  timestamp?: number;
  status?: 'completed' | 'error';
}

export interface SelectedCell {
  reviewId: string;
  fileId: string;
  columnId: string;
  value: string | null;
  sourceRef: string;
  confidence: number | null;
  markdownContent?: string;
}

export interface File {
  id: string;
  original_filename: string;
  file_size: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  created_at: string;
  folder_id: string | null;
  // Add for compatibility
  name?: string; // Alternative name field
}

export interface NewReview {
  name: string;
  description: string;
  folder_id?: string;
  file_ids?: string[];
  columns: NewColumn[];
}

export interface NewColumn {
  column_name: string;
  prompt: string;
  data_type: string;
}

export interface SSEMessage {
  type: string;
  review_id?: string;
  file_id?: string;
  column_id?: string;
  message?: string;
  progress?: number;
  completion_percentage?: number;
  result?: {
    extracted_value: string | null;
    confidence_score: number;
    source_reference: string;
  };
  error?: string;
  status?: string;
}

// This should match what columns.tsx expects
export interface RealTimeUpdate extends Partial<ReviewResult> {
  extracted_value: string | null;
  confidence_score: number | undefined;
  source_reference: string;
  error?: boolean;
  timestamp?: number;
  processing?: boolean;
  status?: 'completed' | 'error';
}

export type RealTimeUpdates = Record<string, RealTimeUpdate>;

// Additional type for the data table
export interface ReviewTableRow {
  file: ReviewFile;
  fileName: string;
  fileStatus: string;
  results: Record<string, ReviewResult | null>;
}

  export interface TabularReviewResponse {
    id: string
    user_id: string
    name: string
    description?: string
    status: string
    review_scope: string
    folder_id?: string
    created_at: string
    updated_at: string
    last_processed_at?: string
    columns: Array<TabularReviewColumnResponse>
    files: Array<TabularReviewFileResponse>
    total_files: number
    total_columns: number
    completion_percentage: number
  }

  interface TabularReviewColumnResponse {
    id: string
    column_name: string
    prompt: string
    column_order: number
    data_type: string
    created_at: string
  }

  interface TabularReviewFileResponse {
    id: string
    file_id: string
    filename: string
    file_size?: number
    status: string
    added_at: string
  }
  

  export interface FileResponse {
    id: string
    user_id: string
    original_filename: string
    file_size?: number
    file_type?: string
    storage_path?: string
    storage_url?: string
    status: string
    created_at: string
    updated_at: string
    processed_at?: string
    error_message?: string
  }
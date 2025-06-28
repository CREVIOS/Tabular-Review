# Supabase Realtime Implementation for Tabular Reviews

This implementation replaces the WebSocket-based real-time updates with Supabase Realtime, providing a more robust and database-driven approach to real-time cell updates.

## Overview

The new implementation consists of:

1. **`supabaseRealtimeStore.ts`** - Zustand store for managing Supabase realtime connections and state
2. **`RealTimeReviewTable.tsx`** - Updated table component that uses Supabase realtime
3. **`SupabaseRealtimeExample.tsx`** - Example component showing how to use the implementation

## Key Features

### 🚀 **Database-Driven Structure**
- Automatically fetches review structure (columns, files) from Supabase
- No need to pass structure as props - it's loaded from the database
- Inspired by backend `get_review_structure()` function

### 🔄 **Real-time Updates**
- Subscribes to PostgreSQL changes on `tabular_review_results` table
- Updates cell data in real-time as analysis results come in
- Handles INSERT, UPDATE, and DELETE events

### 🛡️ **Robust Connection Management**
- Automatic reconnection handled by Supabase
- Better error handling and connection status tracking
- No manual WebSocket setup required

### ⚡ **Performance Optimized**
- O(1) cell data lookups using Map structure
- Memoized components to prevent unnecessary re-renders
- Virtual scrolling for large datasets

## How It Works

### 1. Connection Setup
```typescript
const { connect, disconnect } = useSupabaseRealtimeActions()

useEffect(() => {
  if (reviewId && connectionStatus === 'disconnected') {
    connect(reviewId).catch(console.error)
  }
  
  return () => disconnect()
}, [reviewId, connect, disconnect, connectionStatus])
```

### 2. Structure Fetching
The store automatically fetches:
- **Columns**: `tabular_review_columns` table
- **Files**: `tabular_review_files` table with file details
- **Review**: `tabular_reviews` table for metadata
- **Existing Results**: `tabular_review_results` table for initial data

### 3. Real-time Subscription
```typescript
const channel = supabase
  .channel(`review-${reviewId}-results`)
  .on(
    'postgres_changes',
    { 
      event: '*', 
      schema: 'public', 
      table: 'tabular_review_results',
      filter: `review_id=eq.${reviewId}`
    },
    (payload) => {
      // Handle real-time updates
    }
  )
  .subscribe()
```

### 4. Cell Data Management
- Each cell is identified by `fileId:columnId` key
- Cell data includes: value, confidence, status, timestamp, source
- Status can be: 'pending', 'processing', 'completed', 'error'

## Usage

### Basic Usage
```typescript
import RealTimeReviewTable from '@/components/review-table/RealTimeReviewtable'

function ReviewPage({ reviewId }: { reviewId: string }) {
  return (
    <RealTimeReviewTable 
      reviewStructure={null} // Will use store structure
      onExport={() => {}}
      reviewId={reviewId}
    />
  )
}
```

### Advanced Usage with Custom Structure
```typescript
import RealTimeReviewTable from '@/components/review-table/RealTimeReviewtable'

function ReviewPage({ reviewId, customStructure }: { 
  reviewId: string
  customStructure?: any 
}) {
  return (
    <RealTimeReviewTable 
      reviewStructure={customStructure} // Fallback structure
      onExport={() => {}}
      reviewId={reviewId}
    />
  )
}
```

### Using Cell Data Directly
```typescript
import { useCellData } from '@/store/supabaseRealtimeStore'

function CustomCell({ fileId, columnId }: { fileId: string, columnId: string }) {
  const cellData = useCellData(fileId, columnId)
  
  if (!cellData) return <div>Loading...</div>
  
  return (
    <div>
      <span>{cellData.value || 'No data'}</span>
      <span>{Math.round(cellData.confidence * 100)}%</span>
    </div>
  )
}
```

## Store API

### Hooks
- `useReviewStructure()` - Get current review structure
- `useConnectionStatus()` - Get connection status
- `useCellData(fileId, columnId)` - Get specific cell data
- `useSupabaseRealtimeActions()` - Get connection actions

### Actions
- `connect(reviewId)` - Connect to a review
- `disconnect()` - Disconnect from current review
- `addFiles(reviewId, fileIds)` - Add files to review
- `addColumn(reviewId, columnData)` - Add column to review

### State
- `connectionStatus` - 'connecting' | 'connected' | 'disconnected' | 'error'
- `reviewStructure` - Current review structure
- `cellData` - Map of cell data by key

## Migration from WebSocket

### Before (WebSocket)
```typescript
import { useWebSocketStore } from '@/store/webSocketStore'

// Required token for connection
const { connect } = useWebSocketActions()
connect(reviewId, token)

// Manual structure management
const reviewStructure = useReviewStructure()
```

### After (Supabase Realtime)
```typescript
import { useSupabaseRealtimeActions } from '@/store/supabaseRealtimeStore'

// No token required - uses Supabase client auth
const { connect } = useSupabaseRealtimeActions()
connect(reviewId)

// Automatic structure fetching
const reviewStructure = useReviewStructure()
```

## Benefits

1. **Simplified Setup**: No WebSocket URL configuration or token management
2. **Better Reliability**: Supabase handles reconnection and error recovery
3. **Database Consistency**: Structure is always in sync with database
4. **Reduced Complexity**: Less custom connection logic
5. **Better Performance**: Optimized data structures and memoization
6. **Type Safety**: Full TypeScript support with database types

## Configuration

### Environment Variables
Ensure your Supabase client is properly configured:
```typescript
// lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js'

export const createClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Database Permissions
Ensure your Supabase RLS policies allow:
- Reading from `tabular_reviews`, `tabular_review_columns`, `tabular_review_files`
- Reading from `tabular_review_results`
- Real-time subscriptions on `tabular_review_results`

## Troubleshooting

### Connection Issues
1. Check Supabase client configuration
2. Verify database permissions
3. Check browser console for errors
4. Ensure review ID is valid

### Missing Updates
1. Verify real-time is enabled in Supabase dashboard
2. Check that `tabular_review_results` table has proper triggers
3. Ensure review_id filter is working correctly

### Performance Issues
1. Check for memory leaks in component unmounting
2. Verify virtual scrolling is working for large datasets
3. Monitor cell data map size

## Example Implementation

See `SupabaseRealtimeExample.tsx` for a complete working example that demonstrates all features of the implementation. 

# RealTimeReviewTable Component

## Overview

The `RealTimeReviewTable` component is a fully independent, self-contained table component that fetches data directly from Supabase and provides real-time updates. It no longer depends on external `reviewStructure` props and handles all data fetching internally.

## Features

- **Independent Data Fetching**: Fetches columns, files, and results directly from Supabase
- **Real-time Updates**: Uses Supabase real-time subscriptions to update cells as they are processed
- **Optimized Performance**: Uses virtualization for large datasets and memoized components
- **Live Cell Updates**: Shows real-time progress with animations and visual feedback
- **Completion Statistics**: Displays progress bars and detailed statistics
- **Error Handling**: Graceful error states and loading indicators

## Usage

```tsx
import RealTimeReviewTable from '@/components/review-table/RealTimeReviewtable'

function ReviewPage({ reviewId }: { reviewId: string }) {
  const handleExport = () => {
    // Handle export logic
    console.log('Exporting review data...')
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Review Analysis</h1>
      
      <RealTimeReviewTable 
        reviewId={reviewId}
        onExport={handleExport}
      />
    </div>
  )
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `reviewId` | `string` | Yes | The ID of the review to display |
| `onExport` | `() => void` | Yes | Callback function for export button |

## How It Works

### 1. Initial Data Fetching
- Fetches columns from `tabular_review_columns` table
- Fetches files from `tabular_review_files` table with file details
- Fetches existing results from `tabular_review_results` table
- Initializes cell data store with existing results and pending cells

### 2. Real-time Subscriptions
- **Columns Channel**: Listens for column additions, updates, and deletions
- **Files Channel**: Listens for file additions and deletions
- **Results Channel**: Listens for new analysis results and updates

### 3. Cell Updates
- Each cell is managed independently with its own state
- Real-time updates trigger animations and visual feedback
- New cells automatically scroll into view
- Confidence scores are displayed with color-coded progress bars

### 4. Performance Optimizations
- Virtual scrolling for large datasets
- Memoized components to prevent unnecessary re-renders
- Efficient cell data store using Map for O(1) lookups
- Debounced animations and updates

## Database Schema Requirements

The component expects the following Supabase tables:

### tabular_review_columns
```sql
- id (uuid, primary key)
- review_id (uuid, foreign key)
- column_name (text)
- prompt (text)
- column_order (integer)
- data_type (text)
- created_at (timestamp)
```

### tabular_review_files
```sql
- id (uuid, primary key)
- review_id (uuid, foreign key)
- file_id (uuid, foreign key to files table)
- added_at (timestamp)
```

### tabular_review_results
```sql
- id (uuid, primary key)
- review_id (uuid, foreign key)
- file_id (uuid, foreign key)
- column_id (uuid, foreign key)
- extracted_value (text, nullable)
- confidence_score (float, nullable)
- source_reference (text, nullable)
- created_at (timestamp)
- updated_at (timestamp)
```

### files (referenced by tabular_review_files)
```sql
- id (uuid, primary key)
- original_filename (text)
- file_size (integer)
- status (text)
```

## Real-time Features

### Cell Status Tracking
- **Pending**: Gray placeholder with pulse animation
- **Processing**: Loading spinner with "Analyzing..." text
- **Completed**: Value with confidence bar and green highlight
- **Error**: Red error icon with error message

### Visual Feedback
- New cells get blue border and background
- Updated cells get green highlight and scale animation
- Confidence bars with color coding (green/yellow/red)
- Smooth scrolling to new cells

### Statistics Display
- Progress bar showing completion percentage
- Count of completed, processing, and error cells
- High confidence results count
- Average confidence score

## Error Handling

- Network errors show error state with retry option
- Missing data shows appropriate empty states
- Invalid review IDs show error message
- Graceful degradation for missing file details

## Performance Considerations

- Virtual scrolling handles thousands of rows efficiently
- Cell data is cached in memory for fast access
- Real-time updates are batched and optimized
- Animations use CSS transitions for smooth performance
- Large datasets are handled with pagination-like virtualization

## Customization

The component uses Tailwind CSS classes and can be customized by:
- Modifying the styling classes
- Adjusting animation durations
- Changing color schemes
- Customizing the export functionality
- Adding additional statistics or features 
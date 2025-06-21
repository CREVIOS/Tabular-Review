import React from 'react'
import { X, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NewColumn, Review } from '../types'

interface AddColumnModalProps {
  isOpen: boolean
  review: Review | null
  newColumn: NewColumn
  isLoading: boolean
  onClose: () => void
  onUpdateColumn: (column: NewColumn) => void
  onSubmit: () => void
  isMobile?: boolean
}

export const AddColumnModal: React.FC<AddColumnModalProps> = ({
  isOpen,
  review,
  newColumn,
  isLoading,
  onClose,
  onUpdateColumn,
  onSubmit,
  isMobile = false
}) => {
  if (!isOpen || !review) return null

  const canSubmit = newColumn.column_name && newColumn.prompt && !isLoading

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg w-full ${isMobile ? 'max-w-[95vw] max-h-[85vh]' : 'max-w-md'} flex flex-col`}>
        <div className={`flex items-center justify-between border-b border-gray-200 ${isMobile ? 'p-4' : 'p-4'}`}>
          <h3 className={`font-semibold ${isMobile ? 'text-lg' : 'text-lg'}`}>Add New Column</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="touch-target">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className={`flex-1 overflow-y-auto space-y-4 ${isMobile ? 'p-4' : 'p-4'}`}>
          <div>
            <label className={`block font-medium mb-2 ${isMobile ? 'text-sm' : 'text-sm'}`}>Column Name</label>
            <Input
              placeholder="e.g., 'Contract Value'"
              value={newColumn.column_name}
              onChange={(e) => onUpdateColumn({ ...newColumn, column_name: e.target.value })}
              className={`touch-target ${isMobile ? 'h-11 text-base' : ''}`}
            />
          </div>
          <div>
            <label className={`block font-medium mb-2 ${isMobile ? 'text-sm' : 'text-sm'}`}>Analysis Prompt</label>
            <Textarea
              placeholder="e.g., 'Extract the total contract value in USD'"
              value={newColumn.prompt}
              onChange={(e) => onUpdateColumn({ ...newColumn, prompt: e.target.value })}
              rows={isMobile ? 4 : 3}
              className={`touch-target ${isMobile ? 'text-base' : ''}`}
            />
          </div>
          <div className={`bg-blue-50 p-3 rounded ${isMobile ? 'text-sm' : 'text-sm text-gray-600'}`}>
            <p><strong>Note:</strong> This column will be analyzed for all {review.total_files || 0} documents in this review.</p>
          </div>
        </div>
        <div className={`flex ${isMobile ? 'flex-col' : 'justify-end'} gap-3 border-t border-gray-200 bg-gray-50 ${isMobile ? 'p-4' : 'p-4'}`}>
          <Button 
            variant="outline" 
            onClick={onClose}
            className={`touch-target ${isMobile ? 'h-11' : ''}`}
          >
            Cancel
          </Button>
          <Button 
            onClick={onSubmit}
            disabled={!canSubmit}
            className={`touch-target ${isMobile ? 'h-11' : ''}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Add Column
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
} 
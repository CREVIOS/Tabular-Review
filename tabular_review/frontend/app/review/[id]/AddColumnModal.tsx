// AddColumnModal.tsx - Column creation modal with validation and error handling
import React, { useState, useCallback, useEffect } from 'react'
import { X, Plus, AlertCircle, CheckCircle, Loader2, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface AddColumnModalProps {
  isOpen: boolean
  onClose: () => void
  reviewId: string
  existingColumns: string[]
}

interface FormData {
  column_name: string
  prompt: string
  data_type: 'text' | 'number' | 'date' | 'boolean' | 'currency' | 'percentage'
}



const DATA_TYPE_OPTIONS = [
  { value: 'text', label: 'Text', description: 'General text content' },
  { value: 'number', label: 'Number', description: 'Numeric values' },
  { value: 'date', label: 'Date', description: 'Dates (YYYY-MM-DD format)' },
  { value: 'boolean', label: 'Yes/No', description: 'True/false values' },
  { value: 'currency', label: 'Currency', description: 'Monetary amounts' },
  { value: 'percentage', label: 'Percentage', description: 'Percentage values' }
]

const EXAMPLE_PROMPTS = [
  {
    name: 'Company Name',
    prompt: 'Extract the primary company or organization name mentioned in this document',
    type: 'text'
  },
  {
    name: 'Total Amount',
    prompt: 'Find the total monetary amount, sum, or final cost mentioned in the document',
    type: 'currency'
  },
  {
    name: 'Contract Date',
    prompt: 'Extract the contract date, agreement date, or effective date from the document',
    type: 'date'
  },
  {
    name: 'Is Signed',
    prompt: 'Determine if this document has been signed or contains signatures',
    type: 'boolean'
  },
  {
    name: 'Revenue',
    prompt: 'Extract the annual revenue, total revenue, or income figure from the document',
    type: 'currency'
  },
  {
    name: 'Document Type',
    prompt: 'Identify the type of document (e.g., contract, invoice, report, agreement)',
    type: 'text'
  }
]

export default function AddColumnModal({ 
  isOpen, 
  onClose, 
  reviewId, 
  existingColumns 
}: AddColumnModalProps) {
  const [formData, setFormData] = useState<FormData>({
    column_name: '',
    prompt: '',
    data_type: 'text'
  })
  const [errors, setErrors] = useState<Partial<FormData>>({})
  const [showExamples, setShowExamples] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        column_name: '',
        prompt: '',
        data_type: 'text'
      })
      setErrors({})
      setLocalError(null)
      setShowExamples(false)
      setLoading(false)
      setSuccess(false)
    }
  }, [isOpen])
  
  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<FormData> = {}
    
    // Column name validation
    if (!formData.column_name.trim()) {
      newErrors.column_name = 'Column name is required'
    } else if (formData.column_name.trim().length < 2) {
      newErrors.column_name = 'Column name must be at least 2 characters'
    } else if (formData.column_name.trim().length > 50) {
      newErrors.column_name = 'Column name must be less than 50 characters'
    } else if (existingColumns.some(col => 
      col.toLowerCase() === formData.column_name.trim().toLowerCase()
    )) {
      newErrors.column_name = 'Column name already exists'
    }
    
    // Prompt validation
    if (!formData.prompt.trim()) {
      newErrors.prompt = 'Analysis prompt is required'
    } else if (formData.prompt.trim().length < 10) {
      newErrors.prompt = 'Prompt must be at least 10 characters'
    } else if (formData.prompt.trim().length > 500) {
      newErrors.prompt = 'Prompt must be less than 500 characters'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData, existingColumns])
  
  // Handle input changes
  const handleInputChange = useCallback((field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
    
    setLocalError(null)
  }, [errors])
  
  // Handle example selection
  const handleExampleSelect = useCallback((example: typeof EXAMPLE_PROMPTS[0]) => {
    setFormData({
      column_name: example.name,
      prompt: example.prompt,
      data_type: example.type as FormData['data_type']
    })
    setErrors({})
    setShowExamples(false)
  }, [])
  
  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setLoading(true)
    setLocalError(null)
    setSuccess(false)
    try {
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        setLoading(false)
        setLocalError('Authentication error. Please log in again.')
        return
      }
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const res = await fetch(`${backendUrl}/api/reviews/${reviewId}/columns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          column_name: formData.column_name.trim(),
          prompt: formData.prompt.trim(),
          data_type: formData.data_type
        })
      })
      if (!res.ok) {
        let msg = 'Failed to add column.'
        try {
          const err = await res.json()
          msg = err.detail || err.message || msg
        } catch {}
        setLoading(false)
        setLocalError(msg)
        return
      }
      // Success
      setSuccess(true)
      setTimeout(() => {
        setLoading(false)
        setSuccess(false)
        onClose()
      }, 1200)
    } catch (err) {
      setLoading(false)
      setLocalError(err instanceof Error ? err.message : 'Failed to add column')
    }
  }, [formData, reviewId, validateForm, onClose])
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Add Column</h2>
            <p className="text-sm text-gray-600 mt-1">
              Create a new data extraction column for your review
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Success Indicator */}
        {success && (
          <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-800">Column added successfully! Analysis in progress...</span>
          </div>
        )}
        
        {/* Error Indicator */}
        {localError && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-800">{localError}</span>
          </div>
        )}
        
        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Example Templates */}
            <div className="bg-gray-50 rounded-lg p-4">
              <button
                type="button"
                onClick={() => setShowExamples(!showExamples)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <Info className="h-4 w-4" />
                {showExamples ? 'Hide' : 'Show'} Example Templates
              </button>
              
              {showExamples && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EXAMPLE_PROMPTS.map((example, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleExampleSelect(example)}
                      className="text-left p-3 bg-white rounded border hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="font-medium text-sm text-gray-900">{example.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{example.type}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Column Name */}
            <div>
              <label htmlFor="column_name" className="block text-sm font-medium text-gray-700 mb-2">
                Column Name *
              </label>
              <input
                id="column_name"
                type="text"
                value={formData.column_name}
                onChange={(e) => handleInputChange('column_name', e.target.value)}
                placeholder="e.g., Company Name, Total Amount, Contract Date"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.column_name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                maxLength={50}
              />
              {errors.column_name && (
                <div className="mt-1 flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  {errors.column_name}
                </div>
              )}
              <div className="mt-1 text-xs text-gray-500">
                {formData.column_name.length}/50 characters
              </div>
            </div>
            
            {/* Data Type */}
            <div>
              <label htmlFor="data_type" className="block text-sm font-medium text-gray-700 mb-2">
                Data Type *
              </label>
              <select
                id="data_type"
                value={formData.data_type}
                onChange={(e) => handleInputChange('data_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {DATA_TYPE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Prompt */}
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                Analysis Prompt *
              </label>
              <textarea
                id="prompt"
                value={formData.prompt}
                onChange={(e) => handleInputChange('prompt', e.target.value)}
                placeholder="Describe exactly what information you want to extract from each document. Be specific and clear about what to look for."
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none ${
                  errors.prompt ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                maxLength={500}
              />
              {errors.prompt && (
                <div className="mt-1 flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  {errors.prompt}
                </div>
              )}
              <div className="mt-1 text-xs text-gray-500">
                {formData.prompt.length}/500 characters
              </div>
            </div>
            
            {/* Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Tips for Better Results</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Be specific about what you&apos;re looking for</li>
                <li>• Mention alternative terms (e.g., &quot;company name or organization&quot;)</li>
                <li>• Specify format when relevant (e.g., &quot;date in MM/DD/YYYY format&quot;)</li>
                <li>• Consider edge cases (e.g., &quot;if no amount is found, return 0&quot;)</li>
              </ul>
            </div>
          </form>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="flex items-center gap-2 text-red-600">
            {/* Error already shown above */}
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!formData.column_name.trim() || !formData.prompt.trim() || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add Column
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
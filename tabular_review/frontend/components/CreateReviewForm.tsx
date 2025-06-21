import React, { useState } from 'react'
import { Plus, Trash2, X, Sparkles, FileText, Target, Wand2, CheckCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NewReview } from '../types'

interface CreateReviewFormProps {
  newReview: NewReview
  selectedFiles: string[]
  onUpdateReview: (review: NewReview) => void
  onCancel: () => void
  onCreate: () => void
}

export const CreateReviewForm: React.FC<CreateReviewFormProps> = ({
  newReview,
  selectedFiles,
  onUpdateReview,
  onCancel,
  onCreate
}) => {
  const [currentStep, setCurrentStep] = useState(1)
  const [isCreating, setIsCreating] = useState(false)

  const addColumn = () => {
    onUpdateReview({
      ...newReview,
      columns: [...newReview.columns, { column_name: '', prompt: '', data_type: 'text' }]
    })
  }

  const updateColumn = (index: number, field: keyof NewReview['columns'][0], value: string) => {
    const updatedColumns = [...newReview.columns]
    updatedColumns[index][field] = value
    onUpdateReview({ ...newReview, columns: updatedColumns })
  }

  const removeColumn = (index: number) => {
    const updatedColumns = newReview.columns.filter((_, i) => i !== index)
    onUpdateReview({ ...newReview, columns: updatedColumns })
  }

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      await onCreate()
    } finally {
      setIsCreating(false)
    }
  }

  // Validation
  const isStep1Valid = newReview.name.trim().length > 0
  const isStep2Valid = newReview.columns.every(col => col.column_name.trim() && col.prompt.trim())
  const canCreate = isStep1Valid && isStep2Valid && selectedFiles.length > 0

  const steps = [
    { id: 1, title: 'Review Details', description: 'Name and describe your review' },
    { id: 2, title: 'Analysis Columns', description: 'Define what data to extract' },
    { id: 3, title: 'Review & Create', description: 'Confirm and start analysis' }
  ]

  const getCurrentStepStatus = (stepId: number) => {
    if (stepId < currentStep) return 'completed'
    if (stepId === currentStep) return 'current'
    return 'upcoming'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Create New Review</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Set up AI-powered analysis to extract structured data from your documents
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-8">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                      getCurrentStepStatus(step.id) === 'completed'
                        ? 'bg-green-500 border-green-500 text-white'
                        : getCurrentStepStatus(step.id) === 'current'
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}>
                      {getCurrentStepStatus(step.id) === 'completed' ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : (
                        <span className="text-sm font-bold">{step.id}</span>
                      )}
                    </div>
                    <div className="mt-2 text-center">
                      <div className={`text-sm font-medium ${
                        getCurrentStepStatus(step.id) === 'current' ? 'text-blue-600' : 'text-gray-600'
                      }`}>
                        {step.title}
                      </div>
                      <div className="text-xs text-gray-500 max-w-24">
                        {step.description}
                      </div>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-16 h-0.5 mx-4 ${
                      getCurrentStepStatus(step.id) === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Form Card */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  currentStep === 1 ? 'bg-blue-100 text-blue-600' :
                  currentStep === 2 ? 'bg-green-100 text-green-600' :
                  'bg-purple-100 text-purple-600'
                }`}>
                  {currentStep === 1 ? <FileText className="h-5 w-5" /> :
                   currentStep === 2 ? <Target className="h-5 w-5" /> :
                   <Wand2 className="h-5 w-5" />}
                </div>
                <CardTitle className="text-xl">
                  {steps[currentStep - 1]?.title}
                </CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onCancel}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Step 1: Review Details */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-in slide-in-from-right duration-300">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Let's start with the basics</h3>
                  <p className="text-gray-600">Give your review a clear name and description</p>
                </div>

                <div className="space-y-6 max-w-2xl mx-auto">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Review Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g., Contract Analysis Review, Invoice Processing, etc."
                      value={newReview.name}
                      onChange={(e) => onUpdateReview({ ...newReview, name: e.target.value })}
                      className="h-12 text-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                    {newReview.name && (
                      <div className="mt-2 flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Looks good!</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Description <span className="text-gray-400">(Optional)</span>
                    </label>
                    <Textarea
                      placeholder="Brief description of what this review will analyze..."
                      value={newReview.description}
                      onChange={(e) => onUpdateReview({ ...newReview, description: e.target.value })}
                      rows={3}
                      className="text-base border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  {/* Selected Files Preview */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <h4 className="font-semibold text-blue-900">Selected Documents</h4>
                    </div>
                    <p className="text-blue-700 text-sm mb-3">
                      <span className="font-bold">{selectedFiles.length}</span> document{selectedFiles.length !== 1 ? 's' : ''} ready for analysis
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-700 font-medium">All files validated and ready</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Analysis Columns */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right duration-300">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Define your analysis columns</h3>
                  <p className="text-gray-600">Tell the AI what specific data to extract from each document</p>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-gray-900">Analysis Columns</h4>
                    <Button 
                      variant="outline" 
                      onClick={addColumn}
                      className="bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Column
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {newReview.columns.map((column, index) => (
                      <div key={index} className="group">
                        <div className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-300 transition-all duration-200 bg-white">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                            </div>
                            
                            <div className="flex-1 space-y-4">
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  Column Name <span className="text-red-500">*</span>
                                </label>
                                <Input
                                  placeholder="e.g., Contract Value, Company Name, Due Date"
                                  value={column.column_name}
                                  onChange={(e) => updateColumn(index, 'column_name', e.target.value)}
                                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  Analysis Prompt <span className="text-red-500">*</span>
                                </label>
                                <Textarea
                                  placeholder="e.g., Extract the total contract value in USD format, Find the company name mentioned in the header"
                                  value={column.prompt}
                                  onChange={(e) => updateColumn(index, 'prompt', e.target.value)}
                                  rows={2}
                                  className="border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                />
                              </div>

                              {/* Validation Feedback */}
                              {column.column_name && column.prompt && (
                                <div className="flex items-center gap-2 text-green-600">
                                  <CheckCircle className="h-4 w-4" />
                                  <span className="text-sm font-medium">Column configured correctly</span>
                                </div>
                              )}
                            </div>

                            {newReview.columns.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeColumn(index)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Column Tips */}
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
                    <h5 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Pro Tips for Better Results
                    </h5>
                    <ul className="space-y-2 text-sm text-purple-800">
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500">•</span>
                        <span>Be specific in your prompts (e.g., "Extract contract value in USD" vs "Find money")</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500">•</span>
                        <span>Include format preferences (e.g., "Date in MM/DD/YYYY format")</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500">•</span>
                        <span>Use clear column names that describe the data (e.g., "Invoice Total" not "Amount")</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Review & Create */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-in slide-in-from-right duration-300">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Ready to launch your review!</h3>
                  <p className="text-gray-600">Review your configuration and start the AI analysis</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Review Details Summary */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
                    <h4 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Review Details
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm text-blue-700 font-medium">Name:</span>
                        <p className="font-semibold text-blue-900">{newReview.name}</p>
                      </div>
                      {newReview.description && (
                        <div>
                          <span className="text-sm text-blue-700 font-medium">Description:</span>
                          <p className="text-blue-800 text-sm">{newReview.description}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-sm text-blue-700 font-medium">Documents:</span>
                        <p className="font-semibold text-blue-900">{selectedFiles.length} files</p>
                      </div>
                    </div>
                  </div>

                  {/* Columns Summary */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6">
                    <h4 className="font-bold text-green-900 mb-4 flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Analysis Columns
                    </h4>
                    <div className="space-y-2">
                      {newReview.columns.map((column, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="w-5 h-5 bg-green-500 text-white rounded text-xs flex items-center justify-center font-bold">
                            {index + 1}
                          </span>
                          <span className="font-medium text-green-900 text-sm">{column.column_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Expected Results */}
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
                  <h4 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
                    <Wand2 className="h-5 w-5" />
                    What happens next?
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">1</div>
                      <span className="text-purple-800 text-sm font-medium">AI analyzes each document</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">2</div>
                      <span className="text-purple-800 text-sm font-medium">Extracts structured data</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">3</div>
                      <span className="text-purple-800 text-sm font-medium">Creates tabular results</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-8 border-t border-gray-200">
              <div className="flex gap-3">
                {currentStep > 1 && (
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="px-6"
                  >
                    Previous
                  </Button>
                )}
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={onCancel}
                  className="px-6"
                >
                  Cancel
                </Button>
                
                {currentStep < 3 ? (
                  <Button
                    onClick={() => setCurrentStep(currentStep + 1)}
                    disabled={
                      (currentStep === 1 && !isStep1Valid) ||
                      (currentStep === 2 && !isStep2Valid)
                    }
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-6"
                  >
                    Next Step
                  </Button>
                ) : (
                  <Button
                    onClick={handleCreate}
                    disabled={!canCreate || isCreating}
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 px-8 shadow-lg hover:shadow-xl transition-all"
                  >
                    {isCreating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Create Review
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
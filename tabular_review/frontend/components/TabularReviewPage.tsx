// 'use client'
// import React, { useState, useEffect } from 'react'
// import { RefreshCw, FileText, Table, Sparkles, FolderOpen } from 'lucide-react'
// import { Alert, AlertDescription } from '@/components/ui/alert'

// // Enhanced Components (from our artifacts)
// import EnhancedFileList from '@/components/FileList'
// import EnhancedCreateReview from '@/components/CreateReview'
// import { AddDocumentsModal } from '@/components/AddDocumentsModal'

// // Existing Components (from your codebase)
// import { ReviewList } from '@/components/ReviewList'
// import { ReviewTable } from '@/components/ReviewTable'
// import { DocumentViewer } from '@/components/DocumentViewer'
// import { AddColumnModal } from '@/components/AddColumnModal'

// // Types
// import { 
//   Review, 
//   File, 
//   NewReview, 
//   NewColumn, 
//   SelectedCell, 
//   RealTimeUpdates, 
//   SSEMessage 
// } from '../types'

// // Hooks
// import { useApi } from '../hooks/useApi'
// import { useSSE } from '../hooks/useSSE'

// interface TabularReviewPageProps {
//   reviewId?: string
//   onBack?: () => void
//   folderContext?: {
//     folderId: string
//     folderName: string
//     folderColor: string
//   }
// }

// export default function TabularReviewPage({ reviewId: initialReviewId, onBack, folderContext }: TabularReviewPageProps) {
//   // Main state
//   const [files, setFiles] = useState<File[]>([])
//   const [reviews, setReviews] = useState<Review[]>([])
//   const [selectedReview, setSelectedReview] = useState<Review | null>(null)
//   const [selectedFiles, setSelectedFiles] = useState<string[]>([])
//   const [searchQuery, setSearchQuery] = useState('')
  
//   // UI state
//   const [isCreatingReview, setIsCreatingReview] = useState(false)
//   const [showDocumentViewer, setShowDocumentViewer] = useState(false)
//   const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)
  
//   // Modal states
//   const [showAddColumnModal, setShowAddColumnModal] = useState(false)
//   const [showAddDocumentsModal, setShowAddDocumentsModal] = useState(false)
//   const [isAddingColumn, setIsAddingColumn] = useState(false)
//   const [isAddingDocuments, setIsAddingDocuments] = useState(false)
  
//   // Real-time updates
//   const [realTimeUpdates, setRealTimeUpdates] = useState<RealTimeUpdates>({})
//   const [processingCells, setProcessingCells] = useState(new Set<string>())
  
//   // Form states
//   const [newReview, setNewReview] = useState<NewReview>({
//     name: '',
//     description: '',
//     columns: [{ column_name: '', prompt: '', data_type: 'text' }]
//   })

//   const [newColumn, setNewColumn] = useState<NewColumn>({ 
//     column_name: '', 
//     prompt: '', 
//     data_type: 'text' 
//   })
  
//   const [selectedNewFiles, setSelectedNewFiles] = useState<string[]>([])

//   // API hooks
//   const {
//     loading,
//     error,
//     setError,
//     fetchFiles,
//     fetchReviews,
//     fetchDetailedReview,
//     createReview,
//     startAnalysis,
//     addColumnToReview,
//     addDocumentsToReview,
//     fetchDocumentMarkdown
//   } = useApi()

//   // SSE Message handler
//   const handleSSEMessage = (data: SSEMessage) => {
//     console.log('SSE message received in main component:', data)
//   }

//   // SSE hook
//   const { connectToSSE, disconnect } = useSSE({
//     onMessage: handleSSEMessage,
//     setSelectedReview,
//     setReviews,
//     setRealTimeUpdates,
//     setProcessingCells,
//     setError,
//     selectedReview,
//     fetchDetailedReview: async (reviewId: string) => {
//       const detailedReview = await fetchDetailedReview(reviewId)
//       if (detailedReview) {
//         setSelectedReview(detailedReview)
//         setReviews(prev => prev.map(review => 
//           review.id === reviewId ? { ...review, ...detailedReview } : review
//         ))
//       }
//     }
//   })

//   // Initialize data
//   useEffect(() => {
//     const loadData = async () => {
//       const [filesData, reviewsData] = await Promise.all([
//         fetchFiles(),
//         fetchReviews()
//       ])
//       setFiles(filesData)
//       setReviews(reviewsData)
      
//       // If we have an initial review ID, load that review
//       if (initialReviewId) {
//         const detailedReview = await fetchDetailedReview(initialReviewId)
//         if (detailedReview) {
//           setSelectedReview(detailedReview)
//           if (detailedReview.status === 'processing') {
//             connectToSSE(detailedReview.id)
//           }
//         }
//       }
//     }
    
//     loadData()
    
//     return () => {
//       disconnect()
//     }
//   }, [fetchFiles, fetchReviews, disconnect, initialReviewId])

//   // File selection handlers
//   const handleFileSelection = (fileId: string) => {
//     setSelectedFiles(prev => 
//       prev.includes(fileId) 
//         ? prev.filter(id => id !== fileId)
//         : [...prev, fileId]
//     )
//   }

//   const handleNewFileSelection = (fileId: string) => {
//     setSelectedNewFiles(prev => 
//       prev.includes(fileId) 
//         ? prev.filter(id => id !== fileId)
//         : [...prev, fileId]
//     )
//   }

//   // Enhanced review handlers
//   const handleCreateReview = (folderId?: string, fileIds?: string[]) => {
//     if (folderId || (fileIds && fileIds.length > 0)) {
//       // Pre-populate with folder/file selection
//       setSelectedFiles(fileIds || [])
//     }
//     setIsCreatingReview(true)
//   }

//   const handleReviewCreated = (reviewId: string) => {
//     // Fetch the created review and show it
//     fetchDetailedReview(reviewId).then(review => {
//       if (review) {
//         setSelectedReview(review)
//         setReviews(prev => [review, ...prev.filter(r => r.id !== reviewId)])
//         setIsCreatingReview(false)
//         connectToSSE(reviewId)
//       }
//     })
//   }

//   const handleStartAnalysis = async (reviewId: string) => {
//     const success = await startAnalysis(reviewId)
//     if (success) {
//       setSelectedReview(prev => prev ? { ...prev, status: 'processing' } : prev)
//       setReviews(prev => prev.map(review => 
//         review.id === reviewId ? { ...review, status: 'processing' } : review
//       ))
//       connectToSSE(reviewId)
//     }
//   }

//   const handleSelectReview = async (review: Review) => {
//     const detailedReview = await fetchDetailedReview(review.id)
//     if (detailedReview) {
//       setSelectedReview(detailedReview)
      
//       // Sync file selection with review files
//       const reviewFileIds = detailedReview.files?.map(f => f.file_id) || []
//       setSelectedFiles(reviewFileIds)
      
//       if (detailedReview.status === 'processing') {
//         connectToSSE(detailedReview.id)
//       }
//     }
//   }

//   const handleBackToList = () => {
//     if (onBack) {
//       onBack()
//     } else {
//       setSelectedReview(null)
//       setIsCreatingReview(false)
//       setRealTimeUpdates({})
//       setSelectedFiles([])
//       disconnect()
//     }
//   }

//   // Cell click handler
//   const handleCellClick = async (reviewId: string, fileId: string, columnId: string, result: any) => {
//     if (!result || !result.extracted_value) return
    
//     const markdownContent = await fetchDocumentMarkdown(fileId)
//     setSelectedCell({ 
//       reviewId, 
//       fileId, 
//       columnId, 
//       value: result.extracted_value,
//       sourceRef: result.source_reference || 'No source reference',
//       confidence: result.confidence_score,
//       markdownContent
//     })
//     setShowDocumentViewer(true)
//   }

//   // Column handlers
//   const handleAddColumn = async () => {
//     if (!selectedReview) return
    
//     setIsAddingColumn(true)
//     connectToSSE(selectedReview.id) // Connect before request
    
//     const success = await addColumnToReview(selectedReview.id, newColumn)
//     if (success) {
//       setNewColumn({ column_name: '', prompt: '', data_type: 'text' })
//       setShowAddColumnModal(false)
//     }
//     setIsAddingColumn(false)
//   }

//   // Documents handlers
//   const handleAddDocuments = async () => {
//     if (!selectedReview || selectedNewFiles.length === 0) return
    
//     setIsAddingDocuments(true)
//     connectToSSE(selectedReview.id) // Connect before request
    
//     const success = await addDocumentsToReview(selectedReview.id, selectedNewFiles)
//     if (success) {
//       setSelectedNewFiles([])
//       setShowAddDocumentsModal(false)
//     }
//     setIsAddingDocuments(false)
//   }

//   // Enhanced drag and drop handler
//   const handleDropFile = async (fileId: string) => {
//     if (!selectedReview) return
    
//     // Find the file details for optimistic update
//     const droppedFile = files.find(f => f.id === fileId)
//     if (!droppedFile) return
    
//     // Create optimistic file entry
//     const newFile = {
//       file_id: fileId,
//       filename: droppedFile.original_filename,
//       file_size: droppedFile.file_size,
//       status: 'processing'
//     }
    
//     // Immediately update the selected review state
//     setSelectedReview(prev => {
//       if (!prev) return prev
//       return {
//         ...prev,
//         files: [...(prev.files || []), newFile],
//         total_files: (prev.total_files || 0) + 1
//       }
//     })
    
//     // Update the reviews list too
//     setReviews(prev => prev.map(review => 
//       review.id === selectedReview.id 
//         ? {
//             ...review,
//             files: [...(review.files || []), newFile],
//             total_files: (review.total_files || 0) + 1
//           }
//         : review
//     ))
    
//     // Add processing cells for all columns immediately
//     if (selectedReview.columns) {
//       const newProcessingCells = selectedReview.columns.map(col => `${fileId}-${col.id}`)
//       setProcessingCells(prev => {
//         const newSet = new Set(prev)
//         newProcessingCells.forEach(cell => newSet.add(cell))
//         return newSet
//       })
//     }
    
//     // Now call the actual API (don't wait for it)
//     addDocumentsToReview(selectedReview.id, [fileId]).then(success => {
//       if (!success) {
//         // If API fails, revert the optimistic update
//         setSelectedReview(prev => {
//           if (!prev) return prev
//           return {
//             ...prev,
//             files: prev.files?.filter(f => f.file_id !== fileId) || [],
//             total_files: Math.max(0, (prev.total_files || 1) - 1)
//           }
//         })
        
//         setReviews(prev => prev.map(review => 
//           review.id === selectedReview.id 
//             ? {
//                 ...review,
//                 files: review.files?.filter(f => f.file_id !== fileId) || [],
//                 total_files: Math.max(0, (review.total_files || 1) - 1)
//               }
//             : review
//         ))
//       }
//     })
    
//     console.log('File added via drag and drop:', droppedFile.original_filename)
//   }

//   if (loading) {
//     return (
//       <div className="flex h-full bg-gray-50">
//         <div className="flex-1 flex items-center justify-center">
//           <div className="text-center">
//             <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
//             <p className="text-gray-600 font-medium">Loading tabular reviews...</p>
//           </div>
//         </div>
//       </div>
//     )
//   }

//   return (
//     <div className="flex h-full bg-gray-50">
//       {/* Enhanced File List Sidebar */}
//       <EnhancedFileList
//         files={files}
//         selectedFiles={selectedFiles}
//         searchQuery={searchQuery}
//         selectedReview={selectedReview}
//         onFileSelect={handleFileSelection}
//         onSearchChange={setSearchQuery}
//         onCreateReview={handleCreateReview}
//         onDragStart={(fileId: string) => console.log('Drag started for file:', fileId)}
//       />

//       {/* Main Content Area */}
//       <div className="flex-1 flex flex-col min-w-0">
//         {/* Page Header - Only show when not in review mode */}
//         {!selectedReview && !isCreatingReview && (
//           <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
//             <div className="px-6 py-8">
//               <div className="max-w-4xl">
//                 <div className="flex items-center gap-3 mb-4">
//                   <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
//                     <Table className="h-8 w-8 text-white" />
//                   </div>
//                   <div>
//                     <h1 className="text-3xl font-bold text-gray-900 mb-2">
//                       Tabular Reviews
//                     </h1>
//                     <p className="text-lg text-gray-600 flex items-center gap-2">
//                       <Sparkles className="h-5 w-5 text-blue-500" />
//                       Extract structured data from documents with AI-powered analysis
//                     </p>
//                   </div>
//                 </div>
                
//                 {/* Folder Context Banner */}
//                 {folderContext && (
//                   <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
//                     <div className="flex items-center gap-3">
//                       <div 
//                         className="p-2 rounded-lg"
//                         style={{ backgroundColor: `${folderContext.folderColor}20` }}
//                       >
//                         <FolderOpen className="h-5 w-5" style={{ color: folderContext.folderColor }} />
//                       </div>
//                       <div>
//                         <p className="text-sm font-medium text-blue-900">
//                           Created from folder: <span className="font-semibold">{folderContext.folderName}</span>
//                         </p>
//                         <p className="text-xs text-blue-700">
//                           This review was created from the "{folderContext.folderName}" folder
//                         </p>
//                       </div>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Main Content */}
//         <div className="flex-1 min-h-0">
//           {error && (
//             <div className="p-6">
//               <Alert variant="destructive">
//                 <AlertDescription>{error}</AlertDescription>
//               </Alert>
//             </div>
//           )}

//           {isCreatingReview ? (
//             <div className="h-full overflow-y-auto">
//               <EnhancedCreateReview
//                 selectedFiles={selectedFiles}
//                 onSuccess={handleReviewCreated}
//                 onCancel={handleBackToList}
//               />
//             </div>
//           ) : selectedReview ? (
//             <ReviewTable
//               review={selectedReview}
//               realTimeUpdates={realTimeUpdates}
//               processingCells={processingCells}
//               files={files}
//               onBack={handleBackToList}
//               onCellClick={handleCellClick}
//               onAddColumn={() => setShowAddColumnModal(true)}
//               onAddDocuments={() => setShowAddDocumentsModal(true)}
//               onStartAnalysis={handleStartAnalysis}
//               onDropFile={handleDropFile}
//               folderContext={folderContext}
//             />
//           ) : (
//             <div className="h-full overflow-y-auto">
//               <div className="p-6">
//                 <ReviewList
//                   reviews={reviews}
//                   selectedFiles={selectedFiles}
//                   onSelectReview={handleSelectReview}
//                   onCreateReview={() => handleCreateReview()}
//                 />
//               </div>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Modals */}
//       <DocumentViewer
//         selectedCell={selectedCell}
//         onClose={() => setShowDocumentViewer(false)}
//       />

//       <AddColumnModal
//         isOpen={showAddColumnModal}
//         review={selectedReview}
//         newColumn={newColumn}
//         isLoading={isAddingColumn}
//         onClose={() => setShowAddColumnModal(false)}
//         onUpdateColumn={setNewColumn}
//         onSubmit={handleAddColumn}
//       />

//       <AddDocumentsModal
//         isOpen={showAddDocumentsModal}
//         review={selectedReview}
//         // files={files}
//         selectedFiles={selectedNewFiles}
//         searchQuery=""
//         isLoading={isAddingDocuments}
//         onClose={() => setShowAddDocumentsModal(false)}
//         onFileSelect={handleNewFileSelection}
//         onSearchChange={() => {}}
//         onSubmit={handleAddDocuments}
//       />
//     </div>
//   )
// }
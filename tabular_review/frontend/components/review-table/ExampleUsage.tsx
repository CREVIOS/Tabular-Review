// // ExampleUsage.tsx - Example of how to use the independent RealTimeReviewTable
// import React from 'react'
// import RealTimeReviewTable from './RealTimeReviewtable'

// interface ExampleUsageProps {
//   reviewId: string
// }

// export default function ExampleUsage({ reviewId }: ExampleUsageProps) {
//   const handleExport = async () => {
//     try {
//       // Example export functionality
//       console.log('Exporting review data for review:', reviewId)
      
//       // You can implement your export logic here
//       // For example, calling an API endpoint:
//       // const response = await fetch(`/api/reviews/${reviewId}/export`)
//       // const blob = await response.blob()
//       // const url = window.URL.createObjectURL(blob)
//       // const a = document.createElement('a')
//       // a.href = url
//       // a.download = `review-${reviewId}-export.csv`
//       // a.click()
      
//       alert('Export functionality would be implemented here')
//     } catch (error) {
//       console.error('Export failed:', error)
//       alert('Export failed. Please try again.')
//     }
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       <div className="container mx-auto p-6">
//         {/* Header */}
//         <div className="mb-8">
//           <h1 className="text-3xl font-bold text-gray-900 mb-2">
//             Tabular Review Analysis
//           </h1>
//           <p className="text-gray-600">
//             Real-time document analysis with live updates
//           </p>
//           <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
//             <p className="text-sm text-blue-800">
//               <strong>Review ID:</strong> {reviewId}
//             </p>
//             <p className="text-sm text-blue-700 mt-1">
//               This table automatically fetches data and shows real-time updates as analysis progresses.
//             </p>
//           </div>
//         </div>

//         {/* Main Table Component */}
//         <RealTimeReviewTable 
//           reviewId={reviewId}
//           onExport={handleExport}
//         />

//         {/* Additional Information */}
//         <div className="mt-8 p-6 bg-white rounded-lg border border-gray-200">
//           <h2 className="text-xl font-semibold text-gray-900 mb-4">
//             How It Works
//           </h2>
//           <div className="grid md:grid-cols-2 gap-6">
//             <div>
//               <h3 className="font-medium text-gray-900 mb-2">Real-time Updates</h3>
//               <ul className="text-sm text-gray-600 space-y-1">
//                 <li>• Cells update automatically as analysis completes</li>
//                 <li>• New results trigger visual animations</li>
//                 <li>• Progress statistics update in real-time</li>
//                 <li>• Automatic scrolling to new cells</li>
//               </ul>
//             </div>
//             <div>
//               <h3 className="font-medium text-gray-900 mb-2">Performance Features</h3>
//               <ul className="text-sm text-gray-600 space-y-1">
//                 <li>• Virtual scrolling for large datasets</li>
//                 <li>• Memoized components for optimal rendering</li>
//                 <li>• Efficient cell data management</li>
//                 <li>• Smooth animations and transitions</li>
//               </ul>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }

// // Example of how to use this component in a page:
// /*
// import ExampleUsage from '@/components/review-table/ExampleUsage'

// export default function ReviewPage({ params }: { params: { reviewId: string } }) {
//   return <ExampleUsage reviewId={params.reviewId} />
// }
// */ 
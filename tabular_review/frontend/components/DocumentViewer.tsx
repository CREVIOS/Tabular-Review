import React from 'react'
import { X, FileText, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SelectedCell } from '../types'

interface DocumentViewerProps {
  selectedCell: SelectedCell | null
  onClose: () => void
  isMobile?: boolean
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  selectedCell,
  onClose,
  isMobile = false
}) => {
  if (!selectedCell) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleCloseClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onClose()
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className={`bg-white rounded-xl w-full ${isMobile ? 'max-w-[95vw] max-h-[90vh]' : 'max-w-4xl max-h-[85vh]'} flex flex-col shadow-2xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Enhanced for mobile */}
        <div className={`flex items-center justify-between border-b border-gray-200 flex-shrink-0 ${isMobile ? 'p-4' : 'p-6'}`}>
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className={`font-semibold text-gray-900 ${isMobile ? 'text-lg' : 'text-xl'}`}>Document Source</h3>
              <p className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-sm'}`}>View extracted content and source reference</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCloseClick}
            className={`flex-shrink-0 hover:bg-gray-100 touch-target ${isMobile ? 'h-10 w-10 p-0' : 'h-9 w-9 p-0'}`}
            type="button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Scrollable Content - Enhanced for mobile */}
        <div className={`flex-1 overflow-y-auto space-y-4 min-h-0 ${isMobile ? 'p-4' : 'p-6 space-y-6'}`}>
          {/* Extracted Value Card */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className={isMobile ? 'pb-2 p-4' : 'pb-3'}>
              <CardTitle className={`flex items-center space-x-2 ${isMobile ? 'text-base' : 'text-lg'}`}>
                <Info className="h-5 w-5 text-blue-600" />
                <span>Extracted Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className={`space-y-3 ${isMobile ? 'p-4 pt-0' : 'space-y-4'}`}>
              <div>
                <label className={`text-gray-700 block mb-2 font-semibold ${isMobile ? 'text-sm' : 'text-sm'}`}>
                  Extracted Value:
                </label>
                <div className="bg-white p-4 rounded-lg border border-blue-200">
                  <p className={`text-gray-900 leading-relaxed break-words ${isMobile ? 'text-sm' : ''}`}>{selectedCell.value}</p>
                </div>
              </div>
              
              <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                <div>
                  <label className={`text-gray-700 block mb-2 font-semibold ${isMobile ? 'text-sm' : 'text-sm'}`}>
                    Source Reference:
                  </label>
                  <div className="bg-white p-3 rounded-lg border border-blue-200">
                    <p className={`text-gray-600 break-words ${isMobile ? 'text-xs' : 'text-sm'}`}>{selectedCell.sourceRef}</p>
                  </div>
                </div>
                
                {selectedCell.confidence && (
                  <div>
                    <label className={`text-gray-700 block mb-2 font-semibold ${isMobile ? 'text-sm' : 'text-sm'}`}>
                      Confidence Score:
                    </label>
                    <div className="bg-white p-3 rounded-lg border border-blue-200">
                      <Badge 
                        variant={selectedCell.confidence > 0.8 ? 'default' : 'secondary'}
                        className="text-sm"
                      >
                        {Math.round(selectedCell.confidence * 100)}% confident
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Footer - Enhanced for mobile */}
        <div className={`flex justify-end border-t border-gray-200 bg-gray-50/50 flex-shrink-0 ${isMobile ? 'p-4' : 'p-6'}`}>
          <Button onClick={handleCloseClick} className={`touch-target ${isMobile ? 'px-6 h-11' : 'px-6'}`} type="button">
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  useRealtimeStore,
  useConnectionStatus,
  useRealTimeUpdates,
  useProcessingCells 
} from '@/store/useRealtimeStore'
import { Review } from '@/types'

interface DebugPanelProps {
  review: Review | null | undefined
  reviewId: string
}

export function DebugPanel({ review, reviewId }: DebugPanelProps) {
  const connectionStatus = useConnectionStatus()
  const realTimeUpdates = useRealTimeUpdates()
  const processingCells = useProcessingCells()
  const storeError = useRealtimeStore(state => state.error)
  const [sseLog, setSSELog] = useState<string[]>([])
  const [isMinimized, setIsMinimized] = useState(false)
  
  // Log SSE events
  useEffect(() => {
    const originalConsoleLog = console.log
    console.log = (...args) => {
      originalConsoleLog(...args)
      if (args[0]?.includes('SSE') || args[0]?.includes('Cell')) {
        setSSELog(prev => [...prev.slice(-20), `${new Date().toLocaleTimeString()}: ${args.join(' ')}`])
      }
    }
    return () => {
      console.log = originalConsoleLog
    }
  }, [])
  
  // Test functions
  const simulateSSEMessage = (type: string) => {
    const store = useRealtimeStore.getState()
    const fileId = review?.files?.[0]?.file_id
    const columnId = review?.columns?.[0]?.id
    
    if (!fileId || !columnId) {
      alert('No files or columns in review')
      return
    }
    
    const cellKey = `${fileId}-${columnId}`
    
    switch (type) {
      case 'processing':
        store.addProcessingCell(cellKey)
        break
      case 'completed':
        store.removeProcessingCell(cellKey)
        store.setRealTimeUpdate(cellKey, {
          extracted_value: `Test Value ${Date.now()}`,
          confidence_score: 0.95,
          source_reference: 'Debug Test',
          status: 'completed',
          timestamp: Date.now()
        })
        break
      case 'error':
        store.removeProcessingCell(cellKey)
        store.setRealTimeUpdate(cellKey, {
          extracted_value: null,
          confidence_score: null,
          source_reference: '',
          status: 'error',
          error: true,
          timestamp: Date.now()
        })
        break
    }
  }
  
  const testSSEConnection = async () => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      alert('No auth token found')
      return
    }
    
    try {
      const response = await fetch(
        `http://localhost:8000/api/reviews/${reviewId}/stream?token=${encodeURIComponent(token)}`,
        { headers: { 'Accept': 'text/event-stream' } }
      )
      
      if (response.ok) {
        alert('SSE endpoint is accessible')
      } else {
        alert(`SSE endpoint returned: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      alert(`SSE connection test failed: ${error}`)
    }
  }
  
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          size="sm"
          onClick={() => setIsMinimized(false)}
          className="shadow-lg"
        >
          Show Debug Panel
        </Button>
      </div>
    )
  }
  
  return (
    <Card className="fixed bottom-4 right-4 w-[500px] max-h-[600px] z-50 shadow-2xl overflow-hidden">
      <CardHeader className="pb-3 bg-gray-50 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Debug Panel - Review: {reviewId}</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsMinimized(true)}
        >
          Minimize
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="sse">SSE Log</TabsTrigger>
            <TabsTrigger value="test">Test</TabsTrigger>
          </TabsList>
          
          <div className="p-4 max-h-[400px] overflow-auto">
            <TabsContent value="overview" className="space-y-3 mt-0">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-semibold">Connection:</span>
                  <Badge 
                    variant={connectionStatus === 'connected' ? 'default' : 'destructive'}
                    className="ml-2"
                  >
                    {connectionStatus}
                  </Badge>
                </div>
                <div>
                  <span className="font-semibold">Status:</span>
                  <Badge className="ml-2">{review?.status || 'unknown'}</Badge>
                </div>
                <div>
                  <span className="font-semibold">Files:</span> {review?.files?.length || 0}
                </div>
                <div>
                  <span className="font-semibold">Columns:</span> {review?.columns?.length || 0}
                </div>
                <div>
                  <span className="font-semibold">Results:</span> {review?.results?.length || 0}
                </div>
                <div>
                  <span className="font-semibold">Progress:</span> {review?.completion_percentage || 0}%
                </div>
                <div className="col-span-2">
                  <span className="font-semibold">Processing:</span> {processingCells.size} cells
                </div>
                <div className="col-span-2">
                  <span className="font-semibold">Updates:</span> {Object.keys(realTimeUpdates).length} cells
                </div>
              </div>
              {storeError && (
                <div className="bg-red-50 p-2 rounded text-red-700 text-sm">
                  Error: {storeError}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="data" className="space-y-3 mt-0">
              <div className="space-y-2">
                <div className="font-semibold text-sm">File IDs:</div>
                <div className="bg-gray-50 p-2 rounded text-xs">
                  {review?.files?.map(f => (
                    <div key={f.file_id}>
                      {f.file_id} - {f.filename}
                    </div>
                  )) || 'No files'}
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-semibold text-sm">Column IDs:</div>
                <div className="bg-gray-50 p-2 rounded text-xs">
                  {review?.columns?.map(c => (
                    <div key={c.id}>
                      {c.id} - {c.column_name}
                    </div>
                  )) || 'No columns'}
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-semibold text-sm">Real-time Updates:</div>
                <div className="bg-gray-50 p-2 rounded text-xs max-h-32 overflow-auto">
                  {Object.entries(realTimeUpdates).length > 0 ? (
                    Object.entries(realTimeUpdates).map(([key, value]) => (
                      <div key={key} className="border-b pb-1 mb-1">
                        <div className="font-medium">{key}</div>
                        <div>{value.extracted_value || 'null'}</div>
                      </div>
                    ))
                  ) : 'No updates'}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="sse" className="mt-0">
              <div className="space-y-2">
                <div className="font-semibold text-sm">SSE Event Log:</div>
                <div className="bg-gray-900 text-green-400 p-2 rounded text-xs font-mono max-h-64 overflow-auto">
                  {sseLog.length > 0 ? (
                    sseLog.map((log, i) => (
                      <div key={i}>{log}</div>
                    ))
                  ) : (
                    <div className="text-gray-500">No SSE events logged yet</div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSSELog([])}
                  className="w-full"
                >
                  Clear Log
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="test" className="space-y-3 mt-0">
              <Button
                size="sm"
                onClick={() => simulateSSEMessage('processing')}
                className="w-full"
              >
                Simulate Processing
              </Button>
              <Button
                size="sm"
                onClick={() => simulateSSEMessage('completed')}
                className="w-full"
              >
                Simulate Completion
              </Button>
              <Button
                size="sm"
                onClick={() => simulateSSEMessage('error')}
                variant="destructive"
                className="w-full"
              >
                Simulate Error
              </Button>
              <Button
                size="sm"
                onClick={testSSEConnection}
                variant="outline"
                className="w-full"
              >
                Test SSE Endpoint
              </Button>
              <div className="text-xs text-gray-500 text-center">
                These tests update the first file/column
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  )
}

"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { fetchDashboardData, calculateFileStats, calculateReviewStats, getRecentActivity } from '@/lib/dashboard-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  IconFile, 
  IconClock, 
  IconCheck, 
  IconX
} from '@tabler/icons-react'
import { 
  Sparkles,
  FolderOpen,
  Upload,
  Activity,
  FileText,
  Folder
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { File } from '@/types'
// import { Progress } from '@/components/ui/progress'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [stats, setStats] = useState({
    total: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    totalReviews: 0,
    activeReviews: 0,
    completedReviews: 0,
    totalFolders: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [recentActivity, setRecentActivity] = useState<File[]>([])

  useEffect(() => {
    // Check Supabase authentication
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth error:', error)
          router.push('/login')
          return
        }
        
        if (!session) {
          console.log('No session found, redirecting to login')
          router.push('/login')
          return
        }
        
        // Get user data from the session
        setCurrentUser(session.user)
        
        // Fetch dashboard data
        await fetchDashboard()
      } catch (error) {
        console.error('Authentication check failed:', error)
        router.push('/login')
      }
    }
    
    checkAuth()
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          router.push('/login')
        } else if (session) {
          setCurrentUser(session.user)
        }
      }
    )
    
    return () => subscription.unsubscribe()
  }, [router, supabase.auth])

  const fetchDashboard = async () => {
    try {
      setError('')
      setLoading(true)
      
      // Use the new single API endpoint instead of three separate calls
      const dashboardData = await fetchDashboardData()
      
      // Calculate file stats
      const fileStats = calculateFileStats(dashboardData.documents)
      
      // Calculate review stats  
      const reviewStats = calculateReviewStats(dashboardData.reviews)
      
      // Set combined stats
      setStats({
        total: fileStats.total || 0,
        processing: fileStats.processing || 0,
        completed: fileStats.completed || 0,
        failed: fileStats.failed || 0,
        totalReviews: reviewStats.totalReviews || 0,
        activeReviews: reviewStats.activeReviews || 0,
        completedReviews: reviewStats.completedReviews || 0,
        totalFolders: dashboardData.folders.length
      })

      // Set recent activity
      const recentFiles = getRecentActivity(dashboardData.documents, 5)
      setRecentActivity(recentFiles)
      
      setError('')
    } catch (error: unknown) {
      console.error('Failed to fetch dashboard data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to load dashboard data'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen mx-auto p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <div className="text-red-500 mb-4">Error: {error}</div>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        {currentUser && (
            <p className="text-gray-600 mt-1">
            Welcome back, {currentUser.user_metadata?.full_name || currentUser.email}
          </p>
        )}
      </div>
        <Button onClick={fetchDashboard} variant="outline" size="sm">
          <Activity className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* First Row: Create Review & Folder Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Review Card */}
        <Card className="relative overflow-hidden border-2 border-dashed border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 hover:border-blue-300 transition-all duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500 rounded-xl shadow-lg">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-gray-900">Create New Review</CardTitle>
                <p className="text-sm text-gray-600 mt-1">Extract data from documents with AI</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalReviews}</div>
                <div className="text-gray-600">Total Reviews</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.completedReviews}</div>
                <div className="text-gray-600">Completed</div>
              </div>
            </div>
            <Button 
              onClick={() => router.push('/review')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              size="lg"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Create Review
            </Button>
          </CardContent>
        </Card>

        {/* Folder Management Card */}
        <Card className="relative overflow-hidden border-2 border-dashed border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 hover:border-green-300 transition-all duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500 rounded-xl shadow-lg">
                <FolderOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-gray-900">Manage Folders</CardTitle>
                <p className="text-sm text-gray-600 mt-1">Organize your documents</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.totalFolders}</div>
                <div className="text-gray-600">Folders</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-gray-600">Documents</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => router.push('/documents')}
                variant="outline"
                className="flex-1"
              >
                <Folder className="h-4 w-4 mr-2" />
                Browse
              </Button>
              <Button 
                onClick={() => router.push('/upload')}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Status
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <IconFile className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0 ? `${Math.round(completionRate)}% processed` : 'No documents yet'}
              </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <IconClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.processing}</div>
              <p className="text-xs text-muted-foreground">
                Documents in queue
              </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <IconCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">
                Ready for analysis
              </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <IconX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              <p className="text-xs text-muted-foreground">
                Need attention
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Activity
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {recentActivity.map((file) => (
                  <div key={file.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 truncate max-w-xs">
                          {file.original_filename}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(file.updated_at || file.upload_date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Badge 
                      variant={
                        file.status === 'completed' ? 'default' :
                        file.status === 'processing' ? 'secondary' :
                        file.status === 'failed' ? 'destructive' : 'outline'
                      }
                    >
                      {file.status}
                    </Badge>
                  </div>
                ))}
              </div>
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  )
}

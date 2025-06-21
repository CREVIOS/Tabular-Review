import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Eye, Trash2, Calendar, FileText, BarChart3, Folder, Clock, CheckCircle, AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Review } from "../../types"

export type ReviewTableRow = Review & {
  folderName?: string
  folderColor?: string
}

interface ColumnsProps {
  onSelectReview: (review: Review) => void
  onDeleteReview?: (reviewId: string) => void
}

export const createReviewColumns = ({ onSelectReview, onDeleteReview }: ColumnsProps): ColumnDef<ReviewTableRow>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto px-2 py-1 hover:bg-blue-50 text-xs sm:text-sm"
        >
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Review Name</span>
            <span className="sm:hidden">Name</span>
            <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
          </div>
        </Button>
      )
    },
    cell: ({ row }) => {
      const review = row.original
      return (
        <div 
          className="space-y-1 max-w-[12rem] sm:max-w-[16rem] cursor-pointer hover:text-blue-600 transition-colors"
          onClick={() => onSelectReview(review)}
        >
          <div
            className="font-semibold text-gray-900 truncate text-xs sm:text-sm"
            title={review.name}
          >
            {review.name}
          </div>
          {review.description && (
            <div
              className="text-xs text-gray-500 truncate"
              title={review.description}
            >
              {review.description}
            </div>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto px-2 py-1 hover:bg-blue-50 text-xs sm:text-sm"
        >
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Status</span>
            <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
          </div>
        </Button>
      )
    },
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      
      const getStatusConfig = (status: string) => {
        switch (status) {
          case 'completed':
            return {
              variant: 'default' as const,
              icon: CheckCircle,
              color: 'text-green-600',
              bg: 'bg-green-100'
            }
          case 'processing':
            return {
              variant: 'secondary' as const,
              icon: Loader2,
              color: 'text-blue-600',
              bg: 'bg-blue-100'
            }
          case 'failed':
            return {
              variant: 'destructive' as const,
              icon: AlertTriangle,
              color: 'text-red-600',
              bg: 'bg-red-100'
            }
          default:
            return {
              variant: 'outline' as const,
              icon: Clock,
              color: 'text-gray-600',
              bg: 'bg-gray-100'
            }
        }
      }
      
      const config = getStatusConfig(status)
      const Icon = config.icon
      
      return (
        <div className="flex flex-col items-center gap-1">
          <Badge 
            variant={config.variant} 
            className={`capitalize text-xs flex items-center gap-1 ${config.bg} ${config.color} border-0`}
          >
            <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{status}</span>
          </Badge>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "folderName",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto px-2 py-1 hover:bg-blue-50 text-xs sm:text-sm"
        >
          <div className="flex items-center gap-1">
            <Folder className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Folder</span>
            <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
          </div>
        </Button>
      )
    },
    cell: ({ row }) => {
      const folderName = row.getValue("folderName") as string
      const folderColor = row.original.folderColor
      
      if (!folderName) {
        return (
          <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
            <div className="w-2 h-2 rounded-full bg-gray-300" />
            <span className="hidden sm:inline">Uncategorized</span>
            <span className="sm:hidden">—</span>
          </div>
        )
      }
      
      return (
        <div className="flex items-center justify-center gap-2 max-w-[8rem] sm:max-w-none">
          <div 
            className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: folderColor || '#6b7280' }}
          />
          <span className="text-xs sm:text-sm text-gray-700 font-medium truncate" title={folderName}>
            {folderName}
          </span>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "completion_percentage",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto px-2 py-1 hover:bg-blue-50 text-xs sm:text-sm"
        >
          <div className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Progress</span>
            <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
          </div>
        </Button>
      )
    },
    cell: ({ row }) => {
      const percentage = row.getValue("completion_percentage") as number || 0
      const getProgressColor = (percentage: number) => {
        if (percentage >= 100) return 'bg-green-500'
        if (percentage >= 75) return 'bg-blue-500'
        if (percentage >= 50) return 'bg-yellow-500'
        return 'bg-orange-500'
      }
      
      const getProgressBg = (percentage: number) => {
        if (percentage >= 100) return 'bg-green-50'
        if (percentage >= 75) return 'bg-blue-50'
        if (percentage >= 50) return 'bg-yellow-50'
        return 'bg-orange-50'
      }
      
      return (
        <div className="w-full max-w-[4rem] sm:max-w-[6rem] mx-auto">
          <div className={`flex items-center justify-center mb-1 px-2 py-1 rounded-full ${getProgressBg(percentage)}`}>
            <span className="text-xs font-bold text-gray-700">{Math.round(percentage)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
            <div 
              className={`h-1.5 sm:h-2 rounded-full transition-all duration-500 ${getProgressColor(percentage)}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "total_files",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto px-2 py-1 hover:bg-blue-50 text-xs sm:text-sm"
        >
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Files</span>
            <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
          </div>
        </Button>
      )
    },
    cell: ({ row }) => {
      const fileCount = row.getValue("total_files") as number || 0
      return (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full">
            <span className="text-xs sm:text-sm font-bold text-blue-600">{fileCount}</span>
          </div>
          <span className="text-xs text-gray-500 hidden sm:inline">files</span>
        </div>
      )
    },
  },
  {
    accessorKey: "total_columns", 
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto px-2 py-1 hover:bg-blue-50 text-xs sm:text-sm"
        >
          <div className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Columns</span>
            <span className="sm:hidden">Cols</span>
            <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
          </div>
        </Button>
      )
    },
    cell: ({ row }) => {
      const columnCount = row.getValue("total_columns") as number || 0
      return (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-full">
            <span className="text-xs sm:text-sm font-bold text-purple-600">{columnCount}</span>
          </div>
          <span className="text-xs text-gray-500 hidden sm:inline">columns</span>
        </div>
      )
    },
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto px-2 py-1 hover:bg-blue-50 text-xs sm:text-sm"
        >
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Created</span>
            <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
          </div>
        </Button>
      )
    },
    cell: ({ row }) => {
      const dateString = row.getValue("created_at") as string
      const date = new Date(dateString)     
      const now = new Date()
      const diffTime = Math.abs(now.getTime() - date.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      let timeAgo = ""
      let isRecent = false
      
      if (diffDays === 1) {
        timeAgo = "Today"
        isRecent = true
      } else if (diffDays === 2) {
        timeAgo = "Yesterday"
        isRecent = true
      } else if (diffDays <= 7) {
        timeAgo = `${diffDays - 1}d ago`
        isRecent = true
      } else if (diffDays <= 30) {
        timeAgo = `${Math.ceil((diffDays - 1) / 7)}w ago`
      } else {
        timeAgo = date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        })
      }
      
      return (
        <div className="flex flex-col items-center gap-1">
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            isRecent ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {timeAgo}
          </div>
          <div className="text-xs text-gray-400 hidden sm:block">
            {date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric'
            })}
          </div>
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      const dateA = new Date(rowA.getValue("created_at") as string)
      const dateB = new Date(rowB.getValue("created_at") as string)
      return dateA.getTime() - dateB.getTime()
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const review = row.original
 
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="h-8 w-8 p-0 hover:bg-blue-50 touch-target"
            >
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-gray-500">
              Actions for {review.name}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSelectReview(review)} className="cursor-pointer">
              <Eye className="h-4 w-4 mr-2 text-blue-600" />
              <span>View Review</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(review.id)}
              className="cursor-pointer"
            >
              <FileText className="h-4 w-4 mr-2 text-gray-600" />
              <span>Copy ID</span>
            </DropdownMenuItem>
            {onDeleteReview && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDeleteReview(review.id)}
                  className="text-red-600 focus:text-red-600 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  <span>Delete Review</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
] 
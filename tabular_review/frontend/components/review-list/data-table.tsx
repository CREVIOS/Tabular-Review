"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Search, Filter, RotateCcw, Plus, Table as TableIcon, Sparkles, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  selectedFiles: string[]
  onCreateReview: () => void
  folders?: Array<{ id: string; name: string; color: string }>
}

export function ReviewDataTable<TData, TValue>({
  columns,
  data,
  selectedFiles,
  onCreateReview,
  folders = []
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "created_at", desc: true } // Default to most recent first
  ])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    // Hide some columns on mobile by default
    folderName: true,
    total_columns: true,
    created_at: true,
  })
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState("")

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  const resetFilters = React.useCallback(() => {
    setGlobalFilter("")
    setColumnFilters([])
    setSorting([{ id: "created_at", desc: true }])
  }, [])

  const statusOptions = React.useMemo(() => [
    { value: "completed", label: "Completed", color: "bg-green-100 text-green-800" },
    { value: "processing", label: "Processing", color: "bg-blue-100 text-blue-800" },
    { value: "failed", label: "Failed", color: "bg-red-100 text-red-800" },
    { value: "draft", label: "Draft", color: "bg-gray-100 text-gray-800" },
  ], [])

  // Enhanced handlers with better performance
  const handleStatusFilterChange = React.useCallback((value: string, checked: boolean) => {
    const statusColumn = table.getColumn("status")
    if (!statusColumn) return
    
    const currentFilter = (statusColumn.getFilterValue() as string[]) ?? []
    const newFilter = checked
      ? [...currentFilter, value]
      : currentFilter.filter((filterValue) => filterValue !== value)
    
    statusColumn.setFilterValue(newFilter.length ? newFilter : undefined)
  }, [table])

  const handleFolderFilterChange = React.useCallback((folderName: string, checked: boolean) => {
    const folderColumn = table.getColumn("folderName")
    if (!folderColumn) return
    
    const currentFilter = (folderColumn.getFilterValue() as string[]) ?? []
    const newFilter = checked
      ? [...currentFilter, folderName]
      : currentFilter.filter((value) => value !== folderName)
    
    folderColumn.setFilterValue(newFilter.length ? newFilter : undefined)
  }, [table])

  const handleColumnToggle = React.useCallback((columnId: string, visible: boolean) => {
    const column = table.getColumn(columnId)
    if (column) {
      column.toggleVisibility(!!visible)
    }
  }, [table])

  const getStatusCounts = React.useMemo(() => {
    const counts = {
      completed: 0,
      processing: 0,
      failed: 0,
      draft: 0,
    }
    
    data.forEach((item: any) => {
      if (counts.hasOwnProperty(item.status)) {
        counts[item.status as keyof typeof counts]++
      }
    })
    
    return counts
  }, [data])

  return (
    <div className="w-full space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Enhanced Header Section */}
      <div className="space-y-4">
        {/* Selected Files Indicator */}
        {selectedFiles.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-sm">
                {selectedFiles.length} files selected
              </Badge>
            </div>
            <p className="text-sm text-blue-700">Ready to create a new review with selected files</p>
            <Button
              onClick={onCreateReview}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 ml-auto touch-target"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Review
            </Button>
          </div>
        )}

        {/* Enhanced Search and Filters Bar */}
        <Card className="border-0 shadow-sm bg-gray-50">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Global Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search reviews, descriptions, folders..."
                  value={globalFilter}
                  onChange={(event) => setGlobalFilter(event.target.value)}
                  className="pl-10 bg-white border-gray-200 touch-target"
                />
              </div>

              {/* Filters Container */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Status Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="justify-between min-w-[120px] touch-target">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        <span>Status</span>
                      </div>
                      {!!table.getColumn("status")?.getFilterValue() && (
                        <Badge variant="secondary" className="ml-2 h-5 px-2 text-xs">
                          {((table.getColumn("status")?.getFilterValue() as string[]) || []).length}
                        </Badge>
                      )}
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel className="flex items-center justify-between">
                      Filter by Status
                      <Badge variant="outline" className="text-xs">
                        {data.length} total
                      </Badge>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {statusOptions.map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={
                          (table.getColumn("status")?.getFilterValue() as string[])?.includes(option.value) ?? false
                        }
                        onCheckedChange={(checked) => handleStatusFilterChange(option.value, checked)}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${option.color.split(' ')[0]}`} />
                          <span>{option.label}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {getStatusCounts[option.value as keyof typeof getStatusCounts]}
                        </Badge>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Folder Filter */}
                {folders.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="justify-between min-w-[120px] touch-target">
                        <div className="flex items-center gap-2">
                          <Filter className="h-4 w-4" />
                          <span>Folder</span>
                        </div>
                        {!!table.getColumn("folderName")?.getFilterValue() && (
                          <Badge variant="secondary" className="ml-2 h-5 px-2 text-xs">
                            Active
                          </Badge>
                        )}
                        <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel>Filter by Folder</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={
                          (table.getColumn("folderName")?.getFilterValue() as string[])?.includes("") ?? false
                        }
                        onCheckedChange={(checked) => handleFolderFilterChange("", checked)}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gray-300" />
                          <span>Uncategorized</span>
                        </div>
                      </DropdownMenuCheckboxItem>
                      {folders.map((folder) => (
                        <DropdownMenuCheckboxItem
                          key={folder.id}
                          checked={
                            (table.getColumn("folderName")?.getFilterValue() as string[])?.includes(folder.name) ?? false
                          }
                          onCheckedChange={(checked) => handleFolderFilterChange(folder.name, checked)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: folder.color }}
                            />
                            <span>{folder.name}</span>
                          </div>
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Column Visibility */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="touch-target">
                      <span className="hidden sm:inline">Columns</span>
                      <span className="sm:hidden">Cols</span>
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {table
                      .getAllColumns()
                      .filter((column) => column.getCanHide())
                      .map((column) => {
                        return (
                          <DropdownMenuCheckboxItem
                            key={column.id}
                            className="capitalize"
                            checked={column.getIsVisible()}
                            onCheckedChange={(value) => handleColumnToggle(column.id, value)}
                          >
                            {column.id.replace(/([A-Z])/g, ' $1').trim()}
                          </DropdownMenuCheckboxItem>
                        )
                      })}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Reset Filters */}
                {(globalFilter || columnFilters.length > 0) && (
                  <Button variant="outline" size="sm" onClick={resetFilters} className="touch-target">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Reset</span>
                    <span className="sm:hidden">Reset</span>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Table */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-0">
          <div className="mobile-table-container">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-50 hover:to-gray-100 border-b-2 border-gray-200">
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} className="font-semibold text-gray-700 text-center py-4">
                          <div className="flex items-center justify-center">
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </div>
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row, index) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className={`hover:bg-blue-50 cursor-pointer transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                      }`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-4 text-center">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4 py-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                          <TableIcon className="h-8 w-8 text-gray-400" />
                        </div>
                        <div className="text-center">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">No reviews found</h3>
                          <p className="text-sm text-gray-500 mb-6 max-w-md">
                            {globalFilter || columnFilters.length > 0
                              ? "Try adjusting your search criteria or clearing filters to see more results."
                              : "Create your first tabular review to start extracting structured data from documents."}
                          </p>
                          {!globalFilter && columnFilters.length === 0 && (
                            <Button 
                              onClick={onCreateReview} 
                              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 touch-target"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Create First Review
                            </Button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Pagination */}
      {table.getRowModel().rows?.length > 0 && (
        <Card className="border-0 shadow-sm bg-gray-50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Showing</span>
                <Badge variant="outline" className="font-medium">
                  {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
                </Badge>
                <span>to</span>
                <Badge variant="outline" className="font-medium">
                  {Math.min(
                    (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                    table.getFilteredRowModel().rows.length
                  )}
                </Badge>
                <span>of</span>
                <Badge variant="outline" className="font-medium">
                  {table.getFilteredRowModel().rows.length}
                </Badge>
                <span>reviews</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="touch-target"
                >
                  Previous
                </Button>
                
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-600">Page</span>
                  <Badge variant="secondary" className="px-2 py-1">
                    {table.getState().pagination.pageIndex + 1}
                  </Badge>
                  <span className="text-sm text-gray-600">of</span>
                  <Badge variant="secondary" className="px-2 py-1">
                    {table.getPageCount()}
                  </Badge>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="touch-target"
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
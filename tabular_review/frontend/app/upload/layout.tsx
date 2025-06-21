'use client'

import { Sidebar, SidebarProvider, SidebarTrigger } from '@/components/sidebar'

export default function UploadLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        {/* Mobile Header with Trigger */}
        <div className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 p-4 md:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <h1 className="text-lg font-semibold text-gray-900">Upload</h1>
            </div>
          </div>
        </div>
        
        {/* Sidebar - responsive with mobile overlay */}
        <Sidebar className="border-r" />
        
        {/* Main content with responsive padding */}
        <main className="flex-1 overflow-y-auto md:ml-0 pt-16 md:pt-0">
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
} 
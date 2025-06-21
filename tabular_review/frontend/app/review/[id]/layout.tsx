export default function ReviewDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <main className="w-full h-full">
        {children}
      </main>
    </div>
  )
} 
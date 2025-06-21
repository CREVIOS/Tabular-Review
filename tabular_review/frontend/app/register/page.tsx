import { RegisterForm } from '@/components/auth/register-form'
import { Shield, Sparkles, FileText, BarChart3, Lock, Users, Zap } from 'lucide-react'

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Tabular Reviews</h1>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Create Your Account</h2>
          <p className="text-gray-600 mb-8">
            Join thousands of users transforming document analysis with AI
          </p>
        </div>

        {/* Register Form Container */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
          <RegisterForm />
        </div>
      
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500 mb-2">
            Tabular Reviews is a secure and fast way to analyze documents @makebell.
          </p>
        </div>
      </div>
    </div>
  )
} 
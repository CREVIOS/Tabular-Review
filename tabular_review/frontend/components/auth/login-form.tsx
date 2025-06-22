"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff, Mail, Lock, Shield, AlertCircle, Loader2, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/lib/auth-context"
import { handleApiError } from "@/lib/api"
import Link from "next/link"

export function LoginForm() {
  const { login, isLoading } = useAuth()
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  })
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attemptCount, setAttemptCount] = useState(0)

  // Enhanced validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validateForm = (): boolean => {
    setError("")

    if (!formData.email.trim()) {
      setError("Email address is required")
      return false
    }

    if (!validateEmail(formData.email.trim())) {
      setError("Please enter a valid email address")
      return false
    }

    if (!formData.password) {
      setError("Password is required")
      return false
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters")
      return false
    }

    return true
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error when user starts typing
    if (error) {
      setError("")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    // Rate limiting check
    if (attemptCount >= 5) {
      setError("Too many login attempts. Please wait 15 minutes before trying again.")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      await login(
        formData.email.trim().toLowerCase(),
        formData.password
      )

      // Handle remember me functionality
      if (rememberMe && typeof window !== 'undefined') {
        localStorage.setItem('remember_user', formData.email.trim().toLowerCase())
      } else if (typeof window !== 'undefined') {
        localStorage.removeItem('remember_user')
      }

      // Reset attempt count on successful login
      setAttemptCount(0)
      
    } catch (error: unknown) {
      console.error("Login error:", error)
      
      // Increment attempt count
      setAttemptCount(prev => prev + 1)
      
      const errorMessage = handleApiError(error)
      setError(errorMessage)
      
      // Add specific handling for common login errors
      if (error instanceof Error) {
        if (error.message?.includes('Invalid credentials')) {
          setError("Invalid email or password. Please check your credentials and try again.")
        } else if (error.message?.includes('Account locked')) {
          setError("Your account has been temporarily locked due to multiple failed login attempts.")
        } else if (error.message?.includes('Email not verified')) {
          setError("Please verify your email address before logging in.")
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Pre-fill email if user was remembered
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const rememberedEmail = localStorage.getItem('remember_user')
      if (rememberedEmail) {
        setFormData(prev => ({ ...prev, email: rememberedEmail }))
        setRememberMe(true)
      }
    }
  }, [])

  const getRemainingAttempts = (): number => {
    return Math.max(0, 5 - attemptCount)
  }

  return (
    <div className="space-y-6">
      {/* Form Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium text-blue-600">Secure Login</span>
        </div>
        <p className="text-sm text-gray-600">
          Your data is protected with bank-level security
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex flex-col gap-1">
              <span>{error}</span>
              {attemptCount > 0 && attemptCount < 5 && (
                <span className="text-xs font-medium">
                  {getRemainingAttempts()} attempt{getRemainingAttempts() !== 1 ? 's' : ''} remaining
                </span>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Success Message for Demo */}
      {attemptCount === 0 && !error && !isSubmitting && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <div className="flex flex-col gap-1">
              <span className="font-medium">Welcome back!</span>
              <span className="text-sm">Enter your credentials to access your secure dashboard.</span>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-gray-700">
            Email Address *
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              className="pl-10"
              required
              autoComplete="email"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-gray-700">
            Password *
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={formData.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
              className="pl-10 pr-10"
              required
              autoComplete="current-password"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              disabled={isSubmitting}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
              disabled={isSubmitting}
            />
            <Label htmlFor="remember" className="text-sm text-gray-600">
              Remember me
            </Label>
          </div>
          <Link 
            href="/forgot-password" 
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium py-3 shadow-lg hover:shadow-xl transition-all"
          disabled={isSubmitting || isLoading || attemptCount >= 5}
        >
          {isSubmitting || isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <Shield className="mr-2 h-4 w-4" />
              Sign In Securely
            </>
          )}
        </Button>
      </form>

      {/* Rate Limit Warning */}
      {attemptCount > 2 && attemptCount < 5 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <span className="font-medium">Security Notice:</span> You have {getRemainingAttempts()} login attempt{getRemainingAttempts() !== 1 ? 's' : ''} remaining before your account is temporarily locked.
          </AlertDescription>
        </Alert>
      )}

      {/* Account Lockout */}
      {attemptCount >= 5 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex flex-col gap-2">
              <span className="font-medium">Account Temporarily Locked</span>
              <span className="text-sm">
                For security reasons, this account has been temporarily locked due to multiple failed login attempts.
                Please wait 15 minutes before trying again, or{" "}
                <Link href="/forgot-password" className="underline font-medium">
                  reset your password
                </Link>.
              </span>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Register Link */}
      <div className="text-center pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link 
            href="/register" 
            className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
          >
            Create one here
          </Link>
        </p>
      </div>
    </div>
  )
}
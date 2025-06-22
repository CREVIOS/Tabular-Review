"use client"

import { useState } from "react"
import { Eye, EyeOff, User, Mail, Lock, Shield, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/lib/auth-context"
import { handleApiError } from "@/lib/api"
import Link from "next/link"

interface PasswordRequirement {
  label: string
  test: (password: string) => boolean
  met: boolean
}

export function RegisterForm() {
  const { register, isLoading } = useAuth()
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: ""
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false)

  // Password strength requirements
  const passwordRequirements: PasswordRequirement[] = [
    {
      label: "At least 8 characters",
      test: (pwd) => pwd.length >= 8,
      met: formData.password.length >= 8
    },
    {
      label: "Contains uppercase letter",
      test: (pwd) => /[A-Z]/.test(pwd),
      met: /[A-Z]/.test(formData.password)
    },
    {
      label: "Contains lowercase letter", 
      test: (pwd) => /[a-z]/.test(pwd),
      met: /[a-z]/.test(formData.password)
    },
    {
      label: "Contains number",
      test: (pwd) => /\d/.test(pwd),
      met: /\d/.test(formData.password)
    },
    {
      label: "Contains special character",
      test: (pwd) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
      met: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password)
    }
  ]

  const passwordScore = passwordRequirements.filter(req => req.met).length
  const isPasswordStrong = passwordScore >= 4

  // Enhanced validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validateForm = (): boolean => {
    // Clear previous errors
    setError("")

    // Check required fields
    if (!formData.fullName.trim()) {
      setError("Full name is required")
      return false
    }

    if (formData.fullName.trim().length < 2) {
      setError("Full name must be at least 2 characters")
      return false
    }

    if (!formData.email.trim()) {
      setError("Email is required")
      return false
    }

    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address")
      return false
    }

    if (!formData.password) {
      setError("Password is required")
      return false
    }

    if (!isPasswordStrong) {
      setError("Password does not meet security requirements")
      return false
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return false
    }

    if (!agreedToTerms) {
      setError("You must agree to the Terms of Service")
      return false
    }

    if (!agreedToPrivacy) {
      setError("You must agree to the Privacy Policy")
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

    setIsSubmitting(true)
    setError("")

    try {
      await register(
        formData.email.trim().toLowerCase(),
        formData.password,
        formData.fullName.trim()
      )

      // Registration successful - the auth context will handle redirect
    } catch (error: Error | unknown) {
      console.error("Registration error:", error)
      const errorMessage = handleApiError(error)
      setError(errorMessage)
      
      // Add specific handling for common registration errors
      if (error.message?.includes('Email already exists')) {
        setError("An account with this email already exists. Please try logging in instead.")
      } else if (error.message?.includes('Invalid email')) {
        setError("Please enter a valid email address.")
      } else if (error.message?.includes('Weak password')) {
        setError("Password does not meet security requirements. Please choose a stronger password.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const getPasswordStrengthColor = () => {
    if (passwordScore <= 2) return "bg-red-500"
    if (passwordScore === 3) return "bg-yellow-500"
    if (passwordScore === 4) return "bg-blue-500"
    return "bg-green-500"
  }

  const getPasswordStrengthText = () => {
    if (passwordScore <= 2) return "Weak"
    if (passwordScore === 3) return "Fair"
    if (passwordScore === 4) return "Good"
    return "Strong"
  }

  return (
    <div className="space-y-6">
      {/* Form Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium text-blue-600">Secure Registration</span>
        </div>
        <p className="text-sm text-gray-600">
          All information is encrypted and securely stored
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

        <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-sm font-medium text-gray-700">
            Full Name *
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              id="fullName"
              type="text"
              placeholder="Enter your full name"
              value={formData.fullName}
              onChange={(e) => handleInputChange("fullName", e.target.value)}
              className="pl-10"
              required
              autoComplete="name"
              disabled={isSubmitting || isLoading}
            />
          </div>
        </div>

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
              disabled={isSubmitting || isLoading}
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
              placeholder="Create a strong password"
              value={formData.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
              className="pl-10 pr-10"
              required
              autoComplete="new-password"
              disabled={isSubmitting || isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              disabled={isSubmitting || isLoading}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Password Strength Indicator */}
          {formData.password && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Password strength:</span>
                <span className={`text-xs font-medium ${
                  passwordScore <= 2 ? 'text-red-600' :
                  passwordScore === 3 ? 'text-yellow-600' :
                  passwordScore === 4 ? 'text-blue-600' : 'text-green-600'
                }`}>
                  {getPasswordStrengthText()}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1">
                <div 
                  className={`h-1 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                  style={{ width: `${(passwordScore / 5) * 100}%` }}
                ></div>
              </div>
              
              {/* Password Requirements */}
              <div className="grid grid-cols-1 gap-1">
                {passwordRequirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {req.met ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <div className="h-3 w-3 rounded-full border border-gray-300"></div>
                    )}
                    <span className={`text-xs ${req.met ? 'text-green-600' : 'text-gray-500'}`}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
            Confirm Password *
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
              className="pl-10 pr-10"
              required
              autoComplete="new-password"
              disabled={isSubmitting || isLoading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              disabled={isSubmitting || isLoading}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {formData.confirmPassword && (
            <div className="flex items-center gap-2">
              {formData.password === formData.confirmPassword ? (
                <>
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-600">Passwords match</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 text-red-500" />
                  <span className="text-xs text-red-600">Passwords don't match</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Terms and Privacy */}
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
              className="mt-1"
              disabled={isSubmitting || isLoading}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="terms"
                className="text-sm leading-relaxed peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I agree to the{" "}
                <Link href="/terms" className="text-blue-600 hover:text-blue-700 underline">
                  Terms of Service
                </Link>
              </label>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="privacy"
              checked={agreedToPrivacy}
              onCheckedChange={(checked) => setAgreedToPrivacy(checked === true)}
              className="mt-1"
              disabled={isSubmitting || isLoading}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="privacy"
                className="text-sm leading-relaxed peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I agree to the{" "}
                <Link href="/privacy" className="text-blue-600 hover:text-blue-700 underline">
                  Privacy Policy
            </Link>
              </label>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium py-3 shadow-lg hover:shadow-xl transition-all"
          disabled={isSubmitting || isLoading}
        >
          {isSubmitting || isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Account...
            </>
          ) : (
            <>
              <Shield className="mr-2 h-4 w-4" />
              Create Secure Account
            </>
          )}
        </Button>
        </form>

      {/* Login Link */}
      <div className="text-center pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          Already have an account?{" "}
          <Link 
            href="/login" 
            className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
          >
            Sign in here
          </Link>
        </p>
      </div>

     
    </div>
  )
}
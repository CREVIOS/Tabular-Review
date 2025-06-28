"use client"

import React from "react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, Mail, Lock, Shield, AlertCircle, Loader2, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { loginSchema, LoginFormValues } from "@/schemas/login"
import { loginUser } from "@/app/(auth)/actions/login-action"
import { useRouter } from "next/navigation"

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export function LoginForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attemptCount, setAttemptCount] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('login_attempt_count');
      return stored ? parseInt(stored, 10) : 0;
    }
    return 0;
  });
  const [lockoutTime, setLockoutTime] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('login_lockout_time');
      return stored ? parseInt(stored, 10) : null;
    }
    return null;
  });

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  // Pre-fill email if user was remembered
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const rememberedEmail = localStorage.getItem('remember_user')
      if (rememberedEmail) {
        form.setValue('email', rememberedEmail)
        setRememberMe(true)
      }
    }
  }, [form])

  // Effect to persist attemptCount and lockoutTime
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('login_attempt_count', attemptCount.toString());
      if (lockoutTime) {
        localStorage.setItem('login_lockout_time', lockoutTime.toString());
      } else {
        localStorage.removeItem('login_lockout_time');
      }
    }
  }, [attemptCount, lockoutTime]);

  // Effect to check and reset lockout after LOCKOUT_MINUTES
  React.useEffect(() => {
    if (lockoutTime) {
      const now = Date.now();
      const expires = lockoutTime + LOCKOUT_MINUTES * 60 * 1000;
      if (now >= expires) {
        setAttemptCount(0);
        setLockoutTime(null);
      } else {
        const timeout = setTimeout(() => {
          setAttemptCount(0);
          setLockoutTime(null);
        }, expires - now);
        return () => clearTimeout(timeout);
      }
    }
  }, [lockoutTime]);

  const getRemainingAttempts = (): number => {
    return Math.max(0, MAX_ATTEMPTS - attemptCount);
  }

  const onSubmit = async (values: LoginFormValues) => {
    setError("")
    if (attemptCount >= MAX_ATTEMPTS) {
      if (!lockoutTime) setLockoutTime(Date.now())
      setError(`Too many login attempts. Please wait ${LOCKOUT_MINUTES} minutes before trying again.`)
      return
    }
    setIsSubmitting(true)
    try {
      const result = await loginUser({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      })
      if (result?.error) {
        setAttemptCount(prev => {
          const next = prev + 1
          if (next >= MAX_ATTEMPTS && !lockoutTime) setLockoutTime(Date.now())
          return next
        })
        setError(result.message || "Login failed. Please try again.")
        return
      }
      // Handle remember me functionality
      if (rememberMe && typeof window !== 'undefined') {
        localStorage.setItem('remember_user', values.email.trim().toLowerCase())
      } else if (typeof window !== 'undefined') {
        localStorage.removeItem('remember_user')
      }
      setAttemptCount(0)
      setLockoutTime(null)

      console.log("Login successful")
      // Optionally redirect or show success
      // window.location.href = "/dashboard"

      setTimeout(() => {
        router.push("/dashboard"); // Redirect to dashboard or home page after successful login
      }, 1000);
    } catch (err: unknown) {
      setAttemptCount(prev => {
        const next = prev + 1
        if (next >= MAX_ATTEMPTS && !lockoutTime) setLockoutTime(Date.now())
        return next
      })
      setError(err instanceof Error ? err.message : "Login failed. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
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
              {attemptCount > 0 && attemptCount < MAX_ATTEMPTS && (
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address *</FormLabel>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      autoComplete="email"
                      disabled={isSubmitting}
                      className="pl-10"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          {/* Password */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password *</FormLabel>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      disabled={isSubmitting}
                      className="pl-10 pr-10"
                      {...field}
                    />
                  </FormControl>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    disabled={isSubmitting}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                disabled={isSubmitting}
              />
              <label htmlFor="remember" className="text-sm text-gray-600">
                Remember me
              </label>
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
            disabled={isSubmitting || attemptCount >= MAX_ATTEMPTS || !!lockoutTime}
          >
            {isSubmitting ? (
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
      </Form>

      {/* Rate Limit Warning */}
      {attemptCount > 2 && attemptCount < MAX_ATTEMPTS && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <span className="font-medium">Security Notice:</span> You have {getRemainingAttempts()} login attempt{getRemainingAttempts() !== 1 ? 's' : ''} remaining before your account is temporarily locked.
          </AlertDescription>
        </Alert>
      )}

      {/* Account Lockout */}
      {lockoutTime && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex flex-col gap-2">
              <span className="font-medium">Account Temporarily Locked</span>
              <span className="text-sm">
                For security reasons, this account has been temporarily locked due to multiple failed login attempts.<br />
                Please wait {LOCKOUT_MINUTES} minutes before trying again, or {" "}
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
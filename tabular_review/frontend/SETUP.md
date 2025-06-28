# Tabular Review - Register Setup Guide

This guide will help you set up the registration functionality perfectly.

## Prerequisites

1. **Supabase Account**: You need a Supabase project
2. **Node.js**: Version 18 or higher
3. **pnpm**: Package manager

## Environment Setup

1. Copy the environment example file:

   ```bash
   cp env.example .env.local
   ```

2. Update `.env.local` with your Supabase credentials:

   ```env
   # Get these from your Supabase project dashboard
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

   # App Configuration
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_API_URL=http://localhost:8000

   # Backend Configuration
   BACKEND_URL=http://localhost:8000

   # Environment
   NODE_ENV=development
   ```

## Supabase Configuration

### 1. Enable Email Confirmation (Recommended)

In your Supabase dashboard:

- Go to **Authentication** → **Settings**
- Under **Email Auth**, enable "Confirm email"
- This ensures users verify their email before accessing the app

### 2. Configure Email Templates (Optional)

Customize the confirmation email template:

- Go to **Authentication** → **Email Templates**
- Edit the "Confirm signup" template
- Add your branding and custom messaging

### 3. Set Up Redirect URLs

Configure redirect URLs for email confirmation:

- Go to **Authentication** → **URL Configuration**
- Add your site URL: `http://localhost:3000`
- Add redirect URLs: `http://localhost:3000/auth/callback`

## Register Functionality Features

### ✅ What's Included

- **Secure Password Requirements**:

  - Minimum 8 characters
  - Uppercase and lowercase letters
  - Numbers and special characters
  - Real-time strength indicator

- **Email Validation**: Real-time email format validation

- **Form Validation**: Comprehensive client-side validation

- **Email Confirmation Flow**:

  - Automatic email confirmation handling
  - Clear user feedback
  - Proper redirect after confirmation

- **Security Features**:

  - Input sanitization
  - CSRF protection
  - Rate limiting
  - XSS prevention

- **User Experience**:
  - Loading states
  - Error handling with specific messages
  - Success confirmation
  - Responsive design

### 🔧 How It Works

1. **User Registration**:

   - User fills out the registration form
   - Client-side validation occurs in real-time
   - Form submits to Supabase Auth

2. **Email Confirmation** (if enabled):

   - Supabase sends confirmation email
   - User clicks confirmation link
   - User is redirected to login page
   - User can now sign in

3. **Immediate Access** (if confirmation disabled):
   - User is immediately signed in
   - Redirected to dashboard

## Testing the Register Functionality

### 1. Start the Development Server

```bash
pnpm install
pnpm dev
```

### 2. Navigate to Register Page

Open: `http://localhost:3000/register`

### 3. Test Registration Flow

1. **Fill out the form** with valid information
2. **Check password strength** indicator
3. **Submit the form**
4. **Check your email** for confirmation (if enabled)
5. **Click confirmation link** and sign in

### 4. Test Error Scenarios

- Try registering with the same email twice
- Use weak passwords
- Leave required fields empty
- Use invalid email formats

## Troubleshooting

### Common Issues

1. **"Registration failed" error**:

   - Check your Supabase credentials in `.env.local`
   - Verify your Supabase project is active
   - Check browser console for detailed errors

2. **No confirmation email received**:

   - Check spam folder
   - Verify email confirmation is enabled in Supabase
   - Check Supabase Auth logs

3. **"User already registered" error**:

   - Use a different email address
   - Or try signing in with existing credentials

4. **Environment variable errors**:
   - Ensure `.env.local` file exists
   - Restart the development server after changes
   - Check all required variables are set

### Debug Mode

Enable console logging to troubleshoot:

1. Open browser DevTools (F12)
2. Check Console tab for detailed logs
3. Look for "Auth Context:" and "SupabaseSessionManager:" logs

## Security Considerations

The register functionality includes several security measures:

- **Password Strength Validation**: Enforces strong passwords
- **Email Verification**: Prevents fake account creation
- **Rate Limiting**: Prevents registration spam
- **Input Sanitization**: Prevents XSS attacks
- **CSRF Protection**: Prevents cross-site request forgery

## Next Steps

After registration works:

1. Set up user profiles
2. Configure user roles and permissions
3. Add social authentication (Google, GitHub, etc.)
4. Set up password reset functionality
5. Configure production email provider

## Support

If you encounter issues:

1. Check this troubleshooting guide
2. Review browser console errors
3. Check Supabase dashboard for auth logs
4. Verify environment configuration

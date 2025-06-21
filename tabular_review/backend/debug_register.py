#!/usr/bin/env python3
"""
Debug script to test the registration endpoint and identify the specific error
"""

import asyncio
from core.supabase_create import get_supabase_client, get_supabase_admin
from schemas.auth import UserCreate
from api.auth import register

async def test_registration():
    """Test the registration flow to identify the error"""
    try:
        print("🔍 Testing registration flow...")
        
        # Test 1: Check Supabase client creation
        print("\n1. Testing Supabase client creation...")
        try:
            supabase_client = get_supabase_client()
            print("✅ Supabase client created successfully")
        except Exception as e:
            print(f"❌ Supabase client creation failed: {e}")
            return
        
        # Test 2: Check Supabase admin client creation  
        print("\n2. Testing Supabase admin client creation...")
        try:
            supabase_admin = get_supabase_admin()
            print("✅ Supabase admin client created successfully")
        except Exception as e:
            print(f"❌ Supabase admin client creation failed: {e}")
            return
        
        # Test 3: Test database connection
        print("\n3. Testing database connection...")
        try:
            response = supabase_admin.table("users").select("id").limit(1).execute()
            print(f"✅ Database connection successful: {len(response.data)} users found")
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            return
        
        # Test 4: Test user creation with Supabase Auth
        print("\n4. Testing Supabase Auth user creation...")
        test_email = "test@example.com"
        test_password = "TestPassword123!"
        test_full_name = "Test User"
        
        try:
            # Check if user already exists and delete if needed
            try:
                existing_users = supabase_admin.table("users").select("*").eq("email", test_email).execute()
                if existing_users.data:
                    print(f"🧹 Cleaning up existing test user...")
                    # Delete from custom users table
                    supabase_admin.table("users").delete().eq("email", test_email).execute()
                    print("✅ Existing test user cleaned up")
            except Exception as cleanup_error:
                print(f"⚠️ Cleanup warning: {cleanup_error}")
            
            # Try to create auth user
            auth_response = supabase_client.auth.sign_up({
                "email": test_email,
                "password": test_password,
                "options": {
                    "data": {
                        "full_name": test_full_name
                    }
                }
            })
            
            if auth_response.user is None:
                print("❌ Supabase Auth user creation failed: No user returned")
                if hasattr(auth_response, 'error') and auth_response.error:
                    print(f"   Error details: {auth_response.error}")
                return
            
            print(f"✅ Supabase Auth user created: {auth_response.user.id}")
            
            # Test 5: Test custom user profile creation
            print("\n5. Testing custom user profile creation...")
            profile_data = {
                "id": auth_response.user.id,
                "email": auth_response.user.email,
                "full_name": test_full_name,
            }
            
            profile_response = supabase_admin.table("users").insert(profile_data).execute()
            
            if hasattr(profile_response, 'error') and profile_response.error:
                print(f"❌ User profile creation failed: {profile_response.error}")
                return
            
            print(f"✅ User profile created: {profile_response.data}")
            
            # Test 6: Test the full registration endpoint
            print("\n6. Testing full registration endpoint...")
            user_data = UserCreate(
                email=f"test2@example.com",
                password=test_password,
                full_name=test_full_name
            )
            
            result = await register(user_data)
            print(f"✅ Full registration successful: {result.user.email}")
            
            # Cleanup
            print("\n🧹 Cleaning up test data...")
            try:
                supabase_admin.table("users").delete().eq("email", test_email).execute()
                supabase_admin.table("users").delete().eq("email", "test2@example.com").execute()
                print("✅ Test data cleaned up")
            except Exception as cleanup_error:
                print(f"⚠️ Cleanup warning: {cleanup_error}")
            
        except Exception as e:
            print(f"❌ Registration test failed: {e}")
            print(f"   Error type: {type(e)}")
            import traceback
            print(f"   Traceback: {traceback.format_exc()}")
    
    except Exception as e:
        print(f"❌ Overall test failed: {e}")
        import traceback
        print(f"   Traceback: {traceback.format_exc()}")

if __name__ == "__main__":
    asyncio.run(test_registration()) 
/**
 * API endpoint for creating new users (admin only)
 * Uses Supabase service role key to create users in auth.users
 */

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export default async function handler(req, res) {
  const timestamp = new Date().toISOString();
  const requestId = Math.random().toString(36).substring(7);
  
  // CORS headers
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://lecrm-dev.vercel.app',
    'https://lecrm-stg.vercel.app',
    'https://lecrm.vercel.app'
  ];
  
  console.log(`\n🔐 [${timestamp}] [${requestId}] API endpoint called:`, req.method, req.url);
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    console.log(`🔐 [${requestId}] CORS origin allowed:`, origin);
  } else {
    console.log(`⚠️ [${requestId}] CORS origin not in allowed list:`, origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] OPTIONS preflight request, returning 200`);
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.error(`❌ [${requestId}] Invalid method:`, req.method);
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      requestId
    });
  }

  try {
    console.log(`\n🔐 [${requestId}] ========== CREATE USER REQUEST START ==========`);
    console.log(`🔐 [${requestId}] Request method:`, req.method);
    console.log(`🔐 [${requestId}] Request URL:`, req.url);
    console.log(`🔐 [${requestId}] Request headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`🔐 [${requestId}] Request body type:`, typeof req.body);
    console.log(`🔐 [${requestId}] Request body raw:`, req.body);
    
    // Check if body is parsed - Vercel should auto-parse JSON, but let's handle it
    let body = req.body;
    console.log(`🔐 [${requestId}] Step 1: Body parsing - type: ${typeof body}, value:`, body);
    
    // If body is undefined or null, try to read from stream (Vercel edge case)
    if (body === undefined || body === null) {
      console.log(`⚠️ [${requestId}] Body is undefined/null, this shouldn't happen in Vercel`);
      return res.status(400).json({
        success: false,
        error: 'Request body is missing',
        requestId,
        received: { type: typeof body, value: body }
      });
    }
    
    // If body is a string, try to parse it
    if (typeof body === 'string') {
      console.log(`🔐 [${requestId}] Body is string, attempting to parse JSON...`);
      console.log(`🔐 [${requestId}] String length:`, body.length);
      console.log(`🔐 [${requestId}] String content:`, body.substring(0, 200));
      try {
        body = JSON.parse(body);
        console.log(`✅ [${requestId}] Successfully parsed JSON body`);
      } catch (parseError) {
        console.error(`❌ [${requestId}] Failed to parse request body as JSON:`, parseError.message);
        console.error(`❌ [${requestId}] Body content:`, body);
        return res.status(400).json({
          success: false,
          error: 'Invalid JSON in request body',
          requestId,
          details: parseError.message
        });
      }
    }
    
    // Check if body is an object (not array, not null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      console.error(`❌ [${requestId}] Request body validation failed:`);
      console.error(`   - Body exists:`, !!body);
      console.error(`   - Body type:`, typeof body);
      console.error(`   - Is array:`, Array.isArray(body));
      console.error(`   - Body value:`, body);
      return res.status(400).json({
        success: false,
        error: 'Request body is required and must be a JSON object',
        requestId,
        received: { 
          type: typeof body, 
          exists: !!body,
          isArray: Array.isArray(body),
          value: body
        }
      });
    }
    
    console.log(`🔐 [${requestId}] Request body (parsed):`, JSON.stringify(body, null, 2));

    console.log(`✅ [${requestId}] Step 2: Body validation passed`);
    
    const { email, password, full_name, role = 'user' } = body;
    
    console.log(`🔐 [${requestId}] Step 3: Extracted values:`);
    console.log(`   - email:`, email ? `${email.substring(0, 3)}***` : 'MISSING');
    console.log(`   - hasPassword:`, !!password);
    console.log(`   - passwordLength:`, password?.length || 0);
    console.log(`   - full_name:`, full_name || 'not provided');
    console.log(`   - role:`, role);

    // Validate input
    console.log(`🔐 [${requestId}] Step 4: Validating required fields...`);
    // Check for empty strings as well as falsy values
    const emailTrimmed = email?.trim();
    const passwordTrimmed = password?.trim();
    
    if (!emailTrimmed || !passwordTrimmed) {
      console.error(`❌ [${requestId}] VALIDATION FAILED: Missing required fields`);
      console.error(`   - email:`, email, `(trimmed: "${emailTrimmed}")`);
      console.error(`   - password:`, password ? `[${password.length} chars]` : 'missing', `(trimmed: "${passwordTrimmed}")`);
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
        requestId,
        received: { 
          hasEmail: !!emailTrimmed, 
          hasPassword: !!passwordTrimmed,
          emailLength: email?.length || 0,
          passwordLength: password?.length || 0
        }
      });
    }

    // Validate email format
    console.log(`🔐 [${requestId}] Step 5: Validating email format...`);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      console.error(`❌ [${requestId}] VALIDATION FAILED: Invalid email format`);
      console.error(`   - email:`, emailTrimmed);
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
        requestId,
        received: { email: emailTrimmed }
      });
    }
    console.log(`✅ [${requestId}] Email format valid`);

    // Validate password length
    console.log(`🔐 [${requestId}] Step 6: Validating password length...`);
    if (passwordTrimmed.length < 6) {
      console.error(`❌ [${requestId}] VALIDATION FAILED: Password too short`);
      console.error(`   - password length:`, passwordTrimmed.length);
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
        requestId,
        received: { passwordLength: passwordTrimmed.length }
      });
    }
    console.log(`✅ [${requestId}] Password length valid (${passwordTrimmed.length} chars)`);

    // Validate role
    console.log(`🔐 [${requestId}] Step 7: Validating role...`);
    if (role !== 'admin' && role !== 'user') {
      console.error(`❌ [${requestId}] VALIDATION FAILED: Invalid role`);
      console.error(`   - role:`, role);
      return res.status(400).json({
        success: false,
        error: 'Role must be either "admin" or "user"',
        requestId,
        received: { role }
      });
    }
    console.log(`✅ [${requestId}] Role valid:`, role);

    console.log(`🔐 [${requestId}] Step 8: Initializing Supabase client...`);
    const supabase = getSupabase();
    console.log(`✅ [${requestId}] Supabase client created`);
    console.log(`🔐 [${requestId}] Environment check:`);
    console.log(`   - SUPABASE_URL:`, process.env.SUPABASE_URL ? `Set (${process.env.SUPABASE_URL.substring(0, 20)}...)` : '❌ Missing');
    console.log(`   - SUPABASE_SERVICE_ROLE_KEY:`, process.env.SUPABASE_SERVICE_ROLE_KEY ? `Set (${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...)` : '❌ Missing');
    console.log(`🔐 [${requestId}] Step 9: Attempting to create user in auth.users...`);

    // Create user in auth.users using admin API
    // Note: admin API requires service role key and is only available server-side
    try {
      console.log('🔐 Calling supabase.auth.admin.createUser...');
      
      // Check if admin API is available
      if (!supabase.auth.admin) {
        console.error('❌ supabase.auth.admin is not available');
        return res.status(500).json({
          success: false,
          error: 'Admin API not available. Make sure you are using the service role key.'
        });
      }

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: emailTrimmed,
        password: passwordTrimmed,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: full_name?.trim() || '',
          name: full_name?.trim() || ''
        }
      });

      if (authError) {
        console.error(`❌ [${requestId}] ERROR creating user in auth.users:`);
        console.error(`   - Error message:`, authError.message);
        console.error(`   - Error status:`, authError.status);
        console.error(`   - Full error:`, JSON.stringify(authError, null, 2));
        
        // Check if user already exists - if so, try to create/update their profile
        if (authError.message && authError.message.includes('already been registered')) {
          console.log(`⚠️ [${requestId}] User already exists, attempting to find and create profile...`);
          
          // Try to find the user by email using admin API
          const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
          
          if (listError) {
            console.error(`❌ [${requestId}] Error listing users:`, listError);
            return res.status(400).json({
              success: false,
              error: authError.message || 'Failed to create user',
              requestId,
              details: {
                status: authError.status,
                message: authError.message,
                error: authError
              }
            });
          }
          
          const existingUser = existingUsers.users.find(u => u.email === emailTrimmed);
          
          if (existingUser) {
            console.log(`✅ [${requestId}] Found existing user:`, existingUser.id);
            
            // Check if profile exists
            const { data: existingProfile, error: profileCheckError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', existingUser.id)
              .single();
            
            if (profileCheckError && profileCheckError.code !== 'PGRST116') {
              // PGRST116 is "not found" which is fine
              console.error(`❌ [${requestId}] Error checking profile:`, profileCheckError);
            }
            
            if (!existingProfile) {
              console.log(`🔐 [${requestId}] Profile doesn't exist, creating it...`);
              // Create the profile
              const { data: newProfile, error: profileCreateError } = await supabase
                .from('profiles')
                .insert({
                  id: existingUser.id,
                  email: existingUser.email,
                  full_name: full_name?.trim() || '',
                  role: role
                })
                .select()
                .single();
              
              if (profileCreateError) {
                console.error(`❌ [${requestId}] Error creating profile:`, profileCreateError);
                return res.status(400).json({
                  success: false,
                  error: 'User exists but failed to create profile. Please contact support.',
                  requestId,
                  details: {
                    authError: authError.message,
                    profileError: profileCreateError.message
                  }
                });
              }
              
              console.log(`✅ [${requestId}] Profile created for existing user`);
              return res.status(200).json({
                success: true,
                message: 'User already existed, profile created successfully',
                requestId,
                data: {
                  user: existingUser,
                  profile: newProfile
                }
              });
            } else {
              // Profile exists, just update it
              console.log(`🔐 [${requestId}] Profile exists, updating it...`);
              const { data: updatedProfile, error: profileUpdateError } = await supabase
                .from('profiles')
                .update({
                  full_name: full_name?.trim() || existingProfile.full_name || '',
                  role: role
                })
                .eq('id', existingUser.id)
                .select()
                .single();
              
              if (profileUpdateError) {
                console.error(`❌ [${requestId}] Error updating profile:`, profileUpdateError);
                return res.status(400).json({
                  success: false,
                  error: 'User exists but failed to update profile',
                  requestId
                });
              }
              
              console.log(`✅ [${requestId}] Profile updated for existing user`);
              return res.status(200).json({
                success: true,
                message: 'User already existed, profile updated successfully',
                requestId,
                data: {
                  user: existingUser,
                  profile: updatedProfile
                }
              });
            }
          }
        }
        
        // If it's not a "user exists" error, return the original error
        return res.status(400).json({
          success: false,
          error: authError.message || 'Failed to create user',
          requestId,
          details: {
            status: authError.status,
            message: authError.message,
            error: authError
          }
        });
      }

      if (!authData || !authData.user) {
        console.error(`❌ [${requestId}] No user data returned from createUser`);
        console.error(`   - authData:`, authData);
        return res.status(500).json({
          success: false,
          error: 'User creation succeeded but no user data returned',
          requestId
        });
      }

      console.log(`✅ [${requestId}] User created in auth.users:`);
      console.log(`   - User ID:`, authData.user.id);
      console.log(`   - Email:`, authData.user.email);
      
      // The trigger should automatically create the profile, but let's ensure it exists
      // and update the role if needed
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: authData.user.email,
          full_name: full_name || '',
          role: role
        }, {
          onConflict: 'id'
        })
        .select()
        .single();

      console.log(`🔐 [${requestId}] Step 10: Creating/updating profile...`);
      if (profileError) {
        console.error(`⚠️ [${requestId}] Error creating/updating profile (non-critical):`, profileError.message);
        console.error(`   - Profile error details:`, JSON.stringify(profileError, null, 2));
        // User was created but profile failed - this is not critical, the trigger should handle it
      } else {
        console.log(`✅ [${requestId}] Profile created/updated successfully`);
        console.log(`   - Profile ID:`, profileData?.id);
        console.log(`   - Profile role:`, profileData?.role);
      }

      console.log(`✅ [${requestId}] ========== CREATE USER REQUEST SUCCESS ==========\n`);
      return res.status(201).json({
        success: true,
        requestId,
        data: {
          user: authData.user,
          profile: profileData || {
            id: authData.user.id,
            email: authData.user.email,
            full_name: full_name || '',
            role: role
          }
        }
      });
    } catch (adminError) {
      console.error(`❌ [${requestId}] EXCEPTION in user creation:`);
      console.error(`   - Error message:`, adminError.message);
      console.error(`   - Error name:`, adminError.name);
      console.error(`   - Error stack:`, adminError.stack);
      console.error(`   - Full error:`, adminError);
      return res.status(500).json({
        success: false,
        error: adminError.message || 'Failed to create user',
        requestId,
        details: {
          name: adminError.name,
          message: adminError.message,
          stack: adminError.stack
        }
      });
    }

  } catch (error) {
    console.error(`❌ [${requestId}] TOP-LEVEL ERROR in createUser API:`);
    console.error(`   - Error message:`, error.message);
    console.error(`   - Error name:`, error.name);
    console.error(`   - Error stack:`, error.stack);
    console.error(`   - Full error:`, error);
    
    // Make sure we always return a valid JSON response
    try {
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
        requestId,
        details: {
          name: error.name,
          message: error.message
        }
      });
    } catch (responseError) {
      // If we can't send JSON, at least log it
      console.error(`❌ [${requestId}] Failed to send error response:`, responseError);
      return res.status(500).end('Internal server error');
    }
  }
}


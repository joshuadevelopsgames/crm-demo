# User System Setup Guide

## Overview

The LECRM system now supports role-based access control with two user roles:

- **Admin**: Full access to all features, including ICP scorecard management
- **User**: Access to all features except ICP scorecard management (Scoring page hidden from menu)

## Database Setup

### Step 1: Run the SQL Migration

Execute the `add_user_roles.sql` file in your Supabase SQL editor:

```sql
-- This adds the role field to profiles table
-- Sets jrsschroeder@gmail.com as admin
-- All other users default to 'user' role
```

**To run:**
1. Go to Supabase Dashboard → SQL Editor
2. Create a new query
3. Copy and paste the contents of `add_user_roles.sql`
4. Run the query

### Step 2: Create Initial Users

#### Admin User (jrsschroeder@gmail.com)

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter email: `jrsschroeder@gmail.com`
4. Set a password (or use "Send magic link")
5. After user is created, the profile will be automatically created
6. Update the profile role to 'admin':

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'jrsschroeder@gmail.com';
```

#### Regular User (Example Email)

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter the example email address
4. Set a password (or use "Send magic link")
5. The user will automatically have 'user' role (default)

**Note:** You can update the example email later by:
- Creating a new user with the desired email
- Or updating an existing user's email in Supabase Auth

## Role Permissions

### Admin Role (`admin`)
- ✅ Full access to all pages
- ✅ Can access Scoring page
- ✅ Can manage ICP scorecard templates
- ✅ Can see "Manage ICP Template" button in AccountScore component

### User Role (`user`)
- ✅ Access to Dashboard, Accounts, Contacts, Tasks, Sequences
- ❌ Scoring page hidden from navigation menu
- ❌ Cannot access `/scoring` route (redirects to dashboard)
- ❌ Cannot see "Manage ICP Template" button
- ✅ Can still complete scorecards (TakeScorecard page)
- ✅ Can view scorecard history

## How It Works

### User Context
- `UserContext` provides user information throughout the app
- Automatically fetches profile from `profiles` table
- Provides `isAdmin` and `canManageICP` flags

### Route Protection
- `/scoring` route is protected by `AdminRoute` component
- Non-admin users are redirected to dashboard

### Navigation Filtering
- Layout component filters navigation items based on user role
- Scoring menu item only shows for admin users

### Component-Level Permissions
- `AccountScore` component hides ICP management buttons for non-admins
- `Scoring` page checks permissions and redirects if not admin

## Testing

1. **Test Admin User:**
   - Log in as jrsschroeder@gmail.com
   - Verify "Scoring" appears in navigation menu
   - Verify can access `/scoring` page
   - Verify "Manage ICP Template" button appears in AccountScore

2. **Test Regular User:**
   - Log in as regular user
   - Verify "Scoring" does NOT appear in navigation menu
   - Try to access `/scoring` directly → should redirect to dashboard
   - Verify "Manage ICP Template" button does NOT appear in AccountScore
   - Verify can still complete scorecards and view history

## Updating User Roles

To change a user's role:

```sql
-- Make a user an admin
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'user@example.com';

-- Make a user a regular user
UPDATE profiles 
SET role = 'user' 
WHERE email = 'user@example.com';
```

## Troubleshooting

### User profile not found
- Check that the profile was created automatically (trigger should handle this)
- If not, manually create profile:

```sql
INSERT INTO profiles (id, email, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'user@example.com'),
  'user@example.com',
  'user'
);
```

### Role not updating
- Ensure you're updating the correct email
- Check that the profile exists: `SELECT * FROM profiles WHERE email = 'user@example.com';`
- Verify the role constraint: `CHECK (role IN ('admin', 'user'))`

### Navigation still showing Scoring
- Clear browser cache
- Check that user context is loading correctly
- Verify profile role in database

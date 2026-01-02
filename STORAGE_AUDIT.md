# Storage Audit: localStorage vs Server (Supabase)

This document lists all features and where their data is stored.

## 🔴 **localStorage Only** (Not on Server)

### 1. **User Preferences** (Recently Changed - Now Hybrid)
- **Dark Mode** (`darkMode`)
  - **Status**: ✅ **Now Hybrid** - Stored in both localStorage (fallback) and server (`profiles.dark_mode`)
  - **Purpose**: User's dark mode preference
  - **Location**: `src/contexts/ThemeContext.jsx`
  
- **Test Mode** (`testMode2025`)
  - **Status**: ✅ **Now Hybrid** - Stored in both localStorage (fallback) and server (`profiles.test_mode_enabled`)
  - **Purpose**: Test mode toggle for eligible users (2025 simulation)
  - **Location**: `src/contexts/TestModeContext.jsx`

### 2. **UI State & Dismissals**
- **Announcement Dismissals** (`dismissedAnnouncements`)
  - **Status**: 🔴 **localStorage Only**
  - **Purpose**: Tracks which announcements user has dismissed
  - **Location**: `src/components/AnnouncementBanner.jsx`
  - **Data**: JSON array of announcement IDs
  - **Note**: Could be moved to server for cross-device sync

- **PWA Install Prompt** (`pwa-install-prompt-seen`, `pwa-install-prompt-time`)
  - **Status**: 🔴 **localStorage Only**
  - **Purpose**: Tracks if user has seen/dismissed PWA install prompt
  - **Location**: `src/components/InstallPrompt.jsx`
  - **Note**: Device-specific, localStorage is appropriate

### 3. **Legacy Google Auth** (Deprecated?)
- **Google Auth Session** (`google_auth_token`, `google_user`, `isAuthenticated`, `authProvider`, `userEmail`)
  - **Status**: 🔴 **localStorage Only** (Legacy)
  - **Purpose**: Old Google OAuth authentication (before Supabase)
  - **Location**: `src/services/googleAuthService.js`, `src/App.jsx`
  - **Note**: Appears to be legacy code - Supabase auth is primary now

### 4. **Gmail Integration Tokens**
- **Gmail Tokens** (`gmail_access_token`, `gmail_refresh_token`, `gmail_token_expiry`, `gmail_last_sync`)
  - **Status**: 🔴 **localStorage Only**
  - **Purpose**: OAuth tokens for Gmail API access
  - **Location**: `src/services/gmailService.js`
  - **Note**: Security concern - tokens should be stored server-side or in secure storage

### 5. **Imported Data Cache** (Removed ✅)
- **Status**: ✅ **REMOVED** - No longer needed
  - **Reason**: Data is stored directly in Supabase and cached by React Query (faster in-memory cache)
  - **Removed**: `src/services/localStorageService.js` (deleted)
  - **Note**: React Query provides better performance with in-memory caching, automatic refetching, and cross-tab sync

## 🟢 **Server Only** (Supabase)

### 1. **Core Business Data**
- **Accounts** (`accounts` table)
  - **Status**: ✅ **Server Only**
  - **Purpose**: All account records
  - **Fields**: id, name, revenue_segment, annual_revenue, status, etc.

- **Contacts** (`contacts` table)
  - **Status**: ✅ **Server Only**
  - **Purpose**: All contact records
  - **Fields**: id, name, email, phone, account_id, etc.

- **Estimates** (`estimates` table)
  - **Status**: ✅ **Server Only**
  - **Purpose**: All estimate records
  - **Fields**: id, account_id, amount, status, dates, etc.

- **Jobsites** (`jobsites` table)
  - **Status**: ✅ **Server Only**
  - **Purpose**: All jobsite records

### 2. **User Management**
- **User Profiles** (`profiles` table)
  - **Status**: ✅ **Server Only**
  - **Purpose**: User account information
  - **Fields**: id, email, full_name, role, dark_mode, test_mode_enabled, etc.
  - **Note**: Now includes `dark_mode` and `test_mode_enabled` (recently added)

- **User Permissions** (`user_permissions` table)
  - **Status**: ✅ **Server Only**
  - **Purpose**: Granular permissions for users

### 3. **Notifications**
- **Notifications** (`notifications` table)
  - **Status**: ✅ **Server Only**
  - **Purpose**: User notifications (tasks, renewals, bug reports, etc.)

- **Notification Snoozes** (`notification_snoozes` table)
  - **Status**: ✅ **Server Only**
  - **Purpose**: Snoozed notification preferences

- **User Notification States** (`user_notification_states` table - JSONB)
  - **Status**: ✅ **Server Only**
  - **Purpose**: Bulk notification states (neglected accounts, renewals)

### 4. **Tasks & Activities**
- **Tasks** (`tasks` table)
  - **Status**: ✅ **Server Only**
  - **Purpose**: Task management

- **Interactions** (`interactions` table)
  - **Status**: ✅ **Server Only**
  - **Purpose**: Interaction history

### 5. **Other Data**
- **Sequences** (`sequences` table)
- **Scorecard Responses** (`scorecard_responses` table)
- **Yearly Official Data** (`yearly_official_estimates` table)

## 🟡 **sessionStorage** (Temporary, Per-Session)

- **Notification Refresh Flag** (`notifications_refreshed_{userId}`)
  - **Status**: 🟡 **sessionStorage Only**
  - **Purpose**: Prevents duplicate notification refreshes per session
  - **Location**: `src/components/NotificationBell.jsx`
  - **Note**: Appropriate for temporary session state

## 📊 **Summary**

### Total localStorage Keys: **10+**
- ✅ **2 Hybrid** (dark mode, test mode) - Now synced with server
- 🔴 **8+ localStorage Only** - Various purposes
- ✅ **5 Removed** (imported data cache) - No longer needed

### Total Server Tables: **15+**
- All core business data
- User management
- Notifications
- Tasks & activities

## 🔧 **Recommendations**

### High Priority (Security/Functionality)
1. **Gmail Tokens** → Move to server-side or secure storage
2. **Announcement Dismissals** → Move to server for cross-device sync
3. **Legacy Google Auth** → Remove if no longer used

### Medium Priority (Cleanup)
4. ✅ **Imported Data Cache** → **REMOVED** - localStorageService.js deleted (data is in Supabase, React Query handles caching)

### Low Priority (Device-Specific)
6. **PWA Install Prompt** → Keep in localStorage (device-specific is fine)

---

**Last Updated**: 
- Added server-side storage for dark mode and test mode preferences
- Removed unused localStorageService.js (imported data cache) - React Query handles caching more efficiently


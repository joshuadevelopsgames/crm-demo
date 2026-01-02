# AJAX/Fetch Calls for Notification Systems

This document describes all AJAX/fetch calls used in the notification and announcement systems.

## Overview

The application uses **React Query** (`@tanstack/react-query`) for data fetching, which provides:
- Automatic caching
- Background refetching
- Error handling
- Loading states
- Request deduplication

All API calls use the native `fetch()` API (not jQuery AJAX).

---

## 1. Announcement Banner System

### Component: `AnnouncementBanner.jsx`

**Query Key:** `['announcements', user?.id]`

**Endpoint:** `GET /api/data/announcements`

**Request:**
```javascript
const response = await fetch('/api/data/announcements', {
  headers: {
    'Authorization': `Bearer ${session.access_token}`
  }
});
```

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Announcement Title",
      "content": "Announcement content...",
      "priority": "normal|high|urgent|low",
      "is_active": true,
      "expires_at": "2025-12-31T23:59:59Z",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**React Query Configuration:**
- **Enabled:** Always enabled when user is loaded (`enabled: !!user && !userLoading`)
- **Stale Time:** 5 minutes (`staleTime: 5 * 60 * 1000`)
- **Refetch Interval:** 5 minutes (`refetchInterval: 5 * 60 * 1000`)
- **Retry:** 2 attempts (`retry: 2`)

**Client-Side Filtering:**
- Filters out inactive announcements (`is_active: false`)
- Filters out expired announcements (`expires_at <= now`)
- Filters out dismissed announcements (stored in `localStorage`)

**Dismissal:**
- Dismissed announcements are stored in `localStorage` as `dismissedAnnouncements` (array of IDs)
- Dismissal is client-side only (no API call)

---

## 2. Notification Bell System

### Component: `NotificationBell.jsx`

**Query Key:** `['notifications', currentUser?.id]`

### 2.1. Bulk Notifications (JSONB)

**Endpoint:** `GET /api/data/userNotificationStates?user_id={userId}`

**Request:**
```javascript
const response = await fetch(`/api/data/userNotificationStates?user_id=${encodeURIComponent(userId)}`);
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "notifications": {
      "neglected_account": [
        {
          "account_id": "uuid",
          "account_name": "Account Name",
          "days_since_contact": 90,
          "last_contact_date": "2024-10-01T00:00:00Z"
        }
      ],
      "renewal_reminder": [
        {
          "account_id": "uuid",
          "account_name": "Account Name",
          "renewal_date": "2025-06-15T00:00:00Z",
          "days_until_renewal": 45
        }
      ]
    }
  }
}
```

**Refresh Endpoint:** `POST /api/data/userNotificationStates`

**Refresh Request:**
```javascript
const response = await fetch('/api/data/userNotificationStates', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'refresh',
    data: { user_id: userId }
  })
});
```

**Refresh Behavior:**
- Automatically called once per session on page load
- Uses `sessionStorage` to track if refresh was already done: `notifications_refreshed_{userId}`
- Falls back to regular GET if refresh fails

### 2.2. Individual Task Notifications

**Endpoint:** `GET /api/data/notifications?user_id={userId}&limit=100`

**Request:**
```javascript
const response = await fetch(`/api/data/notifications?user_id=${encodeURIComponent(userId)}&limit=100`);
```

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "type": "task_assigned|task_overdue|task_completed|...",
      "title": "Notification Title",
      "message": "Notification message...",
      "is_read": false,
      "created_at": "2025-01-01T00:00:00Z",
      "scheduled_for": "2025-01-01T00:00:00Z",
      "related_task_id": "uuid",
      "related_account_id": "uuid"
    }
  ]
}
```

**Alternative:** Uses `base44.entities.Notification.filter()` for direct Supabase access:
```javascript
base44.entities.Notification.filter({ user_id: userId }, '-created_at')
```

**React Query Configuration:**
- **Enabled:** Always enabled when user is loaded
- **No explicit stale time** (uses React Query defaults)
- **No refetch interval** (manual refetch via `refetchNotifications()`)

---

## 3. Notification Mutations

### 3.1. Mark as Read

**Endpoint:** `PUT /api/data/notifications/{notificationId}`

**Request:**
```javascript
const response = await fetch(`/api/data/notifications/${notificationId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    is_read: true
  })
});
```

**Uses React Query Mutation:**
```javascript
const markAsReadMutation = useMutation({
  mutationFn: async (notificationId) => {
    // ... fetch call ...
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['notifications', currentUser?.id]);
  }
});
```

### 3.2. Snooze Notification

**Endpoint:** `POST /api/data/notifications/{notificationId}/snooze`

**Request:**
```javascript
const response = await fetch(`/api/data/notifications/${notificationId}/snooze`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    snooze_until: "2025-01-15T00:00:00Z"
  })
});
```

**Uses Service Function:**
```javascript
import { snoozeNotification } from '@/services/notificationService';
await snoozeNotification(notificationId, snoozeUntil);
```

---

## 4. API Endpoints

### 4.1. `/api/data/announcements`

**File:** `api/data/announcements.js`

**Methods:**
- `GET` - Fetch active announcements (all users)
- `POST` - Create announcement (admin only)

**Authentication:**
- Uses Supabase service role key (bypasses RLS)
- Validates user session via `Authorization: Bearer {token}` header

**Filtering:**
- Server-side: Filters `is_active = true` and `expires_at > now`
- Client-side: Additional filtering for dismissed announcements

### 4.2. `/api/data/userNotificationStates`

**File:** `api/data/userNotificationStates.js`

**Methods:**
- `GET` - Fetch user's notification state (JSONB)
- `POST` - Refresh user's notification state (recalculates)

**Authentication:**
- Uses Supabase service role key
- Validates `user_id` in query/body

**Refresh Action:**
- Recalculates `neglected_account` and `renewal_reminder` notifications
- Updates `user_notification_states` table JSONB column

### 4.3. `/api/data/notifications`

**File:** `api/data/notifications.js`

**Methods:**
- `GET` - Fetch individual notifications (filtered by `user_id`)
- `POST` - Create notification
- `PUT` - Update notification (e.g., mark as read)
- `DELETE` - Delete notification

**Authentication:**
- Uses Supabase service role key
- **Security:** Always filters by `user_id` to prevent unauthorized access

**Query Parameters:**
- `user_id` (required) - User ID to filter notifications
- `limit` (optional, default: 100) - Maximum number of notifications
- `unread_only` (optional, default: false) - Filter to unread only

---

## 5. Error Handling

All fetch calls include error handling:

```javascript
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    console.error('API response not OK:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText
    });
    return [];
  }
  const result = await response.json();
  if (!result.success) {
    console.error('API error:', result.error);
    return [];
  }
  return result.data || [];
} catch (error) {
  console.error('Fetch error:', error);
  return [];
}
```

**React Query Error Handling:**
- Errors are caught by React Query
- Failed queries are retried (configurable)
- Error states are available via `error` property

---

## 6. Caching Strategy

### Announcements
- **Cache Duration:** 5 minutes
- **Background Refetch:** Every 5 minutes
- **Stale While Revalidate:** Yes (shows cached data while refetching)

### Notifications
- **Cache Duration:** Default (React Query default: 0ms - always stale)
- **Background Refetch:** Manual only (via `refetchNotifications()`)
- **Invalidation:** On mutations (mark as read, snooze, etc.)

---

## 7. Performance Optimizations

1. **Pagination:** Notifications limited to 100 most recent
2. **Field Selection:** Only essential fields fetched (not full objects)
3. **Parallel Fetching:** Bulk and individual notifications fetched in parallel
4. **Request Deduplication:** React Query automatically deduplicates identical requests
5. **Conditional Fetching:** Queries only enabled when user is loaded

---

## 8. Debugging

### Check Announcement Fetch
```javascript
// In browser console
localStorage.removeItem('dismissedAnnouncements'); // Clear dismissed
// Check React Query DevTools for query state
```

### Check Notification Fetch
```javascript
// In browser console
sessionStorage.removeItem('notifications_refreshed_{userId}'); // Force refresh
// Check React Query DevTools for query state
```

### React Query DevTools
Add to `App.jsx`:
```javascript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
// ... in component
<ReactQueryDevtools initialIsOpen={false} />
```

---

## 9. Summary

| System | Endpoint | Method | Auth | Cache | Refetch |
|--------|----------|--------|------|-------|---------|
| Announcements | `/api/data/announcements` | GET | Bearer Token | 5 min | 5 min |
| Bulk Notifications | `/api/data/userNotificationStates` | GET/POST | Service Key | Default | Manual |
| Task Notifications | `/api/data/notifications` | GET | Service Key | Default | Manual |
| Mark Read | `/api/data/notifications/{id}` | PUT | Service Key | N/A | Invalidate |
| Snooze | `/api/data/notifications/{id}/snooze` | POST | Service Key | N/A | Invalidate |

---

## 10. Future Improvements

1. **WebSocket Support:** Real-time notifications via Supabase Realtime
2. **Push Notifications:** Browser push API for desktop/mobile
3. **Notification Preferences:** User-configurable notification types
4. **Batch Operations:** Mark multiple notifications as read at once
5. **Notification History:** Paginated history view


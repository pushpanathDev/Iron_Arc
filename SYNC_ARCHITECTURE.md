# Sync Queue Architecture - Implementation Guide

## Overview

The app now uses a **deferred batch sync** model instead of real-time Firebase writes. This reduces Firebase costs and enables offline functionality.

### Architecture

```
User Action → SQLite (Instant) → Mark as Unsynced →
    ↓
When App Focus / Periodic Trigger → Sync Queue (Batch) → Firebase
```

## How It Works

### 1. **Save/Delete Operations (Immediate)**

When a user adds or deletes a weight:

- ✅ Saves to **SQLite immediately** (instant UI feedback)
- ✅ Marked as `isSynced = 0` (not yet synced)
- ✅ No Firebase writes yet

### 2. **Sync Queue (Deferred)**

When the app comes back into focus (`useSyncOnFocus` hook):

- Retrieves all unsynced records from SQLite
- Batches them together
- Syncs to Firebase in one batch operation
- On success: marks records as `isSynced = 1`
- On error: stores error message for retry

### 3. **Soft Delete Pattern**

For deletions:

- Records are marked as `isDeleted = 1` in SQLite
- NOT removed from database immediately
- When synced: deletion is pushed to Firebase, then hard-deleted locally

## Database Changes

### New Columns in `body_weight` table:

```sql
isSynced INTEGER DEFAULT 0       -- 0 = pending, 1 = synced
syncError TEXT DEFAULT NULL       -- Error message if sync failed
isDeleted INTEGER DEFAULT 0       -- 0 = active, 1 = soft deleted
```

## Code Changes

### 1. **Insert/Update** (body-weight.tsx)

```tsx
// Before: immediate Firebase sync
await insertWeight(newWeight);
syncWeightAdd(user.uid, newWeight); // ❌ Removed

// After: save locally, sync later
const newWeight: BodyWeight = {
  // ...
  isSynced: 0, // Marked as unsynced
};
await insertWeight(newWeight); // ✅ Only SQLite
```

### 2. **Delete** (body-weight.tsx)

```tsx
// Before: immediate Firebase deletion
await deleteWeightById(item.id);
syncWeightDelete(user.uid, item.id); // ❌ Removed

// After: soft delete locally, sync later
await softDeleteWeight(item.id); // ✅ Marks isDeleted=1, isSynced=0
```

### 3. **Auto-Sync Hook** (useSyncOnFocus)

```tsx
// Automatically syncs when screen comes into focus
useSyncOnFocus(user?.uid);
```

## New Files

### `src/db/syncQueue.ts`

Manages batch syncing:

- `syncWeightQueue(userId)` - Sync all pending records
- `retryFailedSyncs(userId)` - Retry with exponential backoff

### `src/hooks/useSyncOnFocus.ts`

React hook that triggers sync when app/screen regains focus:

```tsx
useSyncOnFocus(user?.uid);
```

## Benefits

| Aspect                 | Before             | After                    |
| ---------------------- | ------------------ | ------------------------ |
| **Firebase Writes**    | Per action         | Batched (fewer writes)   |
| **Cost**               | Higher             | Lower (fewer writes)     |
| **Offline**            | Limited            | Full local functionality |
| **Network Resilience** | Fails on error     | Queues for retry         |
| **UI Speed**           | Waits for Firebase | Instant                  |

## Sync Flow Diagram

```
┌─────────────────────────────────────────────┐
│ User adds weight                            │
└─────────────────┬───────────────────────────┘
                  ↓
        ┌─────────────────┐
        │ Save to SQLite  │
        │ isSynced = 0    │
        │ Show "Saving"   │
        └────────┬────────┘
                 ↓
        ┌─────────────────┐
        │ App loses focus │
        │ or Periodically │
        └────────┬────────┘
                 ↓
    ┌───────────────────────┐
    │ Sync Queue Triggered  │
    └────────┬──────────────┘
             ↓
    ┌──────────────────────────┐
    │ Get unsynced records     │
    │ Batch to Firebase        │
    │ Mark as synced           │
    │ Log "☁️ Synced"          │
    └──────────────────────────┘
```

## Manual Sync (Optional)

You can manually trigger sync from anywhere:

```tsx
import { syncWeightQueue } from "../../src/db/syncQueue";

const result = await syncWeightQueue(userId);
console.log(`Synced: ${result.synced}, Failed: ${result.failed}`);
```

## Monitoring Sync Status

Check if records are synced:

```tsx
import { getUnsyncedWeights } from "../../src/db/weights";

const pending = await getUnsyncedWeights(userId);
console.log(`${pending.length} records pending sync`);
```

## Future Enhancements

1. **Periodic Sync** - Add background task to sync every X minutes
2. **Sync Indicator** - Show badge on tab when data is pending
3. **Manual Sync Button** - Let user trigger sync manually
4. **Conflict Resolution** - Handle Firebase updates vs local changes
5. **Network Monitoring** - Only sync when connected to internet

## Testing

### Test Offline Functionality

1. Add a weight
2. Turn off WiFi/airplane mode
3. The record stays in SQLite with `isSynced = 0`
4. Turn WiFi back on, switch screens or app focus
5. Sync queue triggers and pushes to Firebase

### Test Retry Logic

1. Add weight with network errors
2. Record shows `syncError = "Network failed"`
3. Next sync attempt retries with exponential backoff

### Test Soft Delete

1. Delete a weight
2. Check SQLite: `isDeleted = 1` but record still exists
3. On successful sync: record hard-deleted and removed from Firebase

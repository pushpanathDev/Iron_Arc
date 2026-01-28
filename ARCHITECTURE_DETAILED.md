# Architecture Explanation - How Each Page Works

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│ APP LAYER (UI - React)                                  │
├─────────────────────────────────────────────────────────┤
│ • body-weight.tsx    (Weight tracking page)             │
│ • analytics.tsx      (Trends & insights page)           │
│ • history.tsx        (Workout history page)             │
│ • index.tsx          (Home/dashboard page)              │
└────────────┬────────────────────────────────────────────┘
             │ Reads from ↓ Writes to ↑
┌────────────▼────────────────────────────────────────────┐
│ DATA LAYER (Business Logic)                              │
├─────────────────────────────────────────────────────────┤
│ SQLite (Local Database)     ← PRIMARY SOURCE OF TRUTH   │
│ ├─ Instant reads/writes                                 │
│ ├─ Offline-capable                                      │
│ └─ Cache + sync tracking                                │
│                                                         │
│ Sync Queue (Reliability)    ← BATCHES FOR FIREBASE      │
│ ├─ Deferred batch operations                            │
│ ├─ Retry with exponential backoff                       │
│ └─ Error tracking                                       │
│                                                         │
│ Firebase (Remote)           ← BACKUP ONLY               │
│ ├─ Read on login (future)                               │
│ └─ Write on sync (async)                                │
└─────────────────────────────────────────────────────────┘
```

---

## Page-by-Page Architecture

### 1. Body Weight Page

**File:** `app/(tabs)/body-weight.tsx`

**Purpose:** Log and track weekly body weight

**Data Flow:**

```
USER ACTION                    LAYER              DATABASE
═══════════════════════════════════════════════════════════

User enters weight
  └─> saveWeight()             ┌─────────────┐
      └─> insertWeight()  ────>│ SQLite      │
          └─> isSynced=0       │ New record  │ (isSynced=0)
              └─> Show toast    └─────────────┘
                  "Syncing..."
                      ↓
User exits page              ┌─────────────────┐
  └─> useSyncOnFocus()       │ Sync Queue      │
      └─> syncWeightQueue()  │ Batches 1-N     │
          └─> Firebase        │ records         │
              .setDoc()        └────────┬────────┘
                  ↓ Success
              markWeightSynced() ──────>│ Update record    │
              isSynced=1                  │ (isSynced=1)    │
                                          └─────────────────┘
```

**Key Functions:**

| Function           | Purpose                    | Input        | Output       |
| ------------------ | -------------------------- | ------------ | ------------ |
| `loadWeights()`    | Load user's weight history | userId       | BodyWeight[] |
| `saveWeight()`     | Add/update weight for week | weight value | isSynced=0   |
| `deleteWeight()`   | Mark weight for deletion   | weightId     | isDeleted=1  |
| `useSyncOnFocus()` | Auto-sync on page focus    | userId       | SyncStatus   |

**SQLite Queries:**

```sql
-- Load weights for display
SELECT * FROM body_weight
WHERE userId = ? AND isDeleted = 0
ORDER BY date DESC;

-- Get pending syncs
SELECT * FROM body_weight
WHERE userId = ? AND (isSynced = 0 OR isDeleted = 1)
ORDER BY createdAt ASC;

-- Add/update weight
INSERT OR REPLACE INTO body_weight
(id, userId, date, weight, createdAt, isSynced, isDeleted)
VALUES (?, ?, ?, ?, ?, 0, 0);

-- Soft delete
UPDATE body_weight
SET isDeleted = 1, isSynced = 0
WHERE id = ?;
```

**Sync Flow:**

```
1. User saves → SQLite (isSynced=0)
2. Show toast: "Weight saved ✓ (syncing...)"
3. User leaves page → useSyncOnFocus() triggers
4. syncWeightQueue() batches unsynced records
5. Firebase.setDoc() or deleteDoc()
6. If success → markWeightSynced() (isSynced=1)
7. If error → markWeightSyncError() (stores error)
8. Next page visit → checks sync status, retries if needed
```

---

### 2. Analytics Page

**File:** `app/(tabs)/analytics.tsx`

**Purpose:** Display trends, insights, charts

**Data Flow:**

```
USER OPENS PAGE               LAYER              DATABASE
═════════════════════════════════════════════════════════

page focus
  └─> useFocusEffect()         (Load fresh data)
      └─> reloadData()
          └─> Promise.all([    ┌─────────────────┐
              getAllWorkouts(),│ SQLite reads    │
              getAllWeights()  │ (no writes)     │
          ]) ────────────────> │ SELECT * FROM..│
                               └─────────────────┘
              ↓
          useMemo()            (Calculate trends)
          ├─> workoutTrend     (Group by week)
          ├─> volumeTrend      (Sum sets×reps×weight)
          └─> weightStats      (Min/max/avg/delta)
              ↓
          setWorkouts()
          setWeights()
              ↓
          Render charts
          with <MiniLineChart>
          & <WorkoutBarChart>
```

**Key Points:**

- ✅ **Read-only** - Never writes, only calculates
- ✅ **Expensive calculations** - `useMemo()` prevents re-renders
- ✅ **Uses synced data** - Pulls from SQLite (which mirrors Firebase)
- ✅ **No sync needed** - Firebase is just backup

**SQLite Queries:**

```sql
-- Load all workouts for user
SELECT * FROM workouts
WHERE userId = ?
ORDER BY createdAt DESC;

-- Load all weights for user
SELECT * FROM body_weight
WHERE userId = ? AND isDeleted = 0
ORDER BY date DESC;
```

**Why No Sync Here:**

```
Analytics page is READ-ONLY
└─> No new data created here
    └─> No sync needed
        └─> Just displays SQLite data
            └─> Firebase backup is only for recovery
```

---

### 3. History Page

**File:** `app/(tabs)/history.tsx`

**Purpose:** Show workout history list

**Data Flow:**

```
USER OPENS PAGE
  └─> Load workouts from SQLite
      └─> Display list
          └─> Filter by date/exercise
              └─> Show details on tap
```

**Similar to Analytics:**

- Read-only
- Uses SQLite data
- No sync operations
- Firebase is backup only

---

### 4. Add Workout Page

**File:** `app/add-workout.tsx`

**Purpose:** Create new workout

**Data Flow:**

```
USER ACTION                    LAYER              DATABASE
═════════════════════════════════════════════════════════

User fills form
  └─> submitWorkout()          ┌─────────────┐
      └─> insertWorkout()  ────>│ SQLite      │
          ├─> workout record    │ isSynced=0  │
          └─> workout_sets      │ (NEW)       │
              └─> Show toast    └─────────────┘
                  "Workout saved"
                      ↓
User navigates back
  └─> useSyncOnFocus() trigger
      └─> syncWorkoutQueue()  ──> Firebase
          └─> On success
              └─> markWorkoutSynced()
```

**Similar pattern to weights** but creates multiple related records.

---

## Sync Layer Deep Dive

### How syncWeightQueue Works

```
syncWeightQueue(userId)
  │
  ├─> Step 1: Get pending records
  │   └─> getUnsyncedWeights(userId)
  │       └─> SELECT * WHERE isSynced=0 OR isDeleted=1
  │
  ├─> Step 2: Check limits
  │   └─> if count > MAX_QUEUE_SIZE (1000)
  │       └─> Return error: "Queue too large"
  │
  ├─> Step 3: Loop through each record
  │   ├─> if isDeleted=1:
  │   │   └─> syncWeightDelete(userId, id)  [Firebase DELETE]
  │   │       └─> On success:
  │   │           └─> deleteWeightById(id)  [Hard delete]
  │   │
  │   └─> else (normal record):
  │       └─> syncWeightAdd(userId, data)   [Firebase SET]
  │           └─> On success:
  │               └─> markWeightSynced(id)
  │
  ├─> Step 4: Handle errors
  │   └─> if sync fails:
  │       └─> checkRetryCount(error)
  │       └─> if retries < 5:
  │           └─> markWeightSyncError()  [Store error + retry count]
  │       └─> else:
  │           └─> Skip (max retries exhausted)
  │
  └─> Step 5: Return result
      └─> { synced, failed, pending, errors }
```

**Key Safety:**

```
Fire base deletion MUST succeed first:

✅ CORRECT:
await syncWeightDelete(userId, id);  // Firebase
await deleteWeightById(id);          // Local (only after success)

❌ WRONG:
await deleteWeightById(id);          // Local
await syncWeightDelete(userId, id);  // Firebase (might fail!)
```

---

## Database Layer Deep Dive

### SQLite Tables

**body_weight**

```sql
id              TEXT PRIMARY KEY
userId          TEXT              (user that owns it)
date            TEXT              (YYYY-MM-DD format)
weight          REAL              (kg)
createdAt       INTEGER           (timestamp)
isSynced        INTEGER DEFAULT 0 (0=pending, 1=done)
syncError       TEXT DEFAULT NULL (error message if failed)
isDeleted       INTEGER DEFAULT 0 (0=active, 1=soft deleted)
```

**workouts**

```sql
id              TEXT PRIMARY KEY
userId          TEXT              (user that owns it)
date            TEXT
exercise        TEXT
category        TEXT
notes           TEXT
createdAt       INTEGER
[isSynced*      INTEGER]          * Not added yet
[syncError*     TEXT]             * (Future improvement)
```

**workout_sets**

```sql
id              INTEGER PRIMARY KEY
workoutId       TEXT              (foreign key to workouts)
reps            INTEGER
weight          INTEGER           (kg)
```

---

## Data Flow Summary

### Reading Data (All Pages)

```
Page Component
  ├─> useCallback/useEffect
  │   └─> getAllWeights(userId)  [SQLite SELECT]
  │       └─> Render UI with data
```

### Writing Data (Weight/Workout Pages)

```
User saves data
  └─> insertWeight() / insertWorkout()  [SQLite INSERT]
      ├─> Mark isSynced=0
      ├─> Show toast "Syncing..."
      └─> Return to user immediately
          └─> useSyncOnFocus() trigger (when leaving page)
              └─> syncWeightQueue()  [Firebase batch]
                  └─> On success: markWeightSynced()
                  └─> On error: markWeightSyncError() + retry
```

### Deleting Data

```
User deletes
  └─> softDeleteWeight()         [SQLite UPDATE]
      ├─> Set isDeleted=1, isSynced=0
      ├─> Remove from display (WHERE isDeleted=0)
      └─> Show toast "Deleting..."
          └─> useSyncOnFocus() trigger
              └─> syncWeightQueue()
                  └─> syncWeightDelete()    [Firebase DELETE]
                      └─> On success: hard delete local
                      └─> On error: retry next sync
```

---

## Sync Strategy Comparison

### Current (Auto-sync on focus)

```
User visits page → Auto-sync → Check Firebase
Problem: Spammy logs, unnecessary network
```

### Recommended: Hybrid (Your proposal)

```
1. Pull-to-Refresh (Primary)
   └─ User drags down on page → Manual sync

2. Global Sync Button (Secondary)
   └─ One button in settings → Sync all pages

3. Daily Auto-Sync (Background)
   └─ Once per calendar day → Silent background sync
```

**Implementation:**

```typescript
// Pull-to-refresh on weight page
<RefreshControl
  onRefresh={async () => {
    const result = await syncWeightQueue(userId);
    showToast(`${result.synced} synced`);
  }}
/>

// Global sync button
<Button
  onPress={async () => {
    await syncWeightQueue(userId);
    await syncWorkoutQueue(userId);
    showToast("All synced");
  }}
>
  Sync All
</Button>

// Daily auto-sync
useEffect(() => {
  checkAndRunDailySync(userId);  // Runs once per calendar day
}, [userId]);
```

---

## Logging Architecture

### Three Tiers of Logs

**1. App Startup**

```typescript
import { logDBStartup } from "src/utils/diagnostics";

// In _layout.tsx
useEffect(() => {
  if (user?.uid) {
    logDBStartup(user.uid); // Shows initial DB state
  }
}, [user]);

// Output:
// 🚀 APP STARTUP - DATABASE STATE
// 📊 Data Summary
//   • Total Weights:      12
//   • Pending Sync:       2
//   • Total Workouts:     45
// ⚠️ Unsynced Records:
//    - Weight abc123... (2026-01-28)
// 📈 Recent Weights:
//    ✅ 2026-01-28: 75.5kg
//    ✅ 2026-01-27: 75.2kg
//    ⏳ 2026-01-20: 74.8kg
```

**2. Page-Level Logs**

```typescript
import { createPageLogger } from "src/utils/logger";

const log = createPageLogger("BodyWeight");

// In component
log.info("Page loaded", "12 records, 2 pending");
log.success("Weight saved", "Syncing in background");
log.warn("Pending sync", "2 records need syncing");
log.error("Sync failed", "Network timeout");
```

**3. Sync Operation Logs**

```typescript
// In syncQueue.ts
logger.sync("Starting sync", "2 pending records");
logger.success("Synced", "Weight abc123");
logger.error("Sync failed", "Network error", undefined, "SyncQueue");
```

---

## Performance Characteristics

| Operation                  | Time   | Network    | Storage |
| -------------------------- | ------ | ---------- | ------- |
| Load weights (100 records) | <50ms  | None       | -       |
| Save weight                | <10ms  | None (yet) | 1KB     |
| Sync queue (100 records)   | <500ms | Yes        | -       |
| Analytics calculation      | <100ms | None       | -       |

---

## Recommendations for Future

1. **Add pull-to-refresh** to all data pages
2. **Implement daily auto-sync** (once per calendar day)
3. **Add network detection** (only sync when connected)
4. **Show sync status** badge on tabs (pending count)
5. **Multi-device support** (pull from Firebase on login)
6. **Conflict resolution** (when same record edited on 2 devices)

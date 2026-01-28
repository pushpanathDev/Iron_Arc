# Architecture Safeguards & Future Roadmap

## Current Implementation - Safety Guarantees ✅

### 1. Hard Delete Safety

```
Soft Delete (isSynced=0, isDeleted=1)
    ↓
Firebase.deleteDoc() SUCCEEDS
    ↓
Hard Delete from SQLite
    ↓
Confirm deleted locally
```

**Never** hard delete before Firebase confirms. This prevents irreversible data loss.

### 2. Retry Limits

- Max 5 retries per record (configurable: `MAX_RETRIES_PER_RECORD`)
- Exponential backoff: 2s, 4s, 8s, 16s, 32s, **60s (ceiling)**
- Prevents infinite retry loops and runaway queue growth

### 3. Queue Size Limits

- Max 1000 pending records (`MAX_QUEUE_SIZE`)
- If exceeded: stops syncing, logs error, requires manual intervention
- Prevents memory exhaustion from huge queues

### 4. Sync State Tracking

```typescript
getSyncStatus(userId) → {
  pendingCount,      // How many records need sync
  isPending,         // Boolean for UI indicator
  lastSyncTime,      // When last successful sync occurred
  failedCount,       // How many have sync errors
}
```

---

## Known Limitations (Not Yet Addressed)

### 1. **Conflict Resolution** ⚠️ Important Long-Term

**Current Behavior:**

- Local always wins (simple, good for V1)
- Firebase is passive (read-only during sync)

**Future Scenarios That Will Break This:**

- User logs in on Device A, adds weight: `90kg`
- User logs in on Device B, adds weight: `92kg`
- Device A syncs first → Firebase has `90kg`
- Device B syncs second → Firebase has `92kg`
- Device A re-downloads → sees `92kg` (lost local change)

**Solution (When Needed):**

```typescript
interface ConflictResolutionStrategy {
  timestamp: "last-write-wins";
  userId: "device-owner-wins";
  merge: "keep-both-versions"; // Not ideal for weights
}
```

**Implementation Path:**

1. Add `deviceId` to each record
2. Add `lastModified` timestamp from device
3. On sync conflict: apply strategy
4. Store both versions until user reconciles

**Timeline:** V2 or later (multi-device support)

---

### 2. **Multi-Device Sync** ⚠️ Bigger Picture

**Problem:**

- Right now: one user, one device
- Later: same user, multiple devices
- Firebase has newest data, but devices have stale local caches

**Current Risk:**

```
Device A (iOS):  90kg synced 2 days ago
Device B (Android): 85kg synced today ← newer on Firebase

Device A comes online, pulls old cache → loses Device B's data
```

**Solution Path:**

1. Pull from Firebase on app focus (not just sync)
2. Compare local vs Firebase timestamps
3. Use merging logic for conflicts
4. Detect deletions on other devices

**Implementation:**

```typescript
// New function needed:
async function pullWeightsFromFirebase(userId: string) {
  const fbWeights = await getAllFromFirebase(userId);

  for (const fbWeight of fbWeights) {
    const localWeight = await getWeightById(fbWeight.id);

    if (!localWeight) {
      // New on Firebase, add locally
      await insertWeight(fbWeight);
    } else if (fbWeight.lastModified > localWeight.lastModified) {
      // Firebase is newer, update locally
      await updateWeight(fbWeight);
    }
    // else: local is newer, will sync next time
  }
}
```

**Timeline:** V2+ (when supporting multiple devices)

---

### 3. **Queue Growth Under Poor Conditions** ⚠️ Real But Mitigated

**Scenario:**

```
- Flaky network (retries fail repeatedly)
- App never comes to focus (queue never runs)
- User keeps adding weights offline
```

**Current Safeguards:**
✅ Max retries per record (prevents infinite loop)
✅ Queue size limit (prevents memory explosion)
✅ Backoff ceiling (prevents hammering server)

**What Still Needs Work:**

- UI warning when queue is large
- Periodic sync even without focus (background task)
- Network connectivity detection (only sync when online)

**Future Improvements:**

```typescript
// Add background sync
setInterval(async () => {
  if (isConnected && pendingCount > 0) {
    await syncWeightQueue(userId);
  }
}, 5 * 60 * 1000);  // Every 5 minutes

// Show UI indicator
<SyncStatusBadge pendingCount={getSyncStatus().pendingCount} />
```

**Timeline:** V1.5 (polish phase)

---

### 4. **Logging & Observability** ⚠️ Important for Stability

**Current:**

```
console.log("☁️ Synced")
console.warn("❌ Failed")
```

**Limitation:**

- Lost when app restarts
- Can't debug production issues
- No analytics on sync health

**Future Improvements:**

```typescript
// Create sync logger
interface SyncLog {
  timestamp: number;
  userId: string;
  action: "sync" | "retry" | "error";
  recordId: string;
  details: string;
  syncTook?: number; // ms
}

class SyncLogger {
  async log(event: SyncLog) {
    // Store to local database for later analysis
    await sqliteDb.runAsync(
      `
      INSERT INTO sync_logs 
      (timestamp, userId, action, recordId, details, syncTook)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        event.timestamp,
        event.userId,
        event.action,
        event.recordId,
        event.details,
        event.syncTook,
      ],
    );
  }

  async getHealthReport(userId: string, days: number = 7) {
    // Analyze sync patterns
    return {
      totalAttempts: 0,
      successRate: 0.95,
      avgSyncTime: 250, // ms
      lastError: "...",
      averageQueueSize: 3,
    };
  }
}
```

**Timeline:** V2 (when adding analytics dashboard)

---

## Roadmap Summary

| Version          | Focus                   | Additions                                 |
| ---------------- | ----------------------- | ----------------------------------------- |
| **V1** (Current) | Cost reduction, offline | Deferred batch sync ✅                    |
| **V1.5**         | Polish & stability      | Network detection, UI indicators          |
| **V2**           | Multi-device            | Conflict resolution, pull sync, analytics |
| **V3**           | Enterprise              | Audit logs, sync versioning               |

---

## When to Add These (Decision Tree)

```
Do you have multiple users?
├─ No
│  └─ Stay at V1 (current) ✅
│
└─ Yes
   └─ Can same user use multiple devices?
      ├─ No
      │  └─ Stay at V1 ✅
      │
      └─ Yes
         └─ Add V2 features:
            ├─ Pull from Firebase on focus
            ├─ Conflict resolution
            └─ Device tracking
```

---

## Testing the Current Safeguards

### 1. Test Max Retries

```
1. Simulate offline (no internet)
2. Add weight
3. Bring online → syncs on focus
4. Turn offline again
5. Force max retries → should cap at 5
6. Check logs: "[Retry 5/5] Network error..."
```

### 2. Test Queue Limits

```
1. Modify MAX_QUEUE_SIZE to 5
2. Create 10 weights while offline
3. Bring online
4. Should get error: "Queue size exceeds limit"
5. Revert MAX_QUEUE_SIZE
```

### 3. Test Hard Delete Safety

```
1. Add weight with ID X
2. Delete it (soft delete)
3. Kill app (simulates crash)
4. Restart app
5. Weight should still exist locally (isSynced=0, isDeleted=1)
6. On sync: deleted from Firebase, then hard-deleted locally
```

---

## Debugging Commands

```typescript
// Check sync queue status
import { getSyncStatus } from "src/db/syncQueue";
const status = await getSyncStatus(userId);
console.log(status);
// { pendingCount: 3, isPending: true, lastSyncTime: 1234567890, failedCount: 1 }

// Check individual record
const weight = await getWeightById("abc123");
console.log({
  isSynced: weight.isSynced, // 0 = pending, 1 = done
  syncError: weight.syncError, // null or "[Retry 2/5] Network error..."
  isDeleted: weight.isDeleted, // 0 = active, 1 = soft deleted
});

// Force retry
import { retryFailedSyncs } from "src/db/syncQueue";
await retryFailedSyncs(userId, 5);
```

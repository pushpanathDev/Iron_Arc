# UX Recommendations - Sync Strategy & Weight Updates

## 1. Recommended Sync Strategy 🔄

### Your Three Options: Assessment

✅ **All three are GOOD and COMPATIBLE**

```
┌────────────────────────────────────────────┐
│ RECOMMENDED: Hybrid Sync Approach          │
├────────────────────────────────────────────┤
│                                            │
│ 1️⃣  PRIMARY - Pull-to-Refresh             │
│    ├─ User initiates: swipe down on page  │
│    ├─ Syncs just that page's data         │
│    └─ Shows: "Syncing..." → "Done"        │
│                                            │
│ 2️⃣  SECONDARY - Global Sync Button       │
│    ├─ Location: Settings tab              │
│    ├─ Syncs ALL pages at once            │
│    ├─ Shows: "Syncing 2 pages..."         │
│    └─ Use case: Before phone dies/loses net│
│                                            │
│ 3️⃣  PASSIVE - Daily Auto-Sync            │
│    ├─ Runs: Once per calendar day        │
│    ├─ Trigger: App open in new day       │
│    ├─ Shows: Silent (background)         │
│    └─ Fallback: Ensures backup exists    │
│                                            │
└────────────────────────────────────────────┘
```

### Why All Three?

| Strategy           | Frequency    | User Control | Network Impact      |
| ------------------ | ------------ | ------------ | ------------------- |
| Pull-to-refresh    | Per visit    | Full         | Optimal (on demand) |
| Global sync button | 1-2x per day | Full         | Batch all data      |
| Daily auto-sync    | Once/day     | None         | Passive backup      |

**They solve different problems:**

- 🔄 **Pull-to-refresh:** "I just made a change, sync now"
- 🌍 **Global sync:** "Before I close the app, backup everything"
- 🌅 **Daily sync:** "Silent backup in case network fails later"

---

### Daily Sync Timing: Calendar Day vs. 24h

**Your Question:** If user uses app 11pm-2am, when does "daily" sync?

**Answer: Use Calendar Day, not 24-hour window**

```typescript
// ✅ CORRECT: Based on calendar date
async function checkDailySync(userId: string) {
  const lastSyncDate = formatDate(await getLastSync("daily_sync"));
  const todayDate = formatDate(new Date());

  if (todayDate !== lastSyncDate) {
    // New calendar day, run sync
    await syncWeightQueue(userId);
    await setLastSync("daily_sync", Date.now());
  }
}

// Example timeline:
// Jan 28, 11:00 PM - App opens → Daily sync (haven't synced today)
// Jan 28, 11:30 PM - Page visited → No sync (already synced today)
// Jan 28, 1:00 AM  - Page visited → No sync (still Jan 28)
// Jan 29, 12:30 AM - App opens → Daily sync (new date!)
```

**Why Calendar Day?**

- Simple to understand
- Works across time zones
- Doesn't require timezone offset calculations
- User intuition: "once per day" = "once per calendar date"

---

### Implementation: Pull-to-Refresh

```typescript
// body-weight.tsx
import { RefreshControl } from "react-native";

export default function BodyWeightScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await syncWeightQueue(userId);
      showToast(
        result.success
          ? `Synced ${result.synced} records`
          : `Failed to sync`
      );
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          title="Pull to sync weights..."
        />
      }
    >
      {/* ... page content ... */}
    </ScrollView>
  );
}
```

---

### Implementation: Global Sync Button

```typescript
// In Settings tab or new Sync screen
import { syncWeightQueue } from "src/db/syncQueue";
import { syncWorkoutQueue } from "src/db/workoutQueue"; // (future)

export default function SyncScreen() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);

  const handleGlobalSync = async () => {
    setSyncing(true);
    try {
      const [weightResult, workoutResult] = await Promise.all([
        syncWeightQueue(userId),
        syncWorkoutQueue(userId),
      ]);

      const totalSynced = (weightResult.synced || 0) + (workoutResult.synced || 0);
      const totalFailed = (weightResult.failed || 0) + (workoutResult.failed || 0);

      showToast(
        `Synced: ${totalSynced}, Failed: ${totalFailed}`
      );
      setLastSync(Date.now());
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View>
      <Button
        disabled={syncing}
        onPress={handleGlobalSync}
      >
        {syncing ? "Syncing..." : "Sync All Data"}
      </Button>

      {lastSync && (
        <Text>Last synced: {formatTime(lastSync)}</Text>
      )}
    </View>
  );
}
```

---

### Implementation: Daily Auto-Sync

```typescript
// hooks/useDailySync.ts (NEW)
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

export function useDailySync(userId?: string) {
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;

      checkAndRunDailySync(userId);
    }, [userId])
  );
}

// utils/dailySync.ts
export async function checkAndRunDailySync(userId: string) {
  try {
    const lastSyncDate = formatDate(
      await getLastSync("weights_daily_sync")
    );
    const todayDate = formatDate(new Date());

    if (todayDate !== lastSyncDate) {
      console.log(`🌅 Daily sync: ${todayDate}`);
      await syncWeightQueue(userId);
      await setLastSync("weights_daily_sync", Date.now());
    }
  } catch (error) {
    console.warn("Daily sync check failed:", error);
    // Silently fail, will retry next app open
  }
}

// In _layout.tsx
export default function RootLayout() {
  const { user } = useAuth();

  useDailySync(user?.uid);  // Runs on app focus

  return (/* ... */);
}
```

---

## 2. Weight Update Frequency 📅

### Current Problem

```
User wants to log weight on Thursday
→ App forces Monday start of week
→ User thinks: "Why Monday? I exercise on Thursday!"
→ UX Confusing
```

### Three Options Analyzed

#### Option A: Weekly Only (Current - Monday-based)

```
Pros:
✅ Data integrity (can't mess up the week)
✅ Enforces consistency

Cons:
❌ User can't log when they want
❌ Confusing why Monday
❌ Loses flexibility
```

#### Option B: Daily Updates, Weekly Analysis ⭐ RECOMMENDED

```
Pros:
✅ User logs anytime (Mon-Sun)
✅ Analysis still groups by week
✅ No confusion about dates
✅ Reflects real behavior (gym days vary)
✅ More intuitive UX

Cons:
⚠️ Slightly more complex (add week_start column)
⚠️ Need to average multiple weights per week
```

#### Option C: Weekly but Custom Start

```
Pros:
✅ User chooses their week start
✅ Still enforces weekly grouping

Cons:
❌ Complex picker UX
❌ Multiple users = multiple formats
❌ Still confuses some users
```

### Recommendation: **Option B - Daily Updates, Weekly Analysis**

**Why:**

- 💪 Users gym when it fits their schedule (Tue, Wed, Sat varies)
- 📈 Weight varies by time of day, hydration, food
- 🎯 Weekly averaging smooths out daily noise
- 📱 Natural UX (log whenever)

**Schema Change:**

```typescript
// Current (problematic)
type BodyWeight = {
  id: string;
  userId: string;
  date: "2026-01-27"; // ← Forced to week start (Monday)
  weight: 75.5;
  isSynced: 0 | 1;
};

// Better (flexible)
type BodyWeight = {
  id: string;
  userId: string;
  date: "2026-01-30"; // ← Actual date (Thursday)
  weekStart: "2026-01-27"; // ← For grouping
  weight: 75.5;
  isSynced: 0 | 1;
};
```

**Database Update:**

```sql
-- Add week_start column
ALTER TABLE body_weight
ADD COLUMN weekStart TEXT;

-- Populate for existing records
UPDATE body_weight
SET weekStart = get_week_start(date);
```

**UI Changes:**

```typescript
// Before: Force Monday
"Week starting Monday, Jan 27";

// After: Show actual date with week grouping
"Weight on Thursday, Jan 30";
"(Week of Jan 27)";
```

**Analytics Changes:**

```typescript
// Current: One weight per week
const weights = [
  { date: "2026-01-27", weight: 75.5 },
  { date: "2026-02-03", weight: 75.2 },
];

// New: Multiple weights per week, group for analysis
const weights = [
  { date: "2026-01-28", weight: 75.8 },
  { date: "2026-01-30", weight: 75.5 }, // ← Same week
  { date: "2026-02-03", weight: 75.2 },
];

// Group by week
const byWeek = groupBy(weights, (w) => w.weekStart);
// {
//   "2026-01-27": [75.8, 75.5],     // Average: 75.65
//   "2026-02-03": [75.2],            // Average: 75.2
// }

// Chart shows: 75.65kg, 75.2kg
```

**Calendar Picker:**

```typescript
// Current: Forces Monday
selected = getWeekStart(pickedDate); // Always returns Monday

// New: Allows any date
selected = pickedDate; // User picks Thursday? That's fine!
weekStart = getWeekStart(pickedDate); // For grouping, not display
```

---

## 3. Updated Logging Architecture ✅

**Already implemented in [src/utils/logger.ts](src/utils/logger.ts)**

### Startup Logs

```typescript
import { logDBStartup } from "src/utils/diagnostics";

// In _layout.tsx
useEffect(() => {
  if (user?.uid) {
    logDBStartup(user.uid); // Called once on app start
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

### Page-Level Logs

```typescript
import { createPageLogger } from "src/utils/logger";

const log = createPageLogger("BodyWeight");

// In component
export default function BodyWeightScreen() {
  const { user } = useAuth();

  useEffect(() => {
    log.info("Page loaded", `User: ${user?.email}`);

    loadWeights()
      .then(() => {
        log.success("Data loaded", "Ready to display");
      })
      .catch(error => {
        log.error("Failed to load", error.message);
      });
  }, []);

  return (/* ... */);
}
```

### Sync Logs

```typescript
// Automatic from syncQueue.ts
logger.sync("Starting sync", "5 pending records");
logger.success("Synced", "Weight abc123");
logger.success("Synced", "Weight def456");
logger.error("Sync failed", "Network timeout");
```

---

## Summary Table

| Question              | Recommendation                | Why                           |
| --------------------- | ----------------------------- | ----------------------------- |
| **Sync Strategy**     | All 3 (Pull + Global + Daily) | Covers all use cases          |
| **Daily Sync Timing** | Calendar day (not 24h)        | Simpler, more intuitive       |
| **Weight Updates**    | Daily (grouped by week)       | Flexible + accurate analytics |
| **Logging**           | Structured per-page + startup | Better observability          |

---

## Next Steps

1. ✅ Add pull-to-refresh to pages
2. ✅ Implement daily auto-sync hook
3. ✅ Add global sync button to settings
4. ✅ Update weight schema (date + weekStart)
5. ✅ Update calendar picker (allow any date)
6. ✅ Update analytics (group by week, not force Monday)

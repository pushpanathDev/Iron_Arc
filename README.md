# 🏋️‍♂️ Iron Arc

**An offline-first fitness system built the way serious apps are actually engineered.**

> _Train anywhere. Sync on your terms. Own your data._

---

## Why Iron Arc Exists❓

Most fitness apps are thin clients glued to the cloud.  
They look good, feel fragile, and fall apart the moment the network does.

**Iron Arc was built to do the opposite.**

It treats the device as a first-class system, not a temporary cache.  
Everything works instantly, predictably, and offline — because that’s how real training happens.

This isn’t a feature demo.  
It’s an architecture decision.

---

## 🧠 The Philosophy (No Buzzwords)

Iron Arc follows a few non-negotiables:

- ⚡ The app must feel **instant**, even on bad networks
- 🔒 Data should live **with the user**, not behind an API
- 🔄 Sync should be **intentional**, not accidental
- 🧭 UI should never race the data layer
- 🧱 The system should scale without rewrites or hacks

If something violates these rules, it doesn’t ship.

---

## 🏗️ How It’s Engineered (At a Glance)

Iron Arc uses a **true offline-first flow**:

- 📦 Local SQLite is the **source of truth**
- ✍️ User actions commit instantly
- ☁️ Cloud sync is **deferred, batched, and explicit**
- 📊 Analytics are computed locally, not fetched
- 🧠 Navigation and state are deterministic by design

The result:  
No spinners. No flicker. No “waiting for the backend.”

Just software doing what it’s told.

---

## 👀 What You’ll Notice While Using It

You won’t see loading screens fighting each other.  
You won’t lose data because Wi-Fi dropped.  
You won’t feel the app hesitate before responding.

Workouts log instantly.  
History updates immediately.  
Insights recalculate on the spot.

Everything feels… calm.  
That’s not accidental.

---

## 🧪 What This Project Is (and Isn’t)

**It is:**

- 🛠️ A production-minded mobile system
- 📐 Designed for performance and longevity
- 🎯 Built with restraint and intent

**It is not:**

- ❌ A CRUD showcase
- ❌ A cloud-dependent experiment
- ❌ A UI prototype with mocked logic

This mirrors how serious consumer fitness products are built internally — not how demos are made.

---

## 🧰 Tech Stack (Used with Purpose)

**Frontend:**

- ⚛️ Expo + React Native
- 🎨 React Navigation
- 📦 Expo Router

**Data Layer:**

- 🗃️ SQLite (primary, offline-first source of truth)
- ☁️ Firebase Firestore & Auth (controlled, deferred sync)

**Backend:**

- 🖥️ Node.js + Express (REST API)
- 🚀 Deployed on Render
- 🤖 AI-powered workout planning & recalibration

Nothing here is trendy by accident.  
Everything earns its place.

---

## 🚀 Running It Locally

```bash
npm install
npx expo start
```

### Connecting to the Backend

The app communicates with the [Iron Arc Backend](https://github.com/pushpanathDev/Iron_Arc_Backend) for AI-powered workout planning.

**Setup:**

1. Ensure the backend is running (locally or on Render)
2. Set the backend URL in your environment:

   ```bash
   # For local development:
   export EXPO_PUBLIC_BACKEND_URL=http://10.0.2.2:3000  # Android emulator
   export EXPO_PUBLIC_BACKEND_URL=http://localhost:3000  # Physical device on same network

   # For production:
   export EXPO_PUBLIC_BACKEND_URL=https://iron-arc-backend.onrender.com
   ```

3. No additional auth setup needed — the app uses Firebase ID tokens automatically

**Available Backend Services:**

- Generate personalized workout plans
- Recalibrate weekly plans based on performance
- Substitute exercises (e.g., for injuries or equipment constraints)

## See [services/backendApi.ts](services/backendApi.ts) for implementation details.

## 📚 Documentation

Detailed guides and implementation notes are in the [Summaries repo](https://github.com/pushpanathDev/Summaries):

- Architecture & design decisions
- Feature implementation guides
- Release notes and version history
- Security & best practices

---

## 🧑‍💻 Credits

Designed & Engineered by **Pushpanath**

🔗 **Frontend Repo** → https://github.com/pushpanathDev/Iron_Arc  
🔗 **Backend Repo** → https://github.com/pushpanathDev/Iron_Arc_Backend  
🔗 **Docs & Summaries** → https://github.com/pushpanathDev/Summaries

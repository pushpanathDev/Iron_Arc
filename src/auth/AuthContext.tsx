import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { clearUserProfile, createUserProfile } from "../db/profiles";
import { auth } from "../firebase/config";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser?.email ?? null);

      if (firebaseUser) {
        // NEW LOGIN: Create profile on first login
        try {
          await createUserProfile(firebaseUser.uid, firebaseUser.email || "");
          console.log("✅ Profile created for user:", firebaseUser.uid);
        } catch (error) {
          console.warn("⚠️ Failed to create profile:", error);
        }
      }

      setUser(firebaseUser);
      setLoading(false);
    });

    return unsub;
  }, []);

  const logout = async () => {
    if (user) {
      // Clear profile data before logging out
      try {
        await clearUserProfile(user.uid);
        console.log("✅ Profile cleared for user:", user.uid);
      } catch (error) {
        console.warn("⚠️ Failed to clear profile:", error);
      }
    }

    // Sign out from Firebase
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { auth } from "../src/firebase/config";
import { useTheme } from "../src/theme/theme";
import { useAuth } from "../src/auth/AuthContext";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { colors, spacing, radius } = useTheme();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignup, setIsSignup] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "YOUR_ANDROID_CLIENT_ID",
    webClientId: "YOUR_WEB_CLIENT_ID",
  });

  useEffect(() => {
  if (user) {
    router.replace("/(tabs)");
  }
}, [user]);

  /* =====================
     EMAIL / PASSWORD AUTH
     ===================== */
  const handleAuth = async () => {
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      // ✅ FORCE navigation immediately
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* =====================
     GOOGLE SIGN-IN
     ===================== */
  useEffect(() => {
    if (response?.type === "success") {
      const idToken = response.authentication?.idToken;

      if (!idToken) {
        console.warn("Google Sign-In failed: no idToken");
        return;
      }

      const credential = GoogleAuthProvider.credential(idToken);

      signInWithCredential(auth, credential)
        .then(() => {
          // ✅ FORCE navigation
          router.replace("/(tabs)");
        })
        .catch((err) => {
          console.error("Google Sign-In error", err);
          setError("Google Sign-In failed");
        });
    }
  }, [response]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: "700",
          color: colors.textPrimary,
          marginBottom: spacing.sm,
        }}
      >
        {isSignup ? "Create Account" : "Welcome Back"}
      </Text>

      <Text
        style={{
          color: colors.textSecondary,
          marginBottom: spacing.lg,
        }}
      >
        {isSignup
          ? "Sign up to start tracking your workouts"
          : "Log in to continue your fitness journey"}
      </Text>

      {/* Email */}
      <TextInput
        placeholder="Email"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.sm,
          color: colors.textPrimary,
          marginBottom: spacing.sm,
        }}
      />

      {/* Password */}
      <TextInput
        placeholder="Password"
        placeholderTextColor={colors.textSecondary}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.sm,
          color: colors.textPrimary,
          marginBottom: spacing.md,
        }}
      />

      {error && (
        <Text style={{ color: "red", marginBottom: spacing.sm }}>
          {error}
        </Text>
      )}

      {/* Login / Signup */}
      <Pressable
        onPress={handleAuth}
        disabled={loading}
        style={{
          backgroundColor: colors.accent,
          padding: spacing.sm,
          borderRadius: radius.md,
          alignItems: "center",
          marginBottom: spacing.md,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
            {isSignup ? "Sign Up" : "Login"}
          </Text>
        )}
      </Pressable>

      {/* Google */}
      <Pressable
        onPress={() => promptAsync()}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.sm,
          borderRadius: radius.md,
          alignItems: "center",
          marginBottom: spacing.md,
        }}
      >
        <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
          Continue with Google
        </Text>
      </Pressable>

      {/* Toggle */}
      <Pressable onPress={() => setIsSignup(!isSignup)}>
        <Text
          style={{
            color: colors.textSecondary,
            textAlign: "center",
          }}
        >
          {isSignup
            ? "Already have an account? Login"
            : "New here? Create an account"}
        </Text>
      </Pressable>
    </View>
  );
}

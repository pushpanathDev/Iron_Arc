import { Ionicons } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import Constants from "expo-constants";
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
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useAuth } from "../auth/AuthContext";
import { auth } from "../firebase/config";
import { useTheme } from "../theme/theme";

WebBrowser.maybeCompleteAuthSession();

// Android Client ID - Create in Google Cloud Console:
// 1. Go to https://console.cloud.google.com/apis/credentials
// 2. Create OAuth Client ID > Android
// 3. Package: com.pushpanath_mr.GymTracker
// 4. SHA-1: Get from `eas credentials`
// 5. Paste the client ID below
const ANDROID_CLIENT_ID =
  "89046456850-s6069mv6aljj1cs3knio49fmtt6b4v6e.apps.googleusercontent.com";

export default function LoginScreen() {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignup, setIsSignup] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId:
      "89046456850-3sfgpbt5fg60uv1735p3lnedo5pvq8sd.apps.googleusercontent.com",
    androidClientId: ANDROID_CLIENT_ID,
  });

  // Navigation is handled by _layout.tsx - no need to navigate here
  // Just show loading state while auth is processing

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
      // Navigation handled by _layout.tsx after auth state changes
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
    // Don't setLoading(false) on success - keep showing loader until navigation
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

      setLoading(true);
      const credential = GoogleAuthProvider.credential(idToken);

      signInWithCredential(auth, credential).catch((err) => {
        console.error("Google Sign-In error", err);
        setError("Google Sign-In failed");
        setLoading(false);
      });
      // Navigation handled by _layout.tsx after auth state changes
    }
  }, [response]);

  // Show loading overlay while authenticating or if user exists (about to navigate)
  if (user || authLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          backgroundColor: colors.background,
          padding: spacing.lg,
          justifyContent: "center",
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      {/* LOGO / BRAND */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(500)}
        style={{ alignItems: "center", marginBottom: spacing.xl }}
      >
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: radius.full,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: spacing.md,
            backgroundColor: "#000",
            overflow: "hidden",
            ...shadows.lg,
          }}
        >
          <Image
            source={require("../assets/images/icon.png")}
            style={{ width: 100, height: 100 }}
            resizeMode="contain"
          />
        </View>
        <Text style={{ ...typography.h1, color: colors.textPrimary }}>
          Iron Arc
        </Text>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          Forge your strength
        </Text>
      </Animated.View>

      {/* HEADER */}
      <Animated.View entering={FadeInUp.delay(200).duration(400)}>
        <Text
          style={{
            ...typography.h2,
            color: colors.textPrimary,
            marginBottom: spacing.xs,
          }}
        >
          {isSignup ? "Create Account" : "Welcome Back"}
        </Text>

        <Text
          style={{
            ...typography.body,
            color: colors.textSecondary,
            marginBottom: spacing.lg,
          }}
        >
          {isSignup
            ? "Sign up to start tracking your workouts"
            : "Log in to continue your fitness journey"}
        </Text>
      </Animated.View>

      {/* FORM */}
      <Animated.View entering={FadeInUp.delay(300).duration(400)}>
        {/* Email */}
        <View style={{ marginBottom: spacing.sm }}>
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            Email
          </Text>
          <TextInput
            placeholder="your@email.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              borderRadius: radius.lg,
              padding: spacing.md,
              color: colors.textPrimary,
              fontSize: typography.body.fontSize,
            }}
          />
        </View>

        {/* Password */}
        <View style={{ marginBottom: spacing.md }}>
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            Password
          </Text>
          <TextInput
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              borderRadius: radius.lg,
              padding: spacing.md,
              color: colors.textPrimary,
              fontSize: typography.body.fontSize,
            }}
          />
        </View>

        {/* Error */}
        {error && (
          <View
            style={{
              backgroundColor: colors.errorLight,
              padding: spacing.sm,
              borderRadius: radius.md,
              marginBottom: spacing.md,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons
              name="alert-circle"
              size={18}
              color={colors.error}
              style={{ marginRight: spacing.xs }}
            />
            <Text style={{ color: colors.error, flex: 1, fontSize: 14 }}>
              {error}
            </Text>
          </View>
        )}

        {/* Login / Signup Button */}
        <Pressable
          onPress={handleAuth}
          disabled={loading}
          style={{
            backgroundColor: colors.accent,
            padding: spacing.md,
            borderRadius: radius.xl,
            alignItems: "center",
            marginBottom: spacing.md,
            opacity: loading ? 0.6 : 1,
            ...shadows.md,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>
              {isSignup ? "Sign Up" : "Login"}
            </Text>
          )}
        </Pressable>

        {/* Divider */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing.md,
          }}
        >
          <View
            style={{ flex: 1, height: 1, backgroundColor: colors.divider }}
          />
          <Text
            style={{
              ...typography.caption,
              color: colors.textMuted,
              marginHorizontal: spacing.md,
            }}
          >
            or
          </Text>
          <View
            style={{ flex: 1, height: 1, backgroundColor: colors.divider }}
          />
        </View>

        {/* Google */}
        <Pressable
          onPress={() => promptAsync()}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            padding: spacing.md,
            borderRadius: radius.xl,
            alignItems: "center",
            marginBottom: spacing.lg,
            flexDirection: "row",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="logo-google"
            size={20}
            color={colors.textPrimary}
            style={{ marginRight: spacing.sm }}
          />
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: "600",
              fontSize: 16,
            }}
          >
            Continue with Google
          </Text>
        </Pressable>

        {/* Toggle */}
        <Pressable onPress={() => setIsSignup(!isSignup)}>
          <Text
            style={{
              ...typography.body,
              color: colors.textSecondary,
              textAlign: "center",
            }}
          >
            {isSignup ? "Already have an account? " : "New here? "}
            <Text style={{ color: colors.accent, fontWeight: "600" }}>
              {isSignup ? "Login" : "Create an account"}
            </Text>
          </Text>
        </Pressable>
      </Animated.View>

      {/* DEVELOPER CREDITS */}
      <Animated.View
        entering={FadeInUp.delay(600).duration(400)}
        style={{
          position: "absolute",
          bottom: spacing.lg,
          left: 0,
          right: 0,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            ...typography.caption,
            color: colors.textMuted,
            textAlign: "center",
          }}
        >
          Designed & Built by Pushpanath
        </Text>
        <Text
          style={{
            ...typography.caption,
            color: colors.textMuted,
            opacity: 0.6,
          }}
        >
          Version {Constants.expoConfig?.version || "1.0.0"}
        </Text>
      </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

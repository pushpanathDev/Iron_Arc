import Constants, { ExecutionEnvironment } from "expo-constants";
import type * as GoogleSigninPackage from "@react-native-google-signin/google-signin";

// The only file allowed to load @react-native-google-signin/google-signin.
// Its native module is missing in Expo Go and older dev clients, where a
// top-level import throws and breaks every route.

type GoogleSigninModule = typeof GoogleSigninPackage;

let cached: GoogleSigninModule | null | undefined;
let configured = false;

function load(): GoogleSigninModule | null {
  if (cached !== undefined) return cached;

  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    cached = null;
    return cached;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("@react-native-google-signin/google-signin") as GoogleSigninModule;
  } catch (error) {
    console.warn("[GoogleSignin] Native module unavailable; Google sign-in disabled.", error);
    cached = null;
  }
  return cached;
}

export function isGoogleSignInAvailable(): boolean {
  return load() !== null;
}

export function getGoogleSignin(): GoogleSigninModule | null {
  return load();
}

export function configureGoogle(): void {
  if (configured) return;
  const mod = load();
  if (!mod) return;

  try {
    mod.GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });
    configured = true;
  } catch (error) {
    console.warn("[GoogleSignin] configure failed:", error);
  }
}

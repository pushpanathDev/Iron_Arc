import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

const firebaseConfig = {
  apiKey: "AIzaSyAdhZjB5Trao8pOBPd6GzoTqsFcGfqye8M",
  authDomain: "gymtracker-d2180.firebaseapp.com",
  projectId: "gymtracker-d2180",
  storageBucket: "gymtracker-d2180.firebasestorage.app",
  messagingSenderId: "89046456850",
  appId: "1:89046456850:web:d03cd0ce0968a82556d6cb",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

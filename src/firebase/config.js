// src/firebase/config.js

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyAdhZjB5Trao8pOBPd6GzoTqsFcGfqye8M",
  authDomain: "gymtracker-d2180.firebaseapp.com",
  projectId: "gymtracker-d2180",
  storageBucket: "gymtracker-d2180.firebasestorage.app",
  messagingSenderId: "89046456850",
  appId: "1:89046456850:web:d03cd0ce0968a82556d6cb",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firestore
export const firestoreDb = getFirestore(app);

// ✅ Firebase Auth with persistence (VERY IMPORTANT)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

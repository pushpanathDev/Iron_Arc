/* Firebase sign-in errors in plain words. */

const WEAK_PASSWORD = "Password too weak. Use at least 8 characters with uppercase, lowercase, and numbers.";
const INVALID_EMAIL = "Invalid email address. Please check and try again.";

/** Sign in with email and password. */
export function signInErrorMessage(code: string | undefined, fallback?: string): string {
  switch (code) {
    case "auth/invalid-credential":
      return "Invalid email or password. Please check and try again.";
    case "auth/wrong-password":
    case "auth/invalid-password":
      return "Incorrect password. Please try again.";
    case "auth/user-not-found":
      return "No account found with this email. Create a new one instead.";
    case "auth/invalid-email":
      return INVALID_EMAIL;
    case "auth/too-many-requests":
      return "Too many login attempts. Try again later.";
    case "auth/operation-not-allowed":
      return "Email/password authentication is not enabled.";
    case "auth/account-exists-with-different-credential":
      return "This account exists with different sign-in credentials.";
    default:
      return fallback || "Authentication failed";
  }
}

/** Creating an account (an existing address is handled by the caller first). */
export function signUpErrorMessage(code: string | undefined, fallback?: string): string {
  switch (code) {
    case "auth/invalid-email":
      return INVALID_EMAIL;
    case "auth/weak-password":
      return WEAK_PASSWORD;
    default:
      return fallback || "Signup failed";
  }
}

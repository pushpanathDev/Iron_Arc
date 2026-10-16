import { useState } from "react";
import { validateEmail, validatePasswordStrength } from "../utils/emailPasswordValidation";

const PASSWORD_RULES = "8+ characters, with upper and lower case letters and a number.";

/**
 * The sign-in form's two fields. Email errors clear while you edit and come
 * back on blur or submit; warnings (a likely typo, a throwaway domain) stay live.
 * `onEdit` runs on every change, e.g. to clear a sign-in error.
 */
export function useLoginForm(isSignup: boolean, onEdit: () => void) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  const changeEmail = (text: string) => {
    setEmail(text);
    setEmailError(null);
    onEdit();
    if (text.length > 5) {
      const v = validateEmail(text);
      setEmailWarning(v.isValid && v.warnings.length > 0 ? v.warnings[0] : null);
    } else {
      setEmailWarning(null);
    }
  };

  const blurEmail = () => {
    if (email.length <= 5) return;
    const v = validateEmail(email);
    if (!v.isValid) setEmailError(v.errors[0]);
  };

  const changePassword = (text: string) => {
    setPassword(text);
    onEdit();
  };

  // Creating an account: the password rules, then whichever one isn't met yet.
  const passwordRuleError = isSignup && password ? validatePasswordStrength(password).errors[0] : undefined;
  const passwordHelper = isSignup ? (passwordRuleError ?? (password ? "Password meets the requirements." : PASSWORD_RULES)) : undefined;

  return {
    email,
    password,
    emailError,
    emailWarning,
    passwordHelper,
    changeEmail,
    blurEmail,
    changePassword,
    setEmailError,
    setEmailWarning,
  };
}

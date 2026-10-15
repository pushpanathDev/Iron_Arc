/** Sign-up checks: email format, throwaway email domains and password strength. */

// Common throwaway email services.
const DISPOSABLE_EMAIL_DOMAINS = [
  // Temp email services
  "tempmail.com",
  "10minutemail.com",
  "mailinator.com",
  "temp-mail.org",
  "throwaway.email",
  "guerrillamail.com",
  "temp.email",
  "yopmail.com",
  "sharklasers.com",
  "spam4.me",
  "fakeinbox.com",
  "trashmail.com",
  "minute-mail.com",
  "temp-mail.io",
  "testmail.app",
  "maildrop.cc",
  "9minutemail.com",
  "tempemails.org",
  "telemail.io",
  "tempmail.it",
  "mail.tm",
  "temp-mail.net",
  "inbox.lv",
  "mailnesia.com",
  "mytrashmail.com",
  "tempmail.net",
  "throwawaymail.com",
  "yetetxt.com",
  "dispostable.com",
  "emailondeck.com",
  "nada.email",
  "temp-mail-address.com",
  "tempemailaddress.com",
  "sharklasers.com",
  "spam4.me",
  "trashmail.com",
  "10minuteemail.com",
  "guerrillamail.info",
  "guerrillamail.biz",
  "pokemail.net",
  "spam4.me",
  "10minutemail.com",
  "temp-mail.org",
  "grr.la",
  "cool.fr.nf",
  "jetable.org",
  "kasmail.com",
  "kingsmail.com",
  "mailnesia.com",
  "mintemail.com",
  "mytrashmail.com",
  "otherinbox.com",
  "putka.com",
  "spam.la",
  "spam.su",
  "tempail.com",
  "tempail.net",
  "tempemail.net",
  "temporaryemail.net",
  "temposhmail.com",
  "trash-mail.com",
  "trashmail.de",
  "trashmail.net",
  "trashmail.org",
  "trashmail.ws",
  "trashymail.com",
  "yopmail.net",
  // Add more as needed
];

/**
 * Validates email format using RFC 5322 compliant regex
 * @param email - Email address to validate
 * @returns true if valid format, false otherwise
 */
export function isValidEmailFormat(email: string): boolean {
  // RFC 5322 simplified regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Checks if email domain is a known disposable/temporary email service
 * @param email - Email address to check
 * @returns true if disposable, false if legitimate
 */
export function isDisposableEmail(email: string): boolean {
  if (!email.includes("@")) return false;

  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;

  // Check exact domain match
  if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
    return true;
  }

  // Check subdomain (e.g., user.tempmail.com)
  const domainParts = domain.split(".");
  for (let i = 1; i < domainParts.length; i++) {
    const partialDomain = domainParts.slice(i).join(".");
    if (DISPOSABLE_EMAIL_DOMAINS.includes(partialDomain)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if email domain appears suspicious based on keyword patterns
 * This helps catch typos and new temp email variants not in the blocklist
 * Examples: tempmai.com (typo), spammail.com, fakeemail.com, etc.
 * @param email - Email address to check
 * @returns true if suspicious pattern detected, false otherwise
 */
export function isSuspiciousEmailDomain(email: string): boolean {
  if (!email.includes("@")) return false;

  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;

  // Keywords that suggest temporary/spam email services
  const suspiciousKeywords = [
    "temp", // tempmail, temporary, etc
    "trash", // trashmail, trash-mail
    "spam", // spammail, spam4me
    "fake", // fakeemail, fakemail
    "minute", // 10minutemail, minutemail
    "quick", // quickmail, fast-mail
    "throw", // throwaway
    "nada", // nada.email
    "mail-temp", // mail-temp, mailtemp
    "mail-trash", // mail-trash
    "testmail", // testmail
    "test-mail", // test-mail
    "temp-email", // temp-email
    "test-email", // test-email
  ];

  const domainLower = domain.toLowerCase();

  // Check exact keyword matches in domain
  for (const keyword of suspiciousKeywords) {
    if (domainLower.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Password strength validation
 * Requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character (optional but recommended)
 */
export interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0-100
  errors: string[];
  suggestions: string[];
}

export function validatePasswordStrength(
  password: string,
): PasswordStrengthResult {
  const errors: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  if (!password) {
    return {
      isValid: false,
      score: 0,
      errors: ["Password is required"],
      suggestions: ["Enter a password"],
    };
  }

  // Length check (minimum 8)
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  } else {
    score += 25;
  }

  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  } else {
    score += 20;
  }

  // Lowercase check
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  } else {
    score += 20;
  }

  // Number check
  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  } else {
    score += 20;
  }

  // Special character check (optional)
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    suggestions.push("Add special characters (!@#$%^&*) for stronger security");
  } else {
    score += 15;
  }

  // Very long password bonus
  if (password.length > 12) {
    score = Math.min(100, score + 5);
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    score: Math.min(100, score),
    errors,
    suggestions,
  };
}

/**
 * Comprehensive email validation
 * @param email - Email to validate
 * @returns Validation result with detailed feedback
 */
export interface EmailValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEmail(email: string): EmailValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Empty check
  if (!email || email.trim().length === 0) {
    errors.push("Email is required");
    return { isValid: false, errors, warnings };
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Format validation
  if (!isValidEmailFormat(trimmedEmail)) {
    errors.push("Invalid email format");
  }

  // Disposable email check (hard block)
  if (isDisposableEmail(trimmedEmail)) {
    errors.push(
      "Temporary email addresses are not allowed. Please use a permanent email address.",
    );
    warnings.push(
      "We detected you're using a temporary email service. These cannot be used for security reasons.",
    );
  }
  // Suspicious domain pattern check (warning, not hard block)
  else if (isSuspiciousEmailDomain(trimmedEmail)) {
    warnings.push(
      "⚠️ This email domain looks like a temporary email service. We recommend using a permanent email (Gmail, Outlook, Yahoo, etc) for better account security.",
    );
  }

  // Common typos/suspicious patterns
  if (
    trimmedEmail.includes("..") ||
    trimmedEmail.startsWith(".") ||
    trimmedEmail.endsWith(".")
  ) {
    errors.push("Email address format is invalid");
  }

  // Too short
  if (trimmedEmail.length < 5) {
    errors.push("Email address is too short");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get human-readable email validation error message
 * @param email - Email that failed validation
 * @returns User-friendly error message
 */
export function getEmailValidationMessage(email: string): string {
  const validation = validateEmail(email);

  if (validation.errors.length > 0) {
    // Check if it's a disposable email
    if (validation.errors.some((e) => e.toLowerCase().includes("temporary"))) {
      return "Please use a real email address (not a temporary one). This helps us protect your account.";
    }

    // Check if it's format issue
    if (validation.errors.some((e) => e.toLowerCase().includes("format"))) {
      return "Please enter a valid email address (e.g., yourname@gmail.com)";
    }

    // Default to first error
    return validation.errors[0];
  }

  return "Email is valid";
}

/**
 * Sanitize email for storage
 * @param email - Raw email input
 * @returns Sanitized email (lowercase, trimmed)
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}


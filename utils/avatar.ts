/**
 * Avatar generation utilities
 * Uses DiceBear API for consistent, beautiful avatars
 */

/**
 * Generate avatar URL based on user data
 * Uses DiceBear's "initials" style for email users
 * Returns Google avatar URL if available
 */
export function getAvatarUrl(options: {
  avatarUrl?: string | null;
  displayName?: string | null;
  email?: string | null;
  userId: string;
}): string {
  const { avatarUrl, displayName, email, userId } = options;

  // If user has a custom avatar (e.g., from Google), use it
  if (avatarUrl) {
    return avatarUrl;
  }

  // Generate initials-based avatar using DiceBear
  const seed = displayName || email || userId;
  const initials = getInitials(displayName || email || "User");
  
  // Use DiceBear initials style - clean, professional look
  // Background color based on seed for consistency
  const backgroundColor = generateColor(seed);
  
  return `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(seed)}&backgroundColor=${backgroundColor}&chars=2&fontSize=40&size=128`;
}

/**
 * Get user initials (max 2 characters)
 */
export function getInitials(nameOrEmail: string): string {
  if (!nameOrEmail) return "U";

  // If it's an email, use first part
  const name = nameOrEmail.includes("@") 
    ? nameOrEmail.split("@")[0] 
    : nameOrEmail;

  // Split by space or special chars
  const parts = name.split(/[\s._-]+/).filter(Boolean);

  if (parts.length >= 2) {
    // First letter of first two parts
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  // First two letters of single name
  return name.slice(0, 2).toUpperCase();
}

/**
 * Generate a consistent color based on string seed
 * Returns hex color without #
 */
function generateColor(seed: string): string {
  // Predefined pleasant colors (no # prefix for DiceBear)
  const colors = [
    "10b981", // Emerald (our accent)
    "3b82f6", // Blue
    "8b5cf6", // Purple
    "f59e0b", // Amber
    "ec4899", // Pink
    "06b6d4", // Cyan
    "84cc16", // Lime
    "f97316", // Orange
  ];

  // Simple hash from string
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Format account creation date
 */
export function formatAccountDate(timestamp: number | undefined): string {
  if (!timestamp) return "Unknown";

  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

  return date.toLocaleDateString("en", {
    month: "short",
    year: "numeric",
  });
}

/**
 * Get user initials (max 2 characters), shown when there's no photo.
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

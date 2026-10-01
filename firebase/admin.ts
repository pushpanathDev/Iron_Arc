import { userApi } from "../services/api";

/**
 * Check if the current user is authorized as an admin.
 * Delegates to the backend profile endpoint where isAdmin is set server-side.
 */
export async function isAdminUser(): Promise<boolean> {
  try {
    const profile = await userApi.getProfile();
    return profile.isAdmin === true;
  } catch {
    return false;
  }
}

export const verificationMessages = {
  resendFailed:
    "Could not send verification email. Please check your connection and try again.",
  verifyExpired:
    "Your link may have expired. Please request a new one.",
  verifyCheckFailed:
    "Unable to refresh verification status. Please try again.",
  changeEmailSuccess:
    "A verification link was sent to your new email. It will update once verified.",
  changeEmailRequiresRecentLogin:
    "Please log out and log back in before changing your email.",
  changeEmailInvalid:
    "Invalid email address. Please check and try again.",
  changeEmailInUse:
    "This email is already registered. Please use a different email.",
  bannerBody: "Secure your account by verifying your email.",
  bannerAction: "Verify now",
  bannerTitleSoft: (daysLeft: number) =>
    `Verify your email within ${daysLeft} days`,
  bannerTitleHard: "Email verification required to continue",
};

import * as Application from "expo-application";
import Constants from "expo-constants";

export function getAppVersion(): string {
  return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "dev";
}

export function getBuildNumber(): string | null {
  return Application.nativeBuildVersion ?? null;
}

export function getVersionLabel(): string {
  const version = getAppVersion();
  const build = getBuildNumber();
  if (build) return `v${version} (build ${build})`;
  return `v${version}`;
}

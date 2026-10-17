import * as Application from "expo-application";
import Constants from "expo-constants";

/** app.json's version (it ships with the JS, so it's current even on an older native build), else the installed app's. */
export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? Application.nativeApplicationVersion ?? "dev";
}

/** "v2.0.0": the version people see; the build number isn't shown. */
export function getVersionLabel(): string {
  return `v${getAppVersion()}`;
}

import { Redirect } from "expo-router";

/**
 * Component gallery for development builds. Release bundles leave the gallery
 * out entirely: Metro drops this __DEV__ branch, require included.
 */
export default function DevComponentsScreen() {
  if (__DEV__) {
    // A require (not an import) so it stays inside the branch Metro drops.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ComponentGallery } = require("../components/dev/ComponentGallery") as typeof import("../components/dev/ComponentGallery");
    return <ComponentGallery />;
  }
  return <Redirect href="/" />;
}

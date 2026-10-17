import { useState } from "react";
import { RefreshControl } from "react-native";
import { useTheme } from "../theme/theme";

/**
 * Pull-to-refresh for a screen's ScrollView: pass the returned element as its
 * `refreshControl`. The spinner shows until `refresh` settles; a failure shows
 * through the screen's own error and offline states, so it's not raised here.
 */
export function usePullToRefresh(refresh: () => Promise<unknown>) {
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch {
      // Shown by the screen (see above).
    } finally {
      setRefreshing(false);
    }
  };

  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.card} />;
}

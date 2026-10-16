import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { HEADER_HEIGHT, ROW_HEIGHT, type PickerItem } from "../components/workout/pickerList";

/**
 * The picker's pinned category title. React Native's sticky headers
 * re-position each header on every scroll frame, which on Android (new
 * architecture) made the list's text look like it quivered while scrolling.
 * Instead, one fixed title bar shows the section at the top of the list and
 * only changes when a new section reaches the top: nothing moves per frame.
 *
 * `headerHeight` is the list header's height (search and categories above the rows).
 */
export function usePinnedSection(items: PickerItem[], headerHeight: number) {
  // Each item's offset, and the pinnable section header it falls under (index, or -1).
  const { offsets, sectionOf } = useMemo(() => {
    const offs: number[] = [];
    const section: number[] = [];
    let y = 0;
    let current = -1;
    items.forEach((it, i) => {
      offs.push(y);
      y += it.type === "row" ? ROW_HEIGHT : HEADER_HEIGHT;
      if (it.type === "header") current = it.sticky ? i : -1;
      section.push(current);
    });
    return { offsets: offs, sectionOf: section };
  }, [items]);

  const [pinned, setPinned] = useState(-1);
  const pinnedRef = useRef(-1);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y - headerHeight;
      let next = -1;
      if (y >= 0 && offsets.length) {
        // Last item whose top has reached the top of the list (binary search).
        let lo = 0;
        let hi = offsets.length - 1;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (offsets[mid] <= y) lo = mid;
          else hi = mid - 1;
        }
        next = sectionOf[lo] ?? -1;
      }
      if (next !== pinnedRef.current) {
        pinnedRef.current = next;
        setPinned(next);
      }
    },
    [headerHeight, offsets, sectionOf],
  );

  // A new list (category, search) starts unpinned.
  useEffect(() => {
    pinnedRef.current = -1;
    setPinned(-1);
  }, [items]);

  const getItemLayout = useCallback(
    (_: ArrayLike<PickerItem> | null | undefined, i: number) => ({
      index: i,
      offset: headerHeight + (offsets[i] ?? 0),
      length: items[i]?.type === "row" ? ROW_HEIGHT : HEADER_HEIGHT,
    }),
    [headerHeight, offsets, items],
  );

  const item = items[pinned];
  return { pinnedHeader: item?.type === "header" ? item : null, onScroll, getItemLayout };
}

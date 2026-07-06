// Per-store tracker for overlapping async operations. isLoading stays true
// until every in-flight operation has finished, so a fast operation can no
// longer dismiss a slower one's spinner mid-flight.
interface TrackerSet {
  (partial: { isLoading: boolean; error?: null }): void;
}

export const createOpTracker = () => {
  let pending = 0;
  return {
    begin(set: TrackerSet): void {
      pending += 1;
      set({ isLoading: true, error: null });
    },
    end(set: TrackerSet): void {
      pending = Math.max(0, pending - 1);
      set({ isLoading: pending > 0 });
    },
  };
};

// Message of anything thrown, for store `error` state. The three v1 domain
// stores carry their own inline copy of this expression; they are deleted at
// the storage cutover, so they are deliberately not migrated to this helper.
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Message of anything thrown, for store `error` state.
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

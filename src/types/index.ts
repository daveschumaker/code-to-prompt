export type ErrnoException = NodeJS.ErrnoException;

// Type for values caught in catch blocks, which might not be Error instances
export type MaybeError = Error | unknown;

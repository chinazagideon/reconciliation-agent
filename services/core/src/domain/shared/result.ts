// Result<T, E> — explicit success/failure that crosses layer boundaries
// WITHOUT throwing.
//
// Analogy: instead of a landmine (a thrown exception that detonates somewhere
// up the stack you didn't expect), every fallible call hands back a sealed box
// labelled `ok` or `err`. You have to open it to use the value, so the compiler
// makes "forgot to handle the failure" impossible.

export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

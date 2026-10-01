// Escapes Postgres ILIKE/LIKE metacharacters so user input is matched
// literally. Backslash is the default escape character in Postgres.
// Order matters: escape backslash FIRST.

export function escapeLike(input: string): string {
    return input
        .replace(/\\/g, '\\\\')   // escape backslash
        .replace(/%/g, '\\%')     // escape percent
        .replace(/_/g, '\\_')     // escape underscore
}
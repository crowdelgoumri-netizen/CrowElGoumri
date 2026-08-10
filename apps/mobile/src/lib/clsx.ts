/**
 * clsx — join truthy class names. Avoids a dependency for one helper.
 * Filters null/undefined/false so conditional `className && "..."` works.
 */
export function clsx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}

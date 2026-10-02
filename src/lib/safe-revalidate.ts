import { revalidatePath } from "next/cache";

export function safeRevalidatePath(
  path: string,
  type?: "layout" | "page"
): void {
  try {
    revalidatePath(path, type);
  } catch {
    // Graceful no-op when executed outside a Next.js request lifecycle (e.g. CLI scripts, tests)
  }
}

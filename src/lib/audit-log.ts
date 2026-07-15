import { db } from "@/db/client";
import { auditLogTable } from "@/db/schema";

export async function auditLog(
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  // Fire-and-forget: intentionally NOT awaited so it never blocks the response
  db.insert(auditLogTable).values({
    action,
    entityType,
    entityId,
    metadata: metadata ? metadata : null,
    timestamp: new Date(),
  }).catch((error) => {
    console.error("Audit log failed to write:", error);
  });
}

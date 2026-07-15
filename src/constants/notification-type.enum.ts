export const NotificationType = {
  CREATION: "creation",
  REMINDER: "reminder",
} as const;

export type NotificationType = typeof NotificationType[keyof typeof NotificationType];

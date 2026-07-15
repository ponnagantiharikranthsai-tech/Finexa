export const PaymentType = {
  INTEREST: "interest",
  PRINCIPAL: "principal",
  PENALTY: "penalty",
} as const;

export type PaymentType = typeof PaymentType[keyof typeof PaymentType];

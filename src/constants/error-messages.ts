export const ErrorMessages = {
  UNAUTHORIZED: "Unauthorized access. Please log in.",
  FORBIDDEN: "Forbidden. You do not have permission for this action.",
  VALIDATION_ERROR: "Invalid inputs provided.",
  NOT_FOUND: "Requested resource not found.",
  DUPLICATE_BORROWER: "A borrower with this PAN or mobile number already exists.",
  DB_ERROR: "Database error occurred. Please try again later.",
  EXTERNAL_SERVICE_ERROR: "External service failure.",
  DOMAIN_ERROR: "Business rule violation.",
} as const;

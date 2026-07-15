import { ErrorMessages } from "@/constants/error-messages";

export class FinexaError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "FinexaError";
  }
}

export class ValidationError extends FinexaError {
  constructor(message: string = ErrorMessages.VALIDATION_ERROR) {
    super("VALIDATION_ERROR", message, 400);
  }
}

export class AuthenticationError extends FinexaError {
  constructor(message: string = ErrorMessages.UNAUTHORIZED) {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ForbiddenError extends FinexaError {
  constructor(message: string = ErrorMessages.FORBIDDEN) {
    super("FORBIDDEN", message, 403);
  }
}

export class NotFoundError extends FinexaError {
  constructor(resource: string = "Resource") {
    super("NOT_FOUND", `${resource} not found`, 404);
  }
}

export class DomainError extends FinexaError {
  constructor(message: string = ErrorMessages.DOMAIN_ERROR) {
    super("DOMAIN_ERROR", message, 422);
  }
}

export class ConflictError extends FinexaError {
  constructor(message: string = ErrorMessages.DUPLICATE_BORROWER) {
    super("CONFLICT", message, 409);
  }
}

export class ExternalServiceError extends FinexaError {
  constructor(service: string, message: string) {
    super("EXTERNAL_SERVICE_ERROR", `${service}: ${message}`, 503);
  }
}

/** Error with a user-facing message and HTTP status. */
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorMessage(e: unknown) {
  if (e instanceof AppError) return e.message;
  console.error(e);
  return "Something went wrong. Please try again.";
}

export function errorStatus(e: unknown) {
  return e instanceof AppError ? e.status : 500;
}

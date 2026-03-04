export class TallionError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "TallionError";
    this.status = status;
    this.code = code;
  }
}

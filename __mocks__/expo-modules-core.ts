export class CodedError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "CodedError";
  }
}
export const requireOptionalNativeModule = (_name: string) => null;

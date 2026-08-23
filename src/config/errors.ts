export interface PackIssue {
  readonly path: string;
  readonly message: string;
}

export class PackValidationError extends Error {
  readonly issues: readonly PackIssue[];

  constructor(message: string, issues: readonly PackIssue[]) {
    super(message);
    this.name = "PackValidationError";
    this.issues = issues;
  }
}

export const MAX_PIREP_COMMENTS = 10;

export const PIREP_COMMENT_LIMIT_MESSAGE =
  `A PIREP can have no more than ${MAX_PIREP_COMMENTS} comments.`;

export class PirepCommentLimitError extends Error {
  constructor() {
    super(PIREP_COMMENT_LIMIT_MESSAGE);
    this.name = "PirepCommentLimitError";
  }
}

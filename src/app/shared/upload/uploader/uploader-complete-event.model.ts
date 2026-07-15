/**
 * An interface that represents a completed single-file upload, carrying both the
 * parsed response body and the client-side file name of the file that completed.
 */
export interface UploaderCompleteEvent {
  /**
   * The parsed response body (e.g. a WorkspaceItem in the submission workflow)
   */
  response: any;

  /**
   * The client-side name of the file that completed uploading
   */
  fileName: string;
}

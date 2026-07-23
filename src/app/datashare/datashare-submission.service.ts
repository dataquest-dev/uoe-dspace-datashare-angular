import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DatashareSubmissionService {

  MAX_FILE_SIZE_GB = 20;
  MAX_FILE_SIZE_BYTES = this.MAX_FILE_SIZE_GB * 1024 * 1024 * 1024;

  /**
   * Calculate total size of uploaded files
   * @param files Array of file objects with sizeBytes property
   * @returns Total size in bytes
   */
  calculateTotalUploadedFilesSize(files: any[]): number {
    return files.reduce((total, file) => {
      return total + (file.sizeBytes || 0);
    }, 0);
  }

  /**
   * Check if total uploaded files size exceeds the maximum allowed size.
   * @param totalUploadedFilesSize Number of bytes
   * @returns True if total size exceeds the maximum allowed size, false otherwise
   */
  isTotalUploadedFilesSizeExceeded(totalUploadedFilesSize: number): boolean {
    return totalUploadedFilesSize > this.MAX_FILE_SIZE_BYTES;
  }

  /**
   * Format bytes to human readable format
   * @param bytes Number of bytes
   * @returns Formatted string (e.g., "1.5 MB")
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) {
      return '0 Bytes';
    }

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ProcessStatus {
  UPLOADING = "Uploading",
  TRANSCRIBING = "Transcribing",
  SUMMARIZING = "Summarizing",
  COMPLETED = "Completed",
  FAILED = "Failed",
}

export interface AccountTier {
  id: string;
  name: string;
  maxDurationSeconds: number;
  description: string;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  tierId: string;
  authMethod: "local" | "google";
  googleId?: string;
  googleEmail?: string;
  googleTokens?: GoogleTokens | null;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
}

export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  durationSeconds: number;
  status: ProcessStatus;
  gdriveFileId: string | null;
  fileName: string | null;
  // In the DB, these are stored encrypted
  transcriptionEncrypted: string | null;
  summaryEncrypted: string | null;
  errorMessage: string | null;
  createdAt: string;
  templateId: string;
  gdriveStorageType?: "real" | "simulated";
}

export interface ServerLog {
  timestamp: string;
  level: "info" | "warning" | "error" | "success";
  message: string;
  details?: string;
}

export interface VirtualDriveFile {
  id: string;
  name: string;
  sizeBytes: number;
  uploadedAt: string;
  contentType: string;
  storageType: "real" | "simulated";
}

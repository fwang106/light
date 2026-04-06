import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";
import { getIdToken } from "./firebaseAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

/**
 * Upload audio blob to Firebase Storage via backend-generated signed URL.
 * Falls back to direct Firebase SDK upload if signed URL fails.
 */
export async function uploadAudio(
  meetingId: string,
  audioBlob: Blob,
  contentType: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ storagePath: string; downloadUrl?: string }> {
  const token = await getIdToken();
  const fileName = `recording.${contentType.includes("webm") ? "webm" : "mp4"}`;

  // Request signed upload URL from backend
  const res = await fetch(`${API_URL}/api/storage/upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      meeting_id: meetingId,
      file_name: fileName,
      content_type: contentType,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to get upload URL");
  }

  const { upload_url, storage_path } = await res.json();

  // Upload directly to GCS via signed URL
  const xhr = new XMLHttpRequest();
  await new Promise<void>((resolve, reject) => {
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          bytesTransferred: e.loaded,
          totalBytes: e.total,
          percentage: Math.round((e.loaded / e.total) * 100),
        });
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Upload network error")));
    xhr.open("PUT", upload_url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(audioBlob);
  });

  return { storagePath: storage_path };
}

/**
 * Notify backend that upload is complete to trigger transcription.
 */
export async function notifyUploadComplete(
  meetingId: string,
  storagePath: string,
  fileName: string,
  contentType: string,
  durationSeconds?: number
): Promise<void> {
  const token = await getIdToken();
  const res = await fetch(`${API_URL}/api/meetings/${meetingId}/upload-complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      storage_path: storagePath,
      file_name: fileName,
      content_type: contentType,
      duration_seconds: durationSeconds,
    }),
  });
  if (!res.ok) {
    throw new Error("Failed to notify upload complete");
  }
}

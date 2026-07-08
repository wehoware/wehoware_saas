"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Paperclip,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = "image/*,application/pdf";

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdf(fileType) {
  return fileType === "application/pdf" || fileType?.startsWith("application/pdf");
}

function isImage(fileType) {
  return fileType?.startsWith("image/");
}

/**
 * Reusable attachment uploader component.
 *
 * Props:
 *   entityId       — (string|null) The bill or expense ID. When null, the
 *                    component is in "pending" mode — files are selected locally
 *                    and auto-uploaded once entityId becomes available.
 *   entityType     — "bills" | "expenses"
 *   attachments    — Array of existing attachment objects from the API
 *   onAttachmentsChange — Callback(updatedAttachments) when the list changes
 *   onPendingFilesChange — Callback(count) when pending file count changes
 *   onPendingUploadComplete — Callback() when all pending files finish uploading
 *   disabled       — Boolean to disable uploads/deletes
 *   maxFiles       — Maximum number of attachments (default 10)
 */
export default function AttachmentUploader({
  entityId,
  entityType,
  attachments = [],
  onAttachmentsChange,
  onPendingFilesChange,
  onPendingUploadComplete,
  disabled = false,
  maxFiles = 10,
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const inputRef = useRef(null);
  const prevEntityIdRef = useRef(null);

  const totalCount = attachments.length + pendingFiles.length;
  const atMaxFiles = totalCount >= maxFiles;
  const canSelect = !disabled && !uploading && !atMaxFiles;

  const validateFile = useCallback((file) => {
    if (file.size > MAX_FILE_BYTES) {
      return `File "${file.name}" exceeds the 10 MB limit`;
    }
    if (file.size === 0) {
      return `File "${file.name}" is empty`;
    }
    const type = file.type || "";
    if (!type.startsWith("image/") && !type.startsWith("application/pdf")) {
      return `File "${file.name}" is not an image or PDF`;
    }
    return null;
  }, []);

  // Notify parent of pending file count changes
  useEffect(() => {
    onPendingFilesChange?.(pendingFiles.length);
  }, [pendingFiles.length, onPendingFilesChange]);

  const uploadPendingFiles = useCallback(async () => {
    if (!entityId || pendingFiles.length === 0) return;
    setUploading(true);
    setError(null);
    const newAttachments = [...attachments];

    for (const file of pendingFiles) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(
          `/api/v1/${entityType}/${entityId}/attachments`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Upload failed");
        }

        const attachment = await res.json();
        newAttachments.push(attachment);
      } catch (err) {
        setError(err.message || "Failed to upload file");
        break;
      }
    }

    setUploading(false);
    setPendingFiles([]);
    onAttachmentsChange?.(newAttachments);
    onPendingUploadComplete?.();
  }, [entityId, entityType, pendingFiles, attachments, onAttachmentsChange, onPendingUploadComplete]);

  // Auto-upload pending files when entityId becomes available
  useEffect(() => {
    if (
      entityId &&
      prevEntityIdRef.current === null &&
      pendingFiles.length > 0 &&
      !uploading
    ) {
      uploadPendingFiles();
    }
    prevEntityIdRef.current = entityId;
  }, [entityId, pendingFiles, uploading, uploadPendingFiles]);

  const handleFileSelect = useCallback(
    async (e) => {
      e.preventDefault();
      setError(null);

      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      if (totalCount + files.length > maxFiles) {
        setError(`Maximum ${maxFiles} attachments allowed`);
        return;
      }

      const validationErrors = files.map(validateFile).filter(Boolean);
      if (validationErrors.length > 0) {
        setError(validationErrors[0]);
        return;
      }

      if (!entityId) {
        // Pending mode — store files locally, will upload after entity is created
        setPendingFiles((prev) => [...prev, ...files]);
      } else {
        // Active mode — upload immediately
        setUploading(true);
        const newAttachments = [...attachments];

        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);

          try {
            const res = await fetch(
              `/api/v1/${entityType}/${entityId}/attachments`,
              {
                method: "POST",
                body: formData,
              }
            );

            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || "Upload failed");
            }

            const attachment = await res.json();
            newAttachments.push(attachment);
          } catch (err) {
            setError(err.message || "Failed to upload file");
            break;
          }
        }

        setUploading(false);
        onAttachmentsChange?.(newAttachments);
      }

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [attachments, entityId, entityType, maxFiles, onAttachmentsChange, totalCount, validateFile]
  );

  const handleDelete = useCallback(
    async (attachmentId) => {
      if (!entityId || disabled) return;
      setError(null);

      try {
        const res = await fetch(
          `/api/v1/${entityType}/${entityId}/attachments`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: attachmentId }),
          }
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Delete failed");
        }

        const updated = attachments.filter((a) => a.id !== attachmentId);
        onAttachmentsChange?.(updated);
      } catch (err) {
        setError(err.message || "Failed to delete attachment");
      }
    },
    [attachments, entityId, entityType, disabled, onAttachmentsChange]
  );

  function removePendingFile(idx) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Attachments</span>
          {totalCount > 0 && (
            <Badge variant="secondary">{totalCount}</Badge>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          onChange={handleFileSelect}
          disabled={!canSelect}
          className="hidden"
          id={`attachment-input-${entityType}-${entityId || "pending"}`}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canSelect}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          <span className="ml-1">
            {uploading ? "Uploading..." : "Upload"}
          </span>
        </Button>
      </div>

      {!entityId && !disabled && pendingFiles.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Select files now — they will be uploaded after you save the record.
        </p>
      )}

      {atMaxFiles && (
        <p className="text-xs text-amber-600">
          Maximum {maxFiles} attachments reached.
        </p>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto shrink-0"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {totalCount === 0 && !uploading && (
        <p className="text-xs text-muted-foreground">
          No attachments yet. Images and PDFs up to 10 MB each.
        </p>
      )}

      {pendingFiles.length > 0 && (
        <ul className="space-y-2">
          {pendingFiles.map((file, idx) => {
            const pdf = isPdf(file.type);
            const img = isImage(file.type);
            return (
              <li
                key={`pending-${idx}-${file.name}`}
                className="flex items-center gap-3 rounded-md border border-dashed p-2"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted">
                  {pdf ? (
                    <FileText className="h-5 w-5 text-red-500" />
                  ) : img ? (
                    <ImageIcon className="h-5 w-5 text-blue-500" />
                  ) : (
                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)} ·{" "}
                    <span className="inline-flex items-center gap-0.5">
                      <Clock className="h-3 w-3" /> Pending
                    </span>
                  </p>
                </div>
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => removePendingFile(idx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map((att) => {
            const pdf = isPdf(att.file_type);
            const img = isImage(att.file_type);
            return (
              <li
                key={att.id}
                className="flex items-center gap-3 rounded-md border p-2"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted">
                  {pdf ? (
                    <FileText className="h-5 w-5 text-red-500" />
                  ) : img ? (
                    <ImageIcon className="h-5 w-5 text-blue-500" />
                  ) : (
                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <a
                    href={att.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm font-medium hover:underline"
                    title={att.file_name}
                  >
                    {att.file_name}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(att.file_size)}
                  </p>
                </div>
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleDelete(att.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

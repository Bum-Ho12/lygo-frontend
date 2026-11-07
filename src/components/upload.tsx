"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import type { Document, PresignResponse } from "@/lib/api/types";
import { ApiError } from "@/lib/api/problem";
import { errorText } from "@/components/states";

export function UploadDropzone({
  firmId,
  presignPath,
  confirmPath,
  matterId,
  camera = false,
  onUploaded,
}: {
  firmId: string;
  presignPath: string;
  confirmPath: string;
  matterId?: string;
  camera?: boolean;
  onUploaded?: () => void;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: (file: File) => uploadFile({ presignPath, confirmPath, file, matterId }),
    onSuccess: async () => {
      setMessage("Uploaded. Processing has started.");
      await queryClient.invalidateQueries({ queryKey: ["firm", firmId] });
      onUploaded?.();
    },
    onError: (error) => setMessage(errorText(error)),
  });

  const onDrop = (files: File[]) => {
    const file = files[0];
    if (file) upload.mutate(file);
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/csv": [".csv"],
      "image/*": [".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"],
    },
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`rounded-lygo border border-dashed px-4 py-8 text-center ${isDragActive ? "border-brand bg-brand/5" : "border-line bg-paper-raised"}`}
      >
        <input {...getInputProps()} aria-label="Upload a document" />
        <p className="font-medium">{upload.isPending ? "Uploading…" : "Drop a document, or choose a file"}</p>
        <p className="text-sm text-ink-soft">PDF, Word, CSV, or a scan. Files go straight to the firm’s storage.</p>
      </div>
      {camera ? (
        <label className="block text-sm font-medium">
          Take a photo
          <input
            className="mt-1 block w-full text-sm"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
            }}
          />
        </label>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}

async function uploadFile({
  presignPath,
  confirmPath,
  file,
  matterId,
}: {
  presignPath: string;
  confirmPath: string;
  file: File;
  matterId?: string;
}) {
  const presign = await api<PresignResponse>(presignPath, {
    method: "POST",
    body: {
      filename: file.name,
      content_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      matter_id: matterId,
    },
  });
  const stored = await fetch(presign.upload_url, {
    method: presign.method ?? "PUT",
    headers: presign.headers,
    body: file,
  });
  if (!stored.ok) {
    throw new ApiError({ type: "about:blank", title: "We couldn't save that file", status: stored.status || 502, code: "upload_failed" });
  }
  if (presign.document_id) return presign.document_id;
  const created = await api<Document>(confirmPath, {
    method: "POST",
    body: {
      storage_key: presign.storage_key,
      filename: file.name,
      content_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      title: file.name,
      matter_id: matterId,
    },
  });
  return created.id;
}

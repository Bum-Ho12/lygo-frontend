"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiForm } from "@/lib/api/browser";
import type { DocumentRow } from "@/lib/api/types";
import { errorText } from "@/components/states";

export function UploadDropzone({
  firmId,
  uploadPath,
  matterId,
  title,
  tags,
  camera = false,
  onUploaded,
}: {
  firmId: string;
  uploadPath: string;
  matterId?: string;
  title?: string;
  tags?: string;
  camera?: boolean;
  onUploaded?: (document: DocumentRow) => void;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.set("file", file);
      if (title?.trim()) form.set("title", title.trim());
      if (tags?.trim()) form.set("tags", tags.trim());
      if (matterId) form.set("matter_id", matterId);
      return apiForm<DocumentRow>(uploadPath, form);
    },
    onSuccess: async (document) => {
      setMessage(document.duplicate ? "That file is already in this firm." : "Uploaded. Lygo is reading it.");
      await queryClient.invalidateQueries({ queryKey: ["firm", firmId] });
      onUploaded?.(document);
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
        <p className="text-sm text-ink-soft">PDF, Word, CSV, or a photo of a paper document.</p>
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

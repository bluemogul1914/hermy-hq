"use client";

import { useState, useCallback } from "react";
import { Upload, FileText, Image, Video, Check, AlertCircle } from "lucide-react";
import { rise, Panel, Pill, EmptyState, Button } from "@/components/ui/kit";
import { PageHeader, ErrorState, LoadingGrid } from "@/components/mc/ui";

const ICONS = {
  image: Image,
  document: FileText,
  video: Video,
};

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadType, setUploadType] = useState<"image" | "document" | "video">("document");
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) setFiles(dropped);
  }, []);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) setFiles(selected);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setResults([]);
    setErrors([]);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    formData.append("type", uploadType);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResults(data.uploaded || []);
      if (data.errors) setErrors(data.errors);
    } catch (err: any) {
      setErrors([err?.message || "Upload failed"]);
    } finally {
      setUploading(false);
    }
  };

  const Icon = ICONS[uploadType];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Media"
        title="Upload"
        sub="Upload documents, images, or videos to Blue Mogul AI"
      />

      <div className="grid grid-cols-3 gap-2 mb-4">
        {(["image", "document", "video"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setUploadType(type)}
            className={`
              flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium
              transition-all
              ${
                uploadType === type
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-1)] text-[var(--text-2)] hover:bg-[var(--surface-2)]"
              }
            `}
          >
            {type === "image" && <Image className="w-4 h-4" />}
            {type === "document" && <FileText className="w-4 h-4" />}
            {type === "video" && <Video className="w-4 h-4" />}
            {type === "image" ? "Images" : type === "document" ? "Documents" : "Videos"}
          </button>
        ))}
      </div>

      <Panel className="p-6">
        <div
          className="
            border-2 border-dashed border-[var(--border)] rounded-xl p-8
            text-center transition-all cursor-pointer
            hover:border-[var(--accent)] hover:shadow-lg
          "
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <Icon className="w-12 h-12 mx-auto mb-3 text-[var(--text-3)]" />
          <p className="text-[var(--text-2)] text-sm mb-1">
            {files.length === 0
              ? `Drop ${uploadType === "image" ? "images" : uploadType === "document" ? "documents" : "videos"} here or click to browse`
              : `${files.length} file${files.length > 1 ? "s" : ""} selected`}
          </p>
          <p className="text-xs text-[var(--text-3)]">
            {uploadType === "video" ? "Max 100MB" : "Max 10MB"} per file
          </p>
          <input
            id="file-input"
            type="file"
            multiple
            accept={
              uploadType === "image"
                ? "image/*"
                : uploadType === "document"
                ? ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf"
                : "video/*"
            }
            onChange={onFileSelect}
            className="hidden"
          />
        </div>

        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="text-[var(--text-1)] truncate">{f.name}</span>
                <span className="text-[var(--text-3)]">{(f.size / 1024).toFixed(1)} KB</span>
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={uploading || files.length === 0}
          className="w-full mt-4"
        >
          {uploading ? "Uploading..." : `Upload ${files.length} ${uploadType === "image" ? "image" : uploadType === "document" ? "document" : "video"}${files.length > 1 ? "s" : ""}`}
        </Button>
      </Panel>

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((r) => (
            <Panel key={r.id} className="p-4">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-500" />
                <div className="flex-1">
                  <p className="font-medium text-[var(--text-1)]">{r.name}</p>
                  <p className="text-sm text-[var(--text-3)]">
                    {(r.size / 1024).toFixed(1)} KB · Uploaded {new Date(r.uploadedAt).toLocaleTimeString()}
                  </p>
                </div>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] text-sm font-medium"
                  >
                    Open
                  </a>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((e, i) => (
            <Panel key={i} className="p-3 border-red-500/30 bg-red-500/5">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <p className="text-sm text-red-400">{e}</p>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

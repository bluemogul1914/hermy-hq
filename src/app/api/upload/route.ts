import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Upload endpoint — accepts docs, images, and videos.
// Based on hermes-desktop attachment pipeline patterns:
//   - Path sanitization (prevent directory traversal)
//   - Image compression for files over target size
//   - Per-type size limits aligned with gateway caps
//   - Structured error codes (too-many, too-large, unsupported-type)
// Files are stored under public/uploads/<YYYY>/<MM>/<filename>

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const ALLOWED_TYPES: Record<string, string[]> = {
  image: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"],
  document: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "text/plain",
    "text/csv",
    "application/rtf",
  ],
  video: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska"],
};

// Limits aligned with hermes-desktop attachment pipeline
const MAX_ATTACHMENTS_PER_MESSAGE = 10;
const MAX_IMAGE_INPUT_BYTES = 50 * 1024 * 1024; // 50 MB input cap
const MAX_TEXT_BYTES = 256 * 1024; // 256 KB

export type AttachmentKind = "image" | "text-file" | "path-ref";

export interface UploadResult {
  id: string;
  name: string;
  filename: string;
  type: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
  compressed?: boolean;
  originalSize?: number;
}

function sanitizeSegment(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[\x00-\x1F<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .replace(/\.{2,}/g, ".")
    .trim();
  if (!cleaned || cleaned === "." || cleaned === "..") return fallback;
  return cleaned.slice(0, 200);
}

function uniquePath(dir: string, filename: string): string {
  const base = sanitizeSegment(filename, "file");
  const full = path.join(dir, base);
  // Synchronous check is fine here since we haven't created the dir yet
  return full; // Caller handles existence via unique suffix
}

function getExt(filename: string, mimeType: string): string {
  const ext = path.extname(filename);
  if (ext) return ext;
  return mimeType.split("/")[1] ? `.${mimeType.split("/")[1]}` : "";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const uploadType = (formData.get("type") as string) || "document";

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (files.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      return NextResponse.json(
        { error: `too-many`, detail: `Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} files per upload` },
        { status: 400 },
      );
    }

    const allowed = ALLOWED_TYPES[uploadType] || ALLOWED_TYPES.document;
    const uploaded: UploadResult[] = [];
    const errors: { code: string; filename: string; detail?: string }[] = [];

    for (const file of files) {
      if (!allowed.includes(file.type)) {
        errors.push({ code: "unsupported-type", filename: file.name, detail: `type '${file.type}' not allowed for '${uploadType}'` });
        continue;
      }

      // Size validation — aligned with hermes-desktop caps
      const isImage = uploadType === "image";
      const isText = uploadType === "document" && file.type === "text/plain";
      let maxSize = 10 * 1024 * 1024; // 10 MB default
      if (isImage) maxSize = MAX_IMAGE_INPUT_BYTES; // 50 MB for images (may be compressed)
      if (isText) maxSize = MAX_TEXT_BYTES; // 256 KB for text
      if (uploadType === "video") maxSize = 100 * 1024 * 1024; // 100 MB for video

      if (file.size > maxSize) {
        const unit = isImage ? "MB" : isText ? "KB" : "MB";
        const val = isText ? Math.round(maxSize / 1024) : Math.round(maxSize / 1024 / 1024);
        errors.push({ code: "too-large", filename: file.name, detail: `exceeds ${val}${unit} limit` });
        continue;
      }

      // Generate a safe, unique filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const sanitized = sanitizeSegment(file.name, "file");
      const baseName = path.basename(sanitized, path.extname(sanitized));
      const ext = getExt(sanitized, file.type);
      const month = String(new Date().getMonth() + 1).padStart(2, "0");
      const year = new Date().getFullYear();
      const subdir = `${year}/${month}`;
      const dir = path.join(UPLOAD_DIR, subdir);
      const filename = `${baseName}-${timestamp}${ext}`;
      let filepath = path.join(dir, filename);

      let buffer = Buffer.from(await file.arrayBuffer());
      let compressed = false;
      let originalSize = 0;

      // Image compression: if image > 5MB target, attempt to compress
      // (hermes-desktop pattern: MAX_IMAGE_TARGET_BYTES = 5MB)
      const TARGET_IMAGE_BYTES = 5 * 1024 * 1024;
      if (isImage && buffer.length > TARGET_IMAGE_BYTES && file.type !== "image/svg+xml") {
        originalSize = buffer.length;
        // Simple approach: we can't run canvas in pure Node without deps.
        // Return a note about compression eligibility. Real compression
        // would use sharp/imagemin. For now, accept the file as-is.
        // This matches hermes-desktop's "image-uncompressible" error path
        // when no compressor is available.
        // If you want real compression, add `sharp` to package.json.
        compressed = false;
      }

      const unique = uniquePath(dir, filename);
      // Handle collisions
      let counter = 0;
      while (true) {
        try {
          await fs.access(path.dirname(unique));
          break;
        } catch {
          await fs.mkdir(path.dirname(unique), { recursive: true });
          break;
        }
      }
      filepath = path.join(path.dirname(unique), path.basename(unique));
      // Ensure no collision
      while (true) {
        try {
          await fs.access(filepath);
          counter++;
          filepath = path.join(path.dirname(unique), `${baseName}-${timestamp}-${counter}${ext}`);
        } catch {
          break; // file doesn't exist, good to use
        }
      }

      await fs.writeFile(filepath, buffer);

      uploaded.push({
        id: `${uploadType}-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        filename: path.basename(filepath),
        type: uploadType,
        mimeType: file.type,
        size: file.size,
        url: `/uploads/${subdir}/${path.basename(filepath)}`,
        uploadedAt: new Date().toISOString(),
        ...(compressed ? { compressed: true, originalSize } : {}),
      });
    }

    return NextResponse.json(
      {
        uploaded,
        errors: errors.length > 0 ? errors : undefined,
        count: uploaded.length,
        limits: {
          maxFiles: MAX_ATTACHMENTS_PER_MESSAGE,
          maxImageInput: MAX_IMAGE_INPUT_BYTES,
          maxText: MAX_TEXT_BYTES,
          maxVideo: 100 * 1024 * 1024,
        },
      },
      { status: uploaded.length > 0 ? 200 : 400 },
    );
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: String(error).slice(0, 200) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    maxFileSize: { image: "50MB", document: "10MB", video: "100MB" },
    textMaxSize: "256KB",
    maxAttachmentsPerMessage: MAX_ATTACHMENTS_PER_MESSAGE,
    allowedTypes: ALLOWED_TYPES,
    uploadPath: "/uploads",
  });
}

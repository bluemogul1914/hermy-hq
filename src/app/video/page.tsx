"use client";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · Video Generator

   Record short clips from the webcam via the MediaRecorder API,
   then push them to Mission Control's video endpoints through
   the /api/mc proxy. MC_URL + MC_AUTH_TOKEN stay server-side.

   MC endpoints (server-side, behind the proxy):
     GET  /api/video/recordings  → list saved recordings
     POST /api/video/save       → upload a clip + metadata
   ─────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import { Video, Upload, Trash2 } from "lucide-react";
import { rise, Panel, Pill, EmptyState, Button } from "@/components/ui/kit";
import { PageHeader, LoadingGrid } from "@/components/mc/ui";
import { mcGetSafe, mcPost } from "@/lib/mc";

interface Recording {
  id: number;
  title: string | null;
  duration: number | null;
  created_at: string | null;
  url: string | null;
}

/* seconds → M:SS */
const fmtDuration = (s: number | null | undefined) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

/* ISO → "Mon DD, HH:MM" */
const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

export default function VideoPage() {
  // ── recordings list ──
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // ── camera ──
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const [hasCamera, setHasCamera] = useState(false);

  // ── recording ──
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  // ── save / delete ──
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    loadRecordings();
    initCamera();
    return () => {
      cleanupCamera();
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  // ── MC reads ──
  async function loadRecordings() {
    setListError(null);
    const d = await mcGetSafe<{ ok?: boolean; recordings?: Recording[] } | Recording[]>("video/recordings");
    if (!d) {
      setListError("recordings read failed");
      setRecordings([]);
    } else {
      const extracted: Recording[] = Array.isArray(d) ? d : d?.recordings ?? [];
      setRecordings(extracted);
    }
    setLoading(false);
  }

  // ── Camera ──
  async function initCamera() {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 } },
        audio: true,
      });
      if (liveVideoRef.current) liveVideoRef.current.srcObject = stream;
      setHasCamera(true);
    } catch {
      /* permission denied — empty state handles the UI */
    }
  }

  function cleanupCamera() {
    if (liveVideoRef.current?.srcObject) {
      (liveVideoRef.current.srcObject as MediaStream)
        .getTracks()
        .forEach((t) => t.stop());
      liveVideoRef.current.srcObject = null;
    }
  }

  // ── Recording ──
  function startRecording() {
    if (!hasCamera || !liveVideoRef.current?.srcObject) return;
    const stream = liveVideoRef.current.srcObject as MediaStream;
    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr;
    chunksRef.current = [];
    mr.ondataavailable = (e) => chunksRef.current.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setPreviewUrl(url);
      previewUrlRef.current = url;
    };
    mr.start();
    setRecording(true);
    setElapsed(0);
    setStatusMsg(null);
    timerRef.current = window.setInterval(
      () => setElapsed((s) => s + 1),
      1000,
    );
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function resetClip() {
    setRecordedBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    previewUrlRef.current = null;
    setElapsed(0);
    setStatusMsg(null);
  }

  // ── Upload ──
  async function upload() {
    if (!recordedBlob) return;
    setSaving(true);
    setStatusMsg(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = (reader.result ?? "") as string;
      const base64 = dataUrl.split(",")[1] ?? "";
      try {
        await mcPost("video/save", {
          title: `Clip ${fmtDuration(elapsed)}`,
          duration: elapsed,
          data: base64,
          mime: recordedBlob.type,
        });
        setStatusMsg("Uploaded to Mission Control");
        resetClip();
        loadRecordings();
      } catch (e) {
        setStatusMsg(e instanceof Error ? e.message : "upload failed");
      } finally {
        setSaving(false);
      }
    };
    reader.onerror = () => {
      setSaving(false);
      setStatusMsg("upload failed");
    };
    reader.readAsDataURL(recordedBlob);
  }

  // ── Delete ──
  async function remove(id: number) {
    setDeleting(id);
    setStatusMsg(null);
    try {
      await mcPost("video/delete", { id });
      setRecordings((prev) =>
        prev ? prev.filter((r) => r.id !== id) : prev,
      );
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : "delete failed");
    } finally {
      setDeleting(null);
    }
  }

  // ── loading guard ──
  if (loading && !recordings) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader
          eyebrow="Creative"
          title="Video Generator"
          sub="Record short clips from your webcam and upload them to Mission Control."
        />
        <LoadingGrid n={4} />
      </div>
    );
  }

  return (
    <div className="w-full mx-auto pt-2 max-w-5xl">
      <PageHeader
        eyebrow="Creative"
        title="Video Generator"
        sub="Record short clips from your webcam via the MediaRecorder API and push them to Mission Control through the Tailscale Funnel."
      />

      {/* ── Camera preview + recording ── */}
      <Panel className="p-6 mb-6 hq-rise" style={rise(0)}>
        <div className="flex items-center gap-2 mb-4">
          <Video className="w-3.5 h-3.5 text-[var(--text-3)]" />
          <span className="eyebrow">Camera preview</span>
        </div>

        <div className="relative aspect-video bg-black rounded-[var(--r-md)] overflow-hidden mb-4 border border-[var(--line)]">
          {/* live feed — always mounted so srcObject persists */}
          <video
            ref={liveVideoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              recordedBlob ? "opacity-0" : "opacity-100"
            }`}
          />
          {/* playback — layered over the live feed when a clip is ready */}
          {recordedBlob && (
            <video
              src={previewUrl ?? undefined}
              controls
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {/* recording indicator */}
          {recording && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 text-[var(--down)] num text-[11px] px-2.5 py-1 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--down)] animate-pulse" />
              REC · {fmtDuration(elapsed)}
            </div>
          )}
          {/* camera unavailable */}
          {!hasCamera && !recordedBlob && (
            <div className="absolute inset-0 flex items-center justify-center">
              <EmptyState
                icon={<Video className="w-6 h-6" />}
                title="Camera unavailable"
                hint="Allow camera access or connect a webcam to record."
              />
            </div>
          )}
        </div>

        {/* ── controls ── */}
        <div className="flex items-center justify-center gap-3">
          {!recording && !recordedBlob && (
            <Button
              variant={hasCamera ? "primary" : "ghost"}
              onClick={startRecording}
              disabled={!hasCamera}
            >
              <Video className="w-4 h-4" />
              Record
            </Button>
          )}
          {recording && (
            <Button variant="primary" onClick={stopRecording}>
              <Video className="w-4 h-4" />
              Stop
            </Button>
          )}
          {recordedBlob && (
            <>
              <Button variant="ghost" onClick={resetClip} disabled={saving}>
                <Trash2 className="w-4 h-4" />
                Discard
              </Button>
              <Button variant="primary" onClick={upload} disabled={saving}>
                <Upload className="w-4 h-4" />
                {saving ? "Uploading…" : "Upload"}
              </Button>
            </>
          )}
        </div>

        {statusMsg && (
          <p
            className="mt-3 text-[12px] num text-center"
            style={{
              color: statusMsg.includes("failed")
                ? "var(--down)"
                : "var(--up)",
            }}
          >
            {statusMsg}
          </p>
        )}
      </Panel>

      {/* ── Saved recordings ── */}
      <div className="hq-rise" style={rise(1)}>
        <div className="flex items-center gap-2 mb-3">
          <Upload className="w-3.5 h-3.5 text-[var(--text-3)]" />
          <span className="eyebrow">Saved recordings</span>
          {recordings && <Pill tone="neutral">{recordings.length}</Pill>}
        </div>

        {listError && (
          <p className="text-[12px] text-[var(--down)] mb-2">{listError}</p>
        )}

        {!recordings || recordings.length === 0 ? (
          <Panel className="p-6">
            <EmptyState
              icon={<Video className="w-6 h-6" />}
              title={listError ? "Load failed" : "No recordings yet"}
              hint={
                listError
                  ? "Could not fetch from Mission Control. Try reloading."
                  : "Record a clip above and hit Upload — it'll land here."
              }
              action={
                listError ? (
                  <Button variant="ghost" size="sm" onClick={loadRecordings}>
                    Retry
                  </Button>
                ) : undefined}
            />
          </Panel>
        ) : (
          <div className="space-y-2.5">
            {recordings!.map((r) => (
              <Panel
                key={r.id}
                className="p-3 hq-rise"
                style={rise((r.id % 6) + 2)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium text-[var(--text)] truncate">
                        {r.title ?? `Recording #${r.id}`}
                      </span>
                      <span className="num text-[11.5px] text-[var(--text-4)]">
                        • {fmtDuration(r.duration)}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-[var(--text-4)] num">
                      {fmtDate(r.created_at)}
                    </div>
                  </div>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-medium"
                      style={{ color: "var(--accent)" }}
                    >
                      Open
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(r.id)}
                    disabled={deleting === r.id}
                    className="!p-1.5"
                  >
                    {deleting === r.id ? (
                      <span className="w-3.5 h-3.5 animate-spin rounded-full border border-[var(--text-3)] border-t-transparent" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

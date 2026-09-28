"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { X, ExternalLink, Play } from "lucide-react";

export function isVideoMediaUrl(url) {
  return /\.(mp4|mov|webm|m4v|avi)(\?|#|$)/i.test(url || "");
}

export function isImageMediaUrl(url) {
  return /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp)(\?|#|$)/i.test(url || "");
}

/**
 * Square thumbnail for a media URL — images render directly, videos show
 * their first frame (preload="metadata") with a play badge overlay.
 */
export function MediaThumbnail({ url, className = "h-9 w-9" }) {
  if (isVideoMediaUrl(url)) {
    return (
      <span className={`relative inline-block overflow-hidden rounded border bg-black ${className}`}>
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Play className="h-1/2 w-1/2 max-h-5 max-w-5 text-white fill-white" />
        </span>
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className={`rounded object-cover border hover:opacity-80 transition-opacity ${className}`}
    />
  );
}

/**
 * Lightbox-style preview modal for post media. Renders images full-size and
 * videos with native controls.
 *
 * <MediaPreviewModal url={url} open={open} onOpenChange={setOpen} />
 */
export default function MediaPreviewModal({ url, open, onOpenChange }) {
  if (!url) return null;
  const isVideo = isVideoMediaUrl(url);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] p-0 border-none bg-black/95 overflow-hidden">
        <DialogTitle className="sr-only">Media preview</DialogTitle>
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            title="Open original"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            onClick={() => onOpenChange(false)}
            title="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-center min-h-[200px]">
          {isVideo ? (
            <video
              src={url}
              controls
              preload="metadata"
              className="max-h-[85vh] w-auto max-w-full mx-auto"
            />
          ) : (
            <img
              src={url}
              alt="Media preview"
              className="max-h-[85vh] w-full object-contain"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

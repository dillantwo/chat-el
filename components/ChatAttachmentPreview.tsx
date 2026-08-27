"use client";

import { useMemo } from "react";
import { X } from "lucide-react";

/**
 * Thumbnail strip for the images a user has attached but not yet sent.
 *
 * This lives in one place because the remove button has touch requirements that
 * are easy to lose when the markup is copy-pasted: it must NOT be hover-gated.
 * iPadOS Safari only synthesises :hover after a tap on something that looks
 * clickable, so an `opacity-0 group-hover:opacity-100` remove button stays fully
 * transparent on a tablet — the student can see the attached image but has no
 * visible way to drop it. The button is therefore always painted, sized for a
 * finger, and ringed in white so it reads against any photo.
 */

type Variant = "square" | "soft";
type ThumbnailSize = "md" | "lg";

const THUMBNAIL_STYLES: Record<Variant, string> = {
  /** Math / tool panels: hard corners, darker hairline. */
  square: "rounded-[4px] border-[#d8d8d8]",
  /** Chinese / English chat panels: softer corners, lighter hairline. */
  soft: "rounded-[8px] border-[#e5e5e5]",
};

const THUMBNAIL_SIZES: Record<ThumbnailSize, string> = {
  md: "size-12",
  lg: "size-16",
};

export type ChatAttachmentPreviewProps = {
  /** Pending attachments, in send order. */
  files: readonly File[];
  /** Drop the attachment at `index`. */
  onRemove: (index: number) => void;
  /**
   * Open a larger view of the attachment. When omitted the thumbnail is inert,
   * which is the right default: a tappable thumbnail competes with the remove
   * button for the same finger.
   */
  onPreview?: (url: string, index: number) => void;
  variant?: Variant;
  thumbnailSize?: ThumbnailSize;
  /** Accessible name + tooltip for the remove button. */
  removeLabel?: string;
  /** Overrides the row's default padding/gap. */
  className?: string;
};

export function ChatAttachmentPreview({
  files,
  onRemove,
  onPreview,
  variant = "soft",
  thumbnailSize = "md",
  removeLabel = "移除圖片",
  className = "px-3 pt-2.5",
}: ChatAttachmentPreviewProps) {
  // Object URLs are keyed to the file identities, not to the render, so typing
  // in the composer no longer mints a fresh blob URL per keystroke. They are
  // deliberately not revoked: React Strict Mode replays effects, and revoking
  // in an effect cleanup leaves the still-mounted <img> pointing at a dead URL.
  // `signature` stands in for `files` as the dependency: callers may hand us a
  // fresh array every render (e.g. `Array.from(someFileList)`), so depending on
  // the array identity would defeat the memo entirely.
  const signature = files.map((file) => `${file.name}:${file.size}:${file.lastModified}`).join("|");
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [signature]);

  if (files.length === 0) return null;

  return (
    // The gap and top padding are sized to swallow the remove button's 8px
    // overhang, so it never sits on top of a neighbouring thumbnail.
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {files.map((file, index) => (
        <div key={`${file.name}-${file.lastModified}-${index}`} className="relative">
          <img
            src={urls[index]}
            alt={file.name}
            onClick={onPreview ? () => onPreview(urls[index], index) : undefined}
            className={`${THUMBNAIL_SIZES[thumbnailSize]} border object-cover ${THUMBNAIL_STYLES[variant]} ${
              onPreview ? "cursor-zoom-in" : ""
            }`}
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            title={removeLabel}
            aria-label={removeLabel}
            // 28px of real, always-painted button. An invisible expanded hit
            // area would be cheaper but would also swallow taps aimed at the
            // next thumbnail or at whatever sits above the composer.
            className="absolute -top-2 -right-2 flex size-7 touch-manipulation items-center justify-center rounded-full bg-[#080808] text-white shadow-sm ring-2 ring-white transition-colors hover:bg-[#3a3a3a] active:bg-[#3a3a3a]"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default ChatAttachmentPreview;

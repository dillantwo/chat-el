"use client";

import { Fragment } from "react";
import { announcementImagePath, type AnnouncementImageDTO } from "@/lib/announcements";
import { basePath, cn } from "@/lib/utils";

// Only http(s) is linked, so a `javascript:` string in the text stays plain text.
const URL_PATTERN = /(https?:\/\/[^\s<>"'（）「」]+)/g;

function Linkified({ text }: { text: string }) {
  // split() with a capture group keeps the matches at the odd indexes.
  const parts = text.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-semibold text-[#146ef5] underline decoration-2 underline-offset-2 hover:text-[#0b55c4]"
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * The body of an announcement: plain text (line breaks kept, links clickable)
 * followed by its pictures, styled as the white paper card and photo stickers
 * of the pupil-facing pages. Text is rendered as React text nodes, never as
 * HTML, so nothing an admin types can run as markup.
 */
export default function AnnouncementContent({
  content,
  images,
  className,
}: {
  content: string;
  images: AnnouncementImageDTO[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {content && (
        <p className="whitespace-pre-wrap break-words rounded-[14px] border-2 border-[#080808]/10 bg-white px-4 py-3.5 text-[16px] leading-7 text-[#2b2b2b]">
          <Linkified text={content} />
        </p>
      )}
      {images.map((img, i) => {
        const src = `${basePath}${announcementImagePath(img.id)}`;
        return (
          <a
            key={img.id}
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "block overflow-hidden rounded-[14px] border-2 border-[#080808] bg-white shadow-[4px_4px_0px_#080808] transition-transform duration-200 hover:-translate-y-[2px] hover:rotate-0",
              // A hint of tilt on alternating photos, like prints stuck on a board.
              i % 2 === 0 ? "rotate-[-0.6deg]" : "rotate-[0.6deg]",
            )}
          >
            <img src={src} alt="" loading="lazy" className="mx-auto max-h-[55vh] w-auto max-w-full object-contain" />
          </a>
        );
      })}
    </div>
  );
}

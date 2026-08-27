"use client";

import { useCallback, useRef, useState } from "react";
import type React from "react";
import { filterUploadsWithinLimit } from "@/lib/upload-limits";

/**
 * The composer's pending image attachments: picker, paste, and removal.
 *
 * Pair with <ChatAttachmentPreview files={files} onRemove={remove} />.
 */
export function useChatAttachments(lang: "zh" | "en" = "zh") {
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtering happens outside the updater on purpose: the size guard reports
  // rejects with window.alert, and React invokes updaters twice in Strict Mode,
  // which would show that alert twice.
  const add = useCallback(
    (incoming: readonly File[]) => {
      const accepted = filterUploadsWithinLimit(files, incoming, lang);
      if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted]);
    },
    [files, lang],
  );

  const remove = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clear = useCallback(() => {
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) add(Array.from(event.target.files));
      // `files` owns the selection from here on. Leaving the value in place
      // means re-choosing the SAME photo fires no `change` event, so removing an
      // attachment and adding it back again would do nothing.
      event.target.value = "";
    },
    [add],
  );

  const onPaste = useCallback(
    (event: React.ClipboardEvent<HTMLElement>) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      const images: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (!items[i].type.startsWith("image/")) continue;
        const file = items[i].getAsFile();
        if (file) images.push(file);
      }
      // Only swallow the paste when it actually carried images, so pasting text
      // still lands in the textarea.
      if (images.length === 0) return;
      event.preventDefault();
      add(images);
    },
    [add],
  );

  return { files, inputRef, add, remove, clear, onInputChange, onPaste };
}

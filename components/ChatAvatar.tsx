"use client";

import { basePath, cn } from "@/lib/utils";

type ChatAvatarProps = {
  role: "assistant" | "user";
  alt?: string;
  className?: string;
};

export function ChatAvatar({ role, alt, className }: ChatAvatarProps) {
  const src = role === "assistant"
    ? `${basePath}/ai-chatbot-avatar.svg`
    : `${basePath}/user-avatar.svg`;

  return (
    <img
      src={src}
      alt={alt ?? (role === "assistant" ? "AI chatbot" : "User")}
      className={cn("shrink-0 object-cover", className)}
    />
  );
}
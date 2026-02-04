import React from "react";
import type { MessageContentPart } from "../../utils/image";

interface ChatMessageContentProps {
  content: string | MessageContentPart[];
}

export const ChatMessageContent: React.FC<ChatMessageContentProps> = ({ content }) => {
  // Normalize to array format
  const parts: MessageContentPart[] = typeof content === "string"
    ? [{ type: "text", text: content }]
    : content;

  return (
    <div className="flex flex-col gap-2">
      {parts.map((part, idx) => (
        <div key={idx}>
          {part.type === "text" ? (
            <div className="whitespace-pre-wrap text-sm">{part.text}</div>
          ) : part.type === "image" && part.image_url ? (
            <img
              src={part.image_url}
              alt="Attached image"
              className="max-w-full rounded border border-default cursor-pointer hover:opacity-90 transition-opacity"
              style={{ maxHeight: "400px" }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
};

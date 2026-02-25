"use client";

import { useState, useCallback } from "react";
import { ShareIcon } from "./Icons";

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <button
      className={`btn-share${copied ? " copied" : ""}`}
      onClick={handleClick}
    >
      {copied ? (
        "Copied!"
      ) : (
        <>
          <ShareIcon /> Copy link
        </>
      )}
    </button>
  );
}

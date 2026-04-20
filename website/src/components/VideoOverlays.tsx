// Must stay in sync with lib/markdownVideos.ts (used for markdown-rendered videos).
import { Loader2, AlertTriangle, RotateCw } from "lucide-react";

export function VideoLoaderOverlay() {
  return (
    <div className="video-loader" aria-hidden="true">
      <Loader2 className="video-loader-icon" />
    </div>
  );
}

interface VideoErrorOverlayProps {
  onRetry?: () => void;
  hidden?: boolean;
}

export function VideoErrorOverlay({ onRetry, hidden = false }: VideoErrorOverlayProps) {
  return (
    <div className="video-error" hidden={hidden} role="alert">
      <AlertTriangle className="video-error-icon" />
      <p className="video-error-text">Video unavailable</p>
      <button type="button" className="video-error-retry" onClick={onRetry}>
        <RotateCw className="video-error-retry-icon" />
        Retry
      </button>
    </div>
  );
}

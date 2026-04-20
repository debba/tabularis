// Must stay in sync with components/VideoOverlays.tsx (we can't render React here).
// Icons mirror lucide-react v1.8.0: Loader2, AlertTriangle, RotateCw.

const SVG_DEFAULTS =
  'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const LOADER_ICON_SVG = `<svg ${SVG_DEFAULTS} class="lucide lucide-loader-circle video-loader-icon" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;

const ALERT_ICON_SVG = `<svg ${SVG_DEFAULTS} class="lucide lucide-triangle-alert video-error-icon" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;

const RETRY_ICON_SVG = `<svg ${SVG_DEFAULTS} class="lucide lucide-rotate-cw video-error-retry-icon" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`;

const LOADER_HTML = `<div class="video-loader" aria-hidden="true">${LOADER_ICON_SVG}</div>`;

const ERROR_HTML = `<div class="video-error" hidden role="alert">${ALERT_ICON_SVG}<p class="video-error-text">Video unavailable</p><button type="button" class="video-error-retry">${RETRY_ICON_SVG}Retry</button></div>`;

export function wrapVideosInHtml(html: string): string {
  return html.replace(
    /<video\b([^>]*?)>([\s\S]*?)<\/video>/gi,
    (_, attrs: string, content: string) => {
      let updatedAttrs = attrs;
      if (!/\bposter=/i.test(updatedAttrs)) {
        const m = updatedAttrs.match(/\bsrc=["']([^"']+\.mp4)["']/i);
        if (m) updatedAttrs += ` poster="${m[1].replace(/\.mp4$/, ".jpg")}"`;
      }
      return `<div class="video-wrapper">${LOADER_HTML}${ERROR_HTML}<video${updatedAttrs}>${content}</video></div>`;
    },
  );
}

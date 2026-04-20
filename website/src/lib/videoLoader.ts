export function applyIntrinsicAspectRatio(
  wrapper: HTMLElement,
  video: HTMLVideoElement,
): void {
  const sync = () => {
    if (video.videoWidth && video.videoHeight) {
      wrapper.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    }
  };
  if (video.readyState >= 1) sync();
  else video.addEventListener("loadedmetadata", sync, { once: true });
}

// Listen to multiple events: cached videos may fire canplay before our listener attaches.
const VIDEO_READY_EVENTS = [
  "canplay",
  "playing",
  "loadeddata",
  "timeupdate",
] as const;

export function enhanceWrappedVideo(video: HTMLVideoElement): void {
  const wrapper = video.closest<HTMLElement>(".video-wrapper");
  if (!wrapper) return;

  applyIntrinsicAspectRatio(wrapper, video);

  const loader = wrapper.querySelector<HTMLElement>(".video-loader");
  const errorEl = wrapper.querySelector<HTMLElement>(".video-error");
  if (!loader) return;

  const showReady = () => {
    loader.hidden = true;
    if (errorEl) errorEl.hidden = true;
  };
  const showError = () => {
    loader.hidden = true;
    if (errorEl) errorEl.hidden = false;
  };

  let abort: AbortController | null = null;
  const attachEvents = () => {
    abort?.abort();
    abort = new AbortController();
    const { signal } = abort;

    if (video.readyState >= 3) {
      showReady();
      return;
    }
    for (const evt of VIDEO_READY_EVENTS) {
      video.addEventListener(evt, showReady, { once: true, signal });
    }
    video.addEventListener("error", showError, { once: true, signal });
  };

  attachEvents();

  const retryBtn = errorEl?.querySelector<HTMLButtonElement>(".video-error-retry");
  retryBtn?.addEventListener("click", () => {
    loader.hidden = false;
    if (errorEl) errorEl.hidden = true;
    video.load();
    attachEvents();
  });
}

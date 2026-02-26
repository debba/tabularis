"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface GalleryItem {
  src: string;
  alt: string;
  caption: string;
}

interface LightboxGalleryProps {
  items: GalleryItem[];
}

export function LightboxGallery({ items }: LightboxGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const close = useCallback(() => setActiveIndex(null), []);

  const prev = useCallback(
    () =>
      setActiveIndex((i) =>
        i !== null ? (i - 1 + items.length) % items.length : null
      ),
    [items.length]
  );

  const next = useCallback(
    () =>
      setActiveIndex((i) =>
        i !== null ? (i + 1) % items.length : null
      ),
    [items.length]
  );

  useEffect(() => {
    if (activeIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIndex, prev, next, close]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const diff = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(diff) > 50) {
        if (diff < 0) next();
        else prev();
      }
      touchStartX.current = null;
    },
    [next, prev]
  );

  return (
    <>
      {/* Desktop grid */}
      <div className="gallery-grid">
        {items.map((item, i) => (
          <div key={i}>
            <img
              src={item.src}
              alt={item.alt}
              className="gallery-img"
              onClick={() => setActiveIndex(i)}
            />
            <p className="gallery-caption">{item.caption}</p>
          </div>
        ))}
      </div>

      {/* Mobile slider */}
      <div className="gallery-slider">
        {items.map((item, i) => (
          <div key={i} className="gallery-slide">
            <img
              src={item.src}
              alt={item.alt}
              className="gallery-img"
              onClick={() => setActiveIndex(i)}
            />
            <p className="gallery-caption">{item.caption}</p>
          </div>
        ))}
      </div>

      {activeIndex !== null && (
        <div
          className="lightbox-overlay active"
          onClick={close}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button
            className="lightbox-nav lightbox-prev"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Immagine precedente"
          >
            &#8592;
          </button>

          <img
            src={items[activeIndex].src}
            alt={items[activeIndex].alt}
            className="lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            className="lightbox-nav lightbox-next"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Immagine successiva"
          >
            &#8594;
          </button>

          <button className="lightbox-close" onClick={close}>
            &times;
          </button>

          <div className="lightbox-footer">
            <span className="lightbox-caption-text">
              {items[activeIndex].caption}
            </span>
            <span className="lightbox-counter">
              {activeIndex + 1}&thinsp;/&thinsp;{items.length}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

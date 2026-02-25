"use client";

import { useState, useCallback } from "react";

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

  const close = useCallback(() => setActiveIndex(null), []);

  return (
    <>
      <div className="gallery-grid">
        {items.map((item, i) => (
          <div key={i}>
            <img
              src={item.src}
              alt={item.alt}
              className="gallery-img"
              onClick={() => setActiveIndex(i)}
            />
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                marginTop: "0.5rem",
              }}
            >
              {item.caption}
            </p>
          </div>
        ))}
      </div>

      {activeIndex !== null && (
        <div className="lightbox-overlay active" onClick={close}>
          <img
            src={items[activeIndex].src}
            alt={items[activeIndex].alt}
            className="lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
          <button className="lightbox-close" onClick={close}>
            &times;
          </button>
        </div>
      )}
    </>
  );
}

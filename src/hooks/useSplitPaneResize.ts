import { useState, useCallback, useEffect, type RefObject } from 'react';

const STORAGE_KEY = 'tabularis_split_pane_ratio';
const DEFAULT_RATIO = 50;
const MIN_RATIO = 15;
const MAX_RATIO = 85;

export const useSplitPaneResize = (
  mode: 'vertical' | 'horizontal',
  containerRef: RefObject<HTMLDivElement | null>,
) => {
  const [splitRatio, setSplitRatio] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseFloat(saved) : DEFAULT_RATIO;
  });

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      document.body.style.cursor = mode === 'vertical' ? 'col-resize' : 'row-resize';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        let ratio: number;
        if (mode === 'vertical') {
          ratio = ((moveEvent.clientX - rect.left) / rect.width) * 100;
        } else {
          ratio = ((moveEvent.clientY - rect.top) / rect.height) * 100;
        }

        setSplitRatio(Math.max(MIN_RATIO, Math.min(MAX_RATIO, ratio)));
      };

      const handleMouseUp = () => {
        document.body.style.cursor = 'default';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [mode, containerRef],
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, splitRatio.toString());
  }, [splitRatio]);

  return { splitRatio, startResize };
};

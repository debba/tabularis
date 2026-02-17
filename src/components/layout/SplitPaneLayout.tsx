import { useRef, Fragment } from 'react';
import clsx from 'clsx';
import { PanelDatabaseProvider } from './PanelDatabaseProvider';
import { EditorProvider } from '../../contexts/EditorProvider';
import { Editor } from '../../pages/Editor';
import { useSplitPaneResize } from '../../hooks/useSplitPaneResize';
import type { SplitView } from '../../utils/connectionLayout';

export const SplitPaneLayout = ({ connectionIds, mode }: SplitView) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { splitRatio, startResize } = useSplitPaneResize(mode, containerRef);
  const isVertical = mode === 'vertical';

  return (
    <div
      ref={containerRef}
      className={clsx('flex h-full w-full', isVertical ? 'flex-row' : 'flex-col')}
    >
      {connectionIds.map((connId, i) => (
        <Fragment key={connId}>
          <div
            className="overflow-hidden min-w-0 min-h-0"
            style={
              i === 0
                ? {
                    [isVertical ? 'width' : 'height']: `${splitRatio}%`,
                    flexShrink: 0,
                  }
                : { flex: 1 }
            }
          >
            <PanelDatabaseProvider connectionId={connId}>
              <EditorProvider>
                <Editor />
              </EditorProvider>
            </PanelDatabaseProvider>
          </div>

          {i < connectionIds.length - 1 && (
            <div
              onMouseDown={startResize}
              className={clsx(
                'bg-default hover:bg-blue-500/50 transition-colors shrink-0 z-10',
                isVertical ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize',
              )}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
};

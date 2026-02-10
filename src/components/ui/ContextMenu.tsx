import React, { useEffect, useRef, useState, useMemo } from 'react';
import { calculateContextMenuPosition, type ViewportConstraints } from '../../utils/contextMenu';

interface ContextMenuItem {
  label?: string;
  icon?: React.ElementType;
  action?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu = ({ x, y, items, onClose }: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuSize, setMenuSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      setMenuSize({ width: menuRect.width, height: menuRect.height });
    }
  }, []);

  const position = useMemo(() => {
    if (!menuSize) {
      return { top: y, left: x };
    }

    const constraints: ViewportConstraints = {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      menuWidth: menuSize.width,
      menuHeight: menuSize.height,
      clickX: x,
      clickY: y,
      margin: 10,
    };

    return calculateContextMenuPosition(constraints);
  }, [x, y, menuSize]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep within viewport
  const style: React.CSSProperties = {
    top: position.top,
    left: position.left,
  };

  return (
    <div 
      ref={menuRef}
      style={style}
      className="fixed z-50 min-w-[160px] bg-surface-secondary border border-strong rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
    >
      {items.map((item, index) => {
        // Render separator
        if (item.separator) {
          return (
            <div
              key={index}
              className="h-px bg-default my-1"
            />
          );
        }

        const Icon = item.icon;
        return (
          <button
            key={index}
            onClick={() => {
              if (!item.disabled && item.action) {
                item.action();
                onClose();
              }
            }}
            disabled={item.disabled}
            className={`
              w-full text-left px-3 py-2 text-sm flex items-center gap-2
              ${item.disabled
                ? 'text-muted/50 cursor-not-allowed'
                : `hover:bg-surface-tertiary ${item.danger ? 'text-red-400' : 'text-primary'}`
              }
            `}
          >
            {Icon && <Icon size={14} className={item.disabled ? 'text-muted/50' : item.danger ? 'text-red-400' : 'text-secondary'} />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

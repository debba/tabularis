import React, { useEffect, useRef } from 'react';

interface ContextMenuItem {
  label: string;
  icon?: React.ElementType;
  action: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu = ({ x, y, items, onClose }: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

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
    top: y,
    left: x,
  };

  return (
    <div 
      ref={menuRef}
      style={style}
      className="fixed z-50 min-w-[160px] bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={index}
            onClick={() => {
              item.action();
              onClose();
            }}
            className={`
              w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-slate-700
              ${item.danger ? 'text-red-400' : 'text-slate-200'}
            `}
          >
            {Icon && <Icon size={14} className={item.danger ? 'text-red-400' : 'text-slate-400'} />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

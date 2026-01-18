import './CompletionMenu.scss'
import React, { useEffect, useRef, useState } from 'react';

export interface CompletionItem {
  label: string;
  value: string;
  description?: string;
  icon?: string;
}

interface CompletionMenuProps {
  items: CompletionItem[];
  onSelect: (item: CompletionItem) => void;
  onClose: () => void;
  selectedIndex: number;
}

export function CompletionMenu({ 
  items, 
  onSelect, 
  selectedIndex,
}: CompletionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeItem = menuRef.current?.querySelector('.active');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (items.length === 0) return null;

  return (
    <div 
      ref={menuRef}
      className="completion-menu"
    >
      <div className="completion-menu-content">
        {items.map((item, index) => (
          <div
            key={item.value}
            className={`completion-item ${index === selectedIndex ? 'active' : ''}`}
            onClick={() => onSelect(item)}
          >
            {item.icon && <span className="material-symbols-outlined icon">{item.icon}</span>}
            <div className="item-info">
              <span className="label">{item.label}</span>
              {item.description && <span className="description">{item.description}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import type { ThemePreference } from '../theme';

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

const LABELS: Record<ThemePreference, string> = {
  light: 'Light mode',
  dark: 'Dark mode',
  system: 'System theme',
};

export function ThemeMenu({
  preference,
  onChange,
}: {
  preference: ThemePreference;
  onChange: (preference: ThemePreference) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const close = (returnFocus: boolean) => {
    setIsOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);

    const focusedIndex = OPTIONS.findIndex((option) => option.value === preference);
    itemRefs.current[focusedIndex >= 0 ? focusedIndex : 0]?.focus();

    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen, preference]);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const count = OPTIONS.length;
    const currentIndex = itemRefs.current.findIndex(
      (node) => node === document.activeElement,
    );
    const active = currentIndex >= 0 ? currentIndex : 0;

    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === 'Tab') {
      setIsOpen(false);
      return;
    }

    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') nextIndex = (active + 1) % count;
    else if (event.key === 'ArrowUp') nextIndex = (active - 1 + count) % count;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = count - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      itemRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !isOpen) {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        className="p-2 text-ink-soft hover:text-accent-ink hover:bg-sunken rounded-xl transition-colors"
        title="Theme: change appearance"
        aria-label={`Theme: change appearance (currently ${LABELS[preference]})`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {preference === 'light' && <Sun className="w-4 h-4" aria-hidden="true" />}
        {preference === 'dark' && <Moon className="w-4 h-4" aria-hidden="true" />}
        {preference === 'system' && <Monitor className="w-4 h-4" aria-hidden="true" />}
      </button>

      {isOpen && (
        <div
          role="menu"
          ref={menuRef}
          aria-label="Theme"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full mt-2 z-50 w-40 rounded-2xl border border-border bg-elevated p-1.5 shadow-lg"
        >
          {OPTIONS.map((option, index) => {
            const isActive = option.value === preference;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                onClick={() => {
                  onChange(option.value);
                  close(true);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent-ink'
                    : 'text-ink-soft hover:bg-sunken hover:text-ink'
                }`}
              >
                <option.Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-left">{option.label}</span>
                {isActive && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  subtitle?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  accentColor?: string; // 'indigo' | 'emerald' | 'amber' | 'sky'
}

const ACCENT_CLASSES: Record<string, { ring: string; pill: string; hover: string }> = {
  indigo: {
    ring: 'ring-indigo-400/50',
    pill: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    hover: 'hover:bg-indigo-500/10 text-indigo-400',
  },
  emerald: {
    ring: 'ring-emerald-400/50',
    pill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    hover: 'hover:bg-emerald-500/10 text-emerald-400',
  },
  amber: {
    ring: 'ring-amber-400/50',
    pill: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    hover: 'hover:bg-amber-500/10 text-amber-400',
  },
  sky: {
    ring: 'ring-sky-400/50',
    pill: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    hover: 'hover:bg-sky-500/10 text-sky-400',
  },
};

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  icon,
  accentColor = 'indigo',
}: SearchableSelectProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accent = ACCENT_CLASSES[accentColor] || ACCENT_CLASSES.indigo;

  const selectedOption = options.find(o => o.value === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      o.value.toLowerCase().includes(q) ||
      (o.subtitle && o.subtitle.toLowerCase().includes(q))
    );
  }, [query, options]);

  // Reset highlight when filtered results change
  useEffect(() => { setHighlightIndex(0); }, [filtered]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex(i => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightIndex]) {
          selectOption(filtered[highlightIndex].value);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
        break;
    }
  };

  function selectOption(val: string) {
    onChange(val);
    setIsOpen(false);
    setQuery('');
  }

  function clearSelection(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
    setQuery('');
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger / Input */}
      {selectedOption && !isOpen ? (
        // Show selected value as pill
        <button
          onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
          className={`
            flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium
            transition-colors cursor-pointer
            ${accent.pill}
          `}
        >
          {icon}
          <span className="truncate max-w-[160px]">{selectedOption.label}</span>
          <button onClick={clearSelection} className="p-0.5 opacity-60 hover:opacity-100">
            <X className="w-3 h-3" />
          </button>
        </button>
      ) : (
        // Show search input
        <div
          onClick={() => { setIsOpen(true); inputRef.current?.focus(); }}
          className={`
            flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm cursor-pointer
            bg-white/[0.02] border-white/10
            transition-all
            ${isOpen ? `ring-1 ${accent.ring}` : 'hover:border-white/20'}
          `}
        >
          {icon || <Search className="w-3.5 h-3.5 text-fg-soft flex-shrink-0" />}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-fg-default placeholder:text-fg-soft text-sm min-w-0"
            style={{ outline: 'none', border: 'none' }}
          />
          <ChevronDown className={`w-3.5 h-3.5 text-fg-soft transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="
          absolute top-full left-0 right-0 mt-1 z-50
          bg-[#1a1a1e]/98 backdrop-blur-xl
          border border-white/10 rounded-xl
          shadow-2xl shadow-black/40
          max-h-60 overflow-y-auto
          min-w-[220px]
        ">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-fg-soft text-center">No matches</div>
          ) : (
            <div className="py-1">
              {filtered.map((option, i) => {
                const isHighlighted = i === highlightIndex;
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    onClick={() => selectOption(option.value)}
                    onMouseEnter={() => setHighlightIndex(i)}
                    className={`
                      w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-2
                      transition-colors
                      ${isHighlighted ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}
                      ${isSelected ? accent.hover : 'text-fg-default'}
                    `}
                  >
                    <div className="min-w-0">
                      <span className="truncate block">{option.label}</span>
                      {option.subtitle && (
                        <span className="text-[11px] text-fg-soft truncate block">{option.subtitle}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-fg-soft flex-shrink-0">{option.value}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

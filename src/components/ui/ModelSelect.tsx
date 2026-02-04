import { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, X, Eye } from "lucide-react";
import clsx from "clsx";
import { modelSupportsVision } from "../../utils/aiModel";

export interface ModelOption {
  provider: string;
  model: string;
  supportsVision: boolean;
}

interface ModelSelectProps {
  value: string | null; // Format: "provider:model"
  models: Record<string, string[]>; // { provider: [models] }
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsLabel?: string;
  disabled?: boolean;
  className?: string;
  filterVisionOnly?: boolean;
}

export const ModelSelect = ({
  value,
  models,
  onChange,
  placeholder = "Select model",
  searchPlaceholder = "Search models...",
  noResultsLabel = "No models found",
  disabled = false,
  className,
  filterVisionOnly = false,
}: ModelSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Build flat list of options with metadata
  const allOptions = useMemo<ModelOption[]>(() => {
    const options: ModelOption[] = [];
    Object.entries(models).forEach(([provider, providerModels]) => {
      providerModels.forEach((model) => {
        const supportsVision = modelSupportsVision(provider, model);
        if (!filterVisionOnly || supportsVision) {
          options.push({ provider, model, supportsVision });
        }
      });
    });
    return options;
  }, [models, filterVisionOnly]);

  // Filter options by search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return allOptions;
    const query = searchQuery.toLowerCase();
    return allOptions.filter(
      (opt) =>
        opt.provider.toLowerCase().includes(query) ||
        opt.model.toLowerCase().includes(query)
    );
  }, [allOptions, searchQuery]);

  // Group filtered options by provider
  const groupedOptions = useMemo(() => {
    const groups: Record<string, ModelOption[]> = {};
    filteredOptions.forEach((opt) => {
      if (!groups[opt.provider]) {
        groups[opt.provider] = [];
      }
      groups[opt.provider].push(opt);
    });
    return groups;
  }, [filteredOptions]);

  // Parse current value
  const selectedModel = useMemo(() => {
    if (!value) return null;
    const [provider, model] = value.split(":");
    return { provider, model };
  }, [value]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (option: ModelOption) => {
    onChange(`${option.provider}:${option.model}`);
    setIsOpen(false);
    setSearchQuery("");
  };

  const displayValue = selectedModel
    ? `${selectedModel.provider}: ${selectedModel.model}`
    : placeholder;

  return (
    <div className={clsx("relative", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          "w-full bg-base border rounded px-3 py-2 text-primary flex items-center justify-between transition-colors text-sm",
          disabled
            ? "opacity-50 cursor-not-allowed border-default"
            : "border-strong hover:border-purple-500 cursor-pointer",
          isOpen && !disabled ? "border-purple-500 ring-1 ring-purple-500/50" : ""
        )}
      >
        <span className={clsx("truncate text-left", !value && "text-muted")}>
          {displayValue}
        </span>
        <ChevronDown size={14} className="shrink-0 ml-2 text-secondary" />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 bottom-full left-0 right-0 mb-1 bg-elevated border border-strong rounded-lg shadow-xl max-h-80 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-default bg-elevated">
            <div className="flex items-center gap-2 bg-base border border-strong rounded px-2 py-1.5 focus-within:border-purple-500 transition-colors">
              <Search size={14} className="text-muted shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none text-sm text-primary focus:outline-none placeholder:text-muted"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredOptions.length > 0) {
                    handleSelect(filteredOptions[0]);
                  }
                  if (e.key === "Escape") {
                    setIsOpen(false);
                  }
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-muted hover:text-primary"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-1 scrollbar-thin scrollbar-thumb-surface-tertiary scrollbar-track-transparent">
            {Object.keys(groupedOptions).length === 0 ? (
              <div className="p-3 text-sm text-muted text-center italic">
                {noResultsLabel}
              </div>
            ) : (
              Object.entries(groupedOptions).map(([provider, providerModels]) => (
                <div key={provider} className="mb-2 last:mb-0">
                  <div className="px-3 py-1.5 text-xs font-medium text-secondary uppercase tracking-wide">
                    {provider}
                  </div>
                  <div className="space-y-0.5">
                    {providerModels.map((option) => {
                      const isSelected =
                        value === `${option.provider}:${option.model}`;
                      return (
                        <button
                          key={option.model}
                          onClick={() => handleSelect(option)}
                          className={clsx(
                            "w-full text-left px-3 py-2 text-sm rounded transition-colors flex items-center justify-between gap-2",
                            isSelected
                              ? "bg-purple-600/20 text-purple-300 font-medium"
                              : "text-primary hover:bg-surface-secondary"
                          )}
                          title={option.model}
                        >
                          <span className="truncate">{option.model}</span>
                          {option.supportsVision && (
                            <Eye
                              size={14}
                              className="shrink-0 text-purple-400"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

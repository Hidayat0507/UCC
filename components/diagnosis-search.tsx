"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DiagnosisOption = {
  key: string;
  text: string;
  icd10?: { code: string; display: string };
  snomed?: { code: string; display: string };
};

interface DiagnosisSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function DiagnosisSearch({ value, onChange }: DiagnosisSearchProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(value);
  const [options, setOptions] = React.useState<DiagnosisOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setQuery(value);
  }, [value]);

  React.useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/diagnoses?q=${encodeURIComponent(query)}&limit=12`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to search diagnoses");
        }
        setOptions(payload.diagnoses || []);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return;
        }
        setError(err?.message || "Failed to search diagnoses");
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const currentLabel = value || "Select or search diagnosis...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between mt-2"
        >
          <span className="truncate text-left">{currentLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search diagnosis, ICD-10, or SNOMED..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading ? <CommandItem disabled>Searching…</CommandItem> : null}
            {error ? <CommandItem disabled className="text-destructive">{error}</CommandItem> : null}
            {!loading && !error ? (
              <>
                <CommandEmpty>No diagnosis found.</CommandEmpty>
                <CommandGroup heading="Matches">
                  {options.map((option) => (
                    <CommandItem
                      key={option.key}
                      value={option.text}
                      onSelect={() => {
                        onChange(option.text);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === option.text ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{option.text}</span>
                        <span className="text-xs text-muted-foreground">
                          {[option.icd10?.code, option.snomed?.code].filter(Boolean).join(" · ") || "Free text"}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                  {query.trim() ? (
                    <CommandItem
                      value={`Use custom diagnosis ${query}`}
                      onSelect={() => {
                        onChange(query.trim());
                        setOpen(false);
                      }}
                    >
                      <span className="mr-2 text-muted-foreground">+</span>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">Use custom diagnosis</span>
                        <span className="text-xs text-muted-foreground truncate">{query.trim()}</span>
                      </div>
                    </CommandItem>
                  ) : null}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Search, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SearchHit = {
  id: string;
  fullName: string;
  nric?: string;
  phone?: string;
};

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export type RegisterPatientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Yezza-style “Register patient” chooser: visit purpose → search → OR → MyKad / new patient.
 * Matches the layout described in docs/YEZZA.md and the demo modal (visit radios, search, OR, two actions).
 */
export function RegisterPatientDialog({ open, onOpenChange }: RegisterPatientDialogProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [listOpen, setListOpen] = React.useState(false);
  const debouncedQuery = useDebouncedValue(query.trim(), 250);
  const searchWrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setListOpen(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    if (debouncedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/patients?search=${encodeURIComponent(debouncedQuery)}&limit=20`
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          if (!cancelled) setResults([]);
          return;
        }
        if (!cancelled) setResults((data.patients || []) as SearchHit[]);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  React.useEffect(() => {
    if (!listOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setListOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [listOpen]);

  const goNewPatient = () => {
    onOpenChange(false);
    router.push("/patients/new");
  };

  const goMyKad = () => {
    onOpenChange(false);
    router.push("/patients/new/scan");
  };

  const selectExisting = (p: SearchHit) => {
    onOpenChange(false);
    router.push(`/patients/${p.id}/triage`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden p-0 sm:max-w-[460px]",
          "[&>button]:text-muted-foreground [&>button]:opacity-80"
        )}
      >
        <DialogHeader className="space-y-0 border-b border-border/80 bg-muted/40 px-5 py-4 text-left">
          <DialogTitle className="text-[15px] font-semibold tracking-tight text-foreground">
            Register patient
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-5 py-5">
          <div className="space-y-2" ref={searchWrapRef}>
            <p className="text-sm font-medium text-foreground">Search existing patient</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 rounded-md border-input bg-muted/30 pl-9 pr-3 text-sm shadow-none placeholder:text-muted-foreground/80"
                placeholder="Enter patient name, NRIC or phone number"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setListOpen(true);
                }}
                onFocus={() => setListOpen(true)}
                autoComplete="off"
              />
              {listOpen && query.trim().length >= 2 && (
                <div className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md">
                  {loading ? (
                    <div className="px-3 py-2.5 text-muted-foreground">Searching…</div>
                  ) : results.length === 0 ? (
                    <div className="px-3 py-2.5 text-muted-foreground">No patients found</div>
                  ) : (
                    results.map((hit) => (
                      <button
                        key={hit.id}
                        type="button"
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-muted/80"
                        onClick={() => selectExisting(hit)}
                      >
                        <span className="font-medium text-foreground">{hit.fullName}</span>
                        <span className="text-xs text-muted-foreground">
                          {[hit.nric, hit.phone].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="relative py-0.5">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <span className="w-full border-t border-border/80" />
            </div>
            <div className="relative flex justify-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span className="bg-background px-3">or</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={goMyKad}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border border-border/80 bg-muted/50 px-3 py-4 text-center transition-colors",
                "hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <ScanLine className="size-5 text-muted-foreground" aria-hidden />
              <span className="text-sm font-medium leading-tight text-foreground">
                Read from MyKad
              </span>
            </button>
            <button
              type="button"
              onClick={goNewPatient}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border border-border/80 bg-muted/50 px-3 py-4 text-center transition-colors",
                "hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <UserPlus className="size-5 text-muted-foreground" aria-hidden />
              <span className="text-sm font-medium leading-tight text-foreground">
                Add new patient
              </span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

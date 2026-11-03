import * as React from 'react';
import { FileText } from 'lucide-react';
import type { DeltaItem } from '@glucoflow/contracts';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
} from '@glucoflow/ui';

/**
 * Demo source sheet. The live screen opens the real authorized PDF; this sheet
 * renders the synthetic page and the exact quoted line for the judge demo.
 */
export function DeltaSourceDialog({
  item,
  onClose,
}: {
  item: DeltaItem | null;
  onClose: () => void;
}): React.ReactElement | null {
  if (!item) return null;
  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent side="right">
        <DialogHeader
          title="Source"
          description="The exact line behind the item. The demo page is synthetic."
          actions={
            <Button size="sm" variant="quiet" onClick={onClose}>
              Close
            </Button>
          }
        />
        <div className="space-y-4">
          {item.evidence.length === 0 ? (
            <p className="rounded-[12px] border border-dashed border-line bg-canvas p-4 text-sm text-ink-soft">
              This item has no source attached. The product shows that, rather than inventing one.
            </p>
          ) : (
            item.evidence.map((evidence, index) => (
              <div
                key={`${evidence.documentId}-${evidence.page}-${index}`}
                className="overflow-hidden rounded-[14px] border border-line bg-surface"
              >
                <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                  <FileText size={16} className="text-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{evidence.documentName}</p>
                    <p className="text-[11px] text-ink-soft">Page {evidence.page}</p>
                  </div>
                  <Badge tone="neutral" className="ml-auto">
                    Synthetic
                  </Badge>
                </div>
                <div className="bg-white p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
                    Synthetic source page
                  </p>
                  <div className="mt-3 rounded-[10px] border border-line/70 bg-canvas/40 p-4 font-mono text-[12px] leading-6 text-ink">
                    <p className="text-ink-soft">Meridian Diagnostics · Hyderabad</p>
                    <p className="text-ink-soft">Patient: Asha Rao · P0482</p>
                    <p className="mt-1 text-ink-soft">Collected: 09 July 2026</p>
                    <hr className="my-3 border-line/70" />
                    <p className="bg-amber-100/80 px-1 py-0.5">{evidence.quote}</p>
                    <hr className="my-3 border-line/70" />
                    <p className="text-ink-soft">Reported by: Dr S. Menon · Lab ID 44821</p>
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-ink-soft">
                    Synthetic source for the demo. No real patient data. The live screen opens the
                    original authorized PDF instead.
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

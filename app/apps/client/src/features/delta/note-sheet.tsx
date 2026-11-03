import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import type { DeltaAction, DeltaSummary } from '@glucoflow/contracts';
import { Button, Dialog, DialogContent, DialogHeader } from '@glucoflow/ui';
import { buildDeltaNote } from './delta-copy';

export function DeltaNoteSheet({
  summary,
  statuses,
  open,
  onClose,
}: {
  summary: DeltaSummary;
  statuses: Record<string, DeltaAction>;
  open: boolean;
  onClose: () => void;
}): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  const note = React.useMemo(() => buildDeltaNote(summary, statuses), [summary, statuses]);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(note);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent side="right" className="flex max-h-dvh flex-col">
        <DialogHeader
          title="Draft visit note"
          description="Built from your decisions. Nothing is written to the record until you sign."
          actions={
            <Button size="sm" variant="secondary" onClick={() => void copy()}>
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          }
        />
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-[12px] bg-canvas p-4 font-sans text-[14px] leading-6 text-ink">
          {note}
        </pre>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

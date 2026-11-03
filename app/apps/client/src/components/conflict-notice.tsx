import * as React from 'react';
import { Link } from 'react-router-dom';
import type { DeltaItem } from '@glucoflow/contracts';
import { Alert } from '@glucoflow/ui';

/** A conflict shown on the delta must not disappear into a single latest value. */
export function ConflictNotice({
  patientId,
  items,
}: {
  patientId: string;
  items: DeltaItem[];
}): React.ReactElement | null {
  if (!items.length) return null;
  return (
    <Alert tone="review" title="Two sources disagree">
      <span className="block">
        This record keeps both values. Do not treat one as the final answer.
      </span>
      <ul className="mt-2 space-y-1">
        {items.slice(0, 2).map((item) => (
          <li key={item.id} className="text-[14px] leading-5">
            {item.title}
          </li>
        ))}
      </ul>
      <Link
        to={`/clinic/patients/${patientId}/delta`}
        className="mt-2 inline-flex min-h-8 items-center rounded-lg border border-review/30 bg-surface px-2.5 text-[12px] font-semibold text-review hover:bg-review-bg"
      >
        Open the delta
      </Link>
    </Alert>
  );
}

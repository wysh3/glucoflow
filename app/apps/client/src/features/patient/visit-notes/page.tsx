import * as React from 'react';
import { NOTE_MAX_CHARS, NOTE_CATEGORY_LABELS } from '@sutra/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Label,
  ScreenTitle,
  Select,
  Textarea,
  formatDateOnly,
} from '@sutra/ui';
import { useApi, useSession, describeApiError } from '../../../auth/session';
import { useNotes } from '../../../lib/queries';
import { QueryState } from '../../../components/state-views';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Patient visit notes. The patient reviews the text before sending, and a sent note
 * keeps its patient-reported status. Submitting does not create a measured result.
 */
export function PatientVisitNotesPage(): React.ReactElement {
  const { me } = useSession();
  const api = useApi();
  const queryClient = useQueryClient();
  const patientId = me?.contexts.find((context) => context.kind === 'patient')?.patientId;
  const notes = useNotes(patientId);
  const [category, setCategory] = React.useState('diet_activity');
  const [eventDate, setEventDate] = React.useState('');
  const [body, setBody] = React.useState('');
  const [reviewing, setReviewing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  if (!patientId) {
    return (
      <Alert tone="neutral" title="No patient record is linked to this account">
        Ask the clinic to link your account before sending a note.
      </Alert>
    );
  }

  const trimmed = body.trim();
  const invalid = trimmed.length === 0 || trimmed.length > NOTE_MAX_CHARS;

  const send = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await api.request(`/api/v1/patients/${patientId}/notes`, {
        method: 'POST',
        body: {
          category,
          body: trimmed,
          ...(eventDate ? { eventDate } : {}),
        },
      });
      setBody('');
      setEventDate('');
      setReviewing(false);
      await queryClient.invalidateQueries({ queryKey: ['notes'] });
    } catch (caught) {
      setError(describeApiError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <ScreenTitle title="Visit notes" meta="Notes you write stay patient-reported" />

      <Card>
        <CardHeader>
          <CardTitle>New note</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="note-category">Category</Label>
              <Select
                id="note-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {Object.entries(NOTE_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="note-date">Event date (optional)</Label>
              <Input
                id="note-date"
                type="date"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="note-body">Note</Label>
            <Textarea
              id="note-body"
              rows={4}
              maxLength={NOTE_MAX_CHARS}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="For example: took the evening tablet most days, walked after dinner."
              aria-invalid={invalid && body.length > 0}
              aria-describedby="note-help"
            />
            <p id="note-help" className="mt-1 text-[12px] text-ink-soft">
              {trimmed.length} of {NOTE_MAX_CHARS} characters. The submission date is recorded
              separately from the event date.
            </p>
          </div>

          {error ? <Alert tone="error" title="The note was not sent">{error}</Alert> : null}

          {reviewing ? (
            <div className="space-y-2 rounded-[12px] border border-line bg-canvas px-4 py-3">
              <p className="text-[12px] font-medium uppercase tracking-wide text-ink-soft">
                Review before sending
              </p>
              <p className="text-sm text-ink">{trimmed}</p>
              <p className="text-[12px] text-ink-soft">
                {NOTE_CATEGORY_LABELS[category]}
                {eventDate ? ` · event date ${eventDate}` : ' · no event date'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" disabled={busy || invalid} onClick={() => void send()}>
                  {busy ? 'Sending' : 'Send note'}
                </Button>
                <Button variant="quiet" onClick={() => setReviewing(false)}>
                  Edit
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="primary"
              disabled={invalid}
              onClick={() => setReviewing(true)}
              title={invalid ? 'Enter between 1 and 1,000 characters.' : undefined}
            >
              Review and send
            </Button>
          )}
          <p className="text-[12px] text-ink-soft">
            A note is never converted into a measured result, and it does not change your record.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sent notes</CardTitle>
        </CardHeader>
        <CardBody>
          <QueryState
            isLoading={notes.isLoading}
            error={notes.error}
            isEmpty={notes.data?.items.length === 0}
            emptyTitle="No notes sent yet"
            emptyDescription="Your sent notes appear here with their submission time."
            onRetry={() => void notes.refetch()}
          >
            <ul className="space-y-3">
              {notes.data?.items.map((note) => (
                <li key={note.noteId} className="rounded-[12px] border border-line px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone="neutral">{NOTE_CATEGORY_LABELS[note.category] ?? note.category}</Badge>
                    <span className="text-[12px] text-ink-soft">
                      submitted {formatDateOnly(note.submittedAt.slice(0, 10))} · version {note.version}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink">{note.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
                    <span>
                      {note.eventDate
                        ? `Event date ${formatDateOnly(note.eventDate)}`
                        : 'No event date given'}
                    </span>
                    <span>·</span>
                    <span>Patient-reported</span>
                    {note.seenBy ? (
                      <>
                        <span>·</span>
                        <span>Seen by clinic {note.seenBy}</span>
                      </>
                    ) : null}
                  </div>
                  {note.isCurrent ? (
                    <Button
                      size="sm"
                      variant="quiet"
                      className="mt-2"
                      onClick={async () => {
                        await api.request(`/api/v1/notes/${note.noteId}/corrections`, {
                          method: 'POST',
                          body: {
                            category: note.category,
                            body: note.body,
                            ...(note.eventDate ? { eventDate: note.eventDate } : {}),
                          },
                        });
                        await queryClient.invalidateQueries({ queryKey: ['notes'] });
                      }}
                    >
                      Send a corrected version
                    </Button>
                  ) : (
                    <p className="mt-2 text-[12px] text-ink-soft">
                      Superseded by a later version. The earlier text stays in history.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </QueryState>
        </CardBody>
      </Card>
    </div>
  );
}

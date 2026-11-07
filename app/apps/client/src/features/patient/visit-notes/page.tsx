import * as React from 'react';
import { NOTE_MAX_CHARS, NOTE_CATEGORY_LABELS } from '@glucoflow/contracts';
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
  Select,
  Textarea,
} from '@glucoflow/ui';
import { useApi, useSession, describeApiError } from '../../../auth/session';
import { useNotes } from '../../../lib/queries';
import { QueryState } from '../../../components/state-views';
import { SystemPageHeader } from '../../../components/system-page-header';
import { ReadAloud, SpeechDraftInput } from '../../speech';
import { noteCategoryKey, useI18n } from '../../../i18n';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Patient visit notes. The patient reviews the text before sending, and a sent note
 * keeps its patient-reported status. Submitting does not create a measured result.
 */
export function PatientVisitNotesPage(): React.ReactElement {
  const { me } = useSession();
  const { locale, t, dateOnly } = useI18n();
  const api = useApi();
  const queryClient = useQueryClient();
  const patientId = me?.contexts.find((context) => context.kind === 'patient')?.patientId;
  const notes = useNotes(patientId);
  const [category, setCategory] = React.useState('diet_activity');
  const [eventDate, setEventDate] = React.useState('');
  const [body, setBody] = React.useState('');
  const [correction, setCorrection] = React.useState<{noteId:string; body:string; category:string; eventDate:string} | null>(null);
  const [reviewing, setReviewing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const categoryLabel = (key: string) => {
    const localized = noteCategoryKey(key);
    return localized ? t(localized) : NOTE_CATEGORY_LABELS[key] ?? key;
  };

  if (!patientId) {
    return (
      <Alert tone="neutral" title={t('records.unlinked')}>
        {t('notes.linkClinic')}
      </Alert>
    );
  }

  const trimmed = body.trim();
  const invalid = trimmed.length === 0 || trimmed.length > NOTE_MAX_CHARS || !!(correction && trimmed === correction.body.trim() && category === correction.category && eventDate === correction.eventDate);

  const send = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await api.request(correction ? `/api/v1/notes/${correction.noteId}/corrections` : `/api/v1/patients/${patientId}/notes`, {
        method: 'POST',
        body: {
          category,
          body: trimmed,
          ...(eventDate ? { eventDate } : {}),
        },
      });
      setCorrection(null);
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
      <SystemPageHeader title={t('nav.notes')} meta={t('notes.reportedMeta')} />

      <Card>
        <CardHeader>
          <CardTitle>{t(correction ? 'notes.correct' : 'notes.new')}</CardTitle>
          {correction ? <Button variant="quiet" size="sm" onClick={() => {setCorrection(null);setBody('');setEventDate('');setReviewing(false);setError(null);}}>{t('notes.cancelCorrection')}</Button> : null}
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="note-category">{t('notes.category')}</Label>
              <Select
                id="note-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {Object.keys(NOTE_CATEGORY_LABELS).map((value) => (
                  <option key={value} value={value}>
                    {categoryLabel(value)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="note-date">{t('notes.eventDateOptional')}</Label>
              <Input
                id="note-date"
                type="date"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="note-body">{t('notes.note')}</Label>
            <Textarea
              dir="auto"
              id="note-body"
              rows={4}
              maxLength={NOTE_MAX_CHARS}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t('notes.placeholder')}
              aria-invalid={invalid && body.length > 0}
              aria-describedby="note-help"
            />
            {!reviewing ? (
              <SpeechDraftInput languageCode={locale.tag} disabled={busy || body.length >= NOTE_MAX_CHARS}
                onInsert={(text) => {
                  setBody((draft) => [draft.trimEnd(), text.trim()].filter(Boolean).join(' ')
                    .slice(0, NOTE_MAX_CHARS).replace(/[\ud800-\udbff]$/u, ''));
                  document.getElementById('note-body')?.focus();
                }} />
            ) : null}
            <p id="note-help" className="mt-1 text-[12px] text-ink-soft">
              {t('notes.characters', { count: trimmed.length, max: NOTE_MAX_CHARS })}
            </p>
          </div>

          {error ? <Alert tone="error" title={t('notes.sendFailed')}>{error}</Alert> : null}

          {reviewing ? (
            <div className="space-y-2 rounded-[12px] border border-line bg-canvas px-4 py-3">
              <p className="text-[12px] font-medium uppercase tracking-wide text-ink-soft">
                {t('notes.review')}
              </p>
              <p className="text-sm text-ink" dir="auto">{trimmed}</p>
              <ReadAloud text={trimmed} languageCode={locale.tag} />
              <p className="text-[12px] text-ink-soft">
                {categoryLabel(category)}
                 · {eventDate ? t('notes.eventDate', { date: dateOnly(eventDate) }) : t('notes.noEventDate')}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" disabled={busy || invalid} onClick={() => void send()}>
                  {t(busy ? 'notes.sending' : correction ? 'notes.sendCorrection' : 'notes.send')}
                </Button>
                <Button variant="quiet" onClick={() => setReviewing(false)}>
                  {t('notes.edit')}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="primary"
              disabled={invalid}
              onClick={() => setReviewing(true)}
              title={invalid ? t('notes.invalid') : undefined}
            >
              {t('notes.reviewSend')}
            </Button>
          )}
          <p className="text-[12px] text-ink-soft">
            {t('notes.notMeasurement')}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('notes.sent')}</CardTitle>
        </CardHeader>
        <CardBody>
          <QueryState
            isLoading={notes.isLoading}
            error={notes.error}
            isEmpty={notes.data?.items.length === 0}
            emptyTitle={t('notes.noSent')}
            emptyDescription={t('notes.sentDescription')}
            onRetry={() => void notes.refetch()}
          >
            <ul className="space-y-3">
              {notes.data?.items.map((note) => (
                <li key={note.noteId} className="rounded-[12px] border border-line px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone="neutral">{categoryLabel(note.category)}</Badge>
                    <span className="text-[12px] text-ink-soft">
                      {t('notes.submittedVersion', { date: dateOnly(note.submittedAt), version: note.version })}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink" dir="auto">{note.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
                    <span>
                      {note.eventDate
                        ? t('notes.eventDate', { date: dateOnly(note.eventDate) })
                        : t('notes.noEventDate')}
                    </span>
                    <span>·</span>
                    <span>{t('notes.patientReported')}</span>
                    {note.seenBy ? (
                      <>
                        <span>·</span>
                        <span>{t('notes.seenBy', { name: note.seenBy })}</span>
                      </>
                    ) : null}
                  </div>
                  {note.isCurrent ? (
                    <Button
                      size="sm"
                      variant="quiet"
                      className="mt-2"
                      disabled={busy}
                      onClick={() => {
                        setCorrection({noteId:note.noteId, body:note.body, category:note.category, eventDate:note.eventDate ?? ''});
                        setCategory(note.category); setBody(note.body); setEventDate(note.eventDate ?? '');
                        setReviewing(false); setError(null);
                        document.getElementById('note-body')?.focus();
                      }}
                    >
                      {t('notes.correctedVersion')}
                    </Button>
                  ) : (
                    <p className="mt-2 text-[12px] text-ink-soft">
                      {t('notes.superseded')}
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

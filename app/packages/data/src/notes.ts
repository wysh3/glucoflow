import type { CreateNoteInput, PatientNoteDto } from '@glucoflow/contracts';
import type { DbClient } from './pool';

/** Patient note reads and writes. Notes stay patient-reported in every response. */

type NoteRow = {
  id: string;
  patient_id: string;
  author_id: string;
  author_name: string;
  category: string;
  body: string;
  event_date: string | null;
  submitted_at: string;
  version: number;
  supersedes_note_id: string | null;
  seen_by_name: string | null;
  seen_at: string | null;
  is_current: boolean;
};

const NOTE_SELECT = `
  select n.id, n.patient_id, n.author_id, a.display_name as author_name,
         n.category, n.body, to_char(n.event_date, 'YYYY-MM-DD') as event_date,
         n.submitted_at, n.version, n.supersedes_note_id,
         s.display_name as seen_by_name, n.seen_at,
         not exists (select 1 from sutra.patient_notes newer where newer.supersedes_note_id = n.id)
           as is_current
    from sutra.patient_notes n
    join sutra.app_users a on a.id = n.author_id
    left join sutra.app_users s on s.id = n.seen_by`;

function mapNote(row: NoteRow): PatientNoteDto {
  return {
    noteId: row.id,
    patientId: row.patient_id,
    authorId: row.author_id,
    authorName: row.author_name,
    reporter: 'patient',
    category: row.category,
    body: row.body,
    eventDate: row.event_date,
    submittedAt: new Date(row.submitted_at).toISOString(),
    version: row.version,
    supersedesNoteId: row.supersedes_note_id,
    // Acknowledgement is a separate status vocabulary from fact approval.
    seenBy: row.seen_by_name,
    seenAt: row.seen_at ? new Date(row.seen_at).toISOString() : null,
    isCurrent: row.is_current,
  };
}

export async function listNotes(
  client: DbClient,
  patientId: string,
  options: { includeHistory?: boolean } = {},
): Promise<PatientNoteDto[]> {
  const result = await client.query<NoteRow>(
    `${NOTE_SELECT}
     where n.patient_id = $1
       and ($2::boolean or not exists (
         select 1 from sutra.patient_notes newer where newer.supersedes_note_id = n.id
       ))
     order by n.submitted_at desc
     limit 200`,
    [patientId, options.includeHistory ?? false],
  );
  return result.rows.map(mapNote);
}

export async function getNote(client: DbClient, noteId: string): Promise<PatientNoteDto | null> {
  const result = await client.query<NoteRow>(`${NOTE_SELECT} where n.id = $1`, [noteId]);
  const row = result.rows[0];
  return row ? mapNote(row) : null;
}

export async function submitNote(
  client: DbClient,
  patientId: string,
  input: CreateNoteInput,
): Promise<PatientNoteDto> {
  const result = await client.query<{ submit_patient_note: string }>(
    'select sutra.submit_patient_note($1, $2, $3, $4::date) as submit_patient_note',
    [patientId, input.category, input.body, input.eventDate ?? null],
  );
  const noteId = result.rows[0]!.submit_patient_note;
  const note = await getNote(client, noteId);
  if (!note) throw new Error('note was not persisted');
  return note;
}

export async function correctNote(
  client: DbClient,
  noteId: string,
  input: CreateNoteInput,
): Promise<PatientNoteDto> {
  const result = await client.query<{ correct_patient_note: string }>(
    'select sutra.correct_patient_note($1, $2, $3, $4::date) as correct_patient_note',
    [noteId, input.category, input.body, input.eventDate ?? null],
  );
  const newId = result.rows[0]!.correct_patient_note;
  const note = await getNote(client, newId);
  if (!note) throw new Error('corrected note was not persisted');
  return note;
}

export async function acknowledgeNote(
  client: DbClient,
  noteId: string,
): Promise<PatientNoteDto> {
  await client.query('select sutra.acknowledge_patient_note($1)', [noteId]);
  const note = await getNote(client, noteId);
  if (!note) throw new Error('note not found after acknowledgement');
  return note;
}

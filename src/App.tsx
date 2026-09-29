import { useEffect, useState, type FormEvent } from 'react';
import { readApiUrl } from './config';

type Note = { id: number | string; text: string };

async function loadNotes(apiUrl: string, signal?: AbortSignal): Promise<Note[]> {
  const response = await fetch(`${apiUrl}/api/notes`, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const notes: unknown = await response.json();
  if (!Array.isArray(notes) || !notes.every((note): note is Note =>
    note !== null && typeof note === 'object' &&
    (typeof note.id === 'string' || typeof note.id === 'number') &&
    typeof note.text === 'string'
  )) throw new Error('Expected a notes array with valid items');
  return notes;
}

export default function App() {
  const [apiUrl] = useState(readApiUrl);
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    loadNotes(apiUrl, controller.signal)
      .then(setNotes)
      .catch(() => {
        if (!controller.signal.aborted) setError('Could not load notes. Check the API connection and reload.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [apiUrl]);

  async function createNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setText('');
      try {
        setNotes(await loadNotes(apiUrl));
      } catch {
        setError('Note saved, but the list could not refresh. Reload to see it.');
      }
    } catch {
      setError('Could not confirm the note was saved. Check the API connection and reload before retrying.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <h1>Preview notes</h1>
      <p>API URL: <code>{apiUrl}</code></p>
      {error && <p role="alert">{error}</p>}
      <section aria-labelledby="notes-heading" aria-busy={loading}>
        <h2 id="notes-heading">Notes</h2>
        {loading ? <p role="status">Loading notes…</p> : notes.length ? (
          <ul>{notes.map((note) => <li key={note.id}>{note.text}</li>)}</ul>
        ) : !error && <p>No notes yet.</p>}
      </section>
      <form onSubmit={(event) => { void createNote(event); }}>
        <label htmlFor="note">New note</label>
        <textarea id="note" value={text} onChange={(event) => setText(event.target.value)} required disabled={saving} />
        <button type="submit" disabled={loading || saving || !text.trim()}>{saving ? 'Saving…' : 'Add note'}</button>
      </form>
    </main>
  );
}

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import App from './App';

const invalidBodies = [
  null, {}, 'notes', 1, true,
  ...[null, 'note', 1, true, {}, { id: 1 }, { text: 'Missing ID' },
    { id: null, text: 'Invalid ID' }, { id: {}, text: 'Invalid ID' },
    { id: true, text: 'Invalid ID' }, { id: 1, text: { x: 1 } },
    { id: 1, text: null }, { id: 1, text: 1 }, { id: 1, text: true },
    { id: 1, text: ['Invalid text'] },
  ].map((item) => [{ id: 2, text: 'Valid item in invalid response' }, item]),
];

const ok = (notes: { id: number | string; text: string }[] = []) => ({ ok: true, json: async () => notes });

it('lists notes, creates a note, and refreshes using the runtime URL', async () => {
  window.__APP_CONFIG__ = { apiUrl: 'https://api.example.test' };
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(ok([{ id: 'first', text: 'First note' }]))
    .mockResolvedValueOnce(ok())
    .mockResolvedValueOnce(ok([{ id: 'first', text: 'First note' }, { id: 2, text: 'New note text' }]));
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();
  render(<App />);
  expect(await screen.findByText('First note')).toBeInTheDocument();
  expect(screen.getByText('https://api.example.test')).toBeInTheDocument();
  await user.type(screen.getByLabelText('New note'), 'New note text');
  await user.click(screen.getByRole('button', { name: 'Add note' }));
  expect(await screen.findByText('New note text')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/notes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'New note text' }),
  });
  expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.example.test/api/notes', { signal: undefined });
  expect(screen.getByLabelText('New note')).toHaveValue('');
});

it.each([new Error('Network unreachable'), { status: 503, ok: false }])('shows a visible load error: %s', async (failure) => {
  vi.stubGlobal('fetch', failure instanceof Error ? vi.fn().mockRejectedValue(failure) : vi.fn().mockResolvedValue(failure));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load notes');
});

it('keeps the draft when creating fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce({ ok: false, status: 500 }));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('No notes yet.');
  expect(screen.getByRole('button')).toBeDisabled();
  await user.type(screen.getByLabelText('New note'), 'Keep this draft');
  await user.click(screen.getByRole('button'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm');
  expect(screen.getByLabelText('New note')).toHaveValue('Keep this draft');
});

it.each(invalidBodies.map((body) => ({ body })))('shows a visible load error for an invalid response: $body', async ({ body }) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load notes');
  expect(screen.getByLabelText('New note')).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByText('Valid item in invalid response')).not.toBeInTheDocument();
});

it.each(invalidBodies.map((body) => ({ body })))('keeps existing notes and shows a refresh error for an invalid response: $body', async ({ body }) => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(ok([{ id: 1, text: 'Existing note' }]))
    .mockResolvedValueOnce(ok())
    .mockResolvedValueOnce({ ok: true, json: async () => body }));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('Existing note');
  await user.type(screen.getByLabelText('New note'), 'Saved note');
  await user.click(screen.getByRole('button'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Note saved, but the list could not refresh');
  expect(screen.getByText('Existing note')).toBeInTheDocument();
  expect(screen.getByLabelText('New note')).toHaveValue('');
  expect(screen.getByLabelText('New note')).toBeEnabled();
});

it('distinguishes a successful save from a failed refresh', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok()).mockRejectedValueOnce(new Error('offline')));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('No notes yet.');
  await user.type(screen.getByLabelText('New note'), 'Saved note');
  await user.click(screen.getByRole('button'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Note saved');
  await waitFor(() => expect(screen.getByLabelText('New note')).toHaveValue(''));
});

import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

it('renders children normally', () => {
  render(<ErrorBoundary><p>Notes content</p></ErrorBoundary>);
  expect(screen.getByText('Notes content')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('shows a visible alert when a child throws during render', () => {
  function BrokenChild(): never {
    throw new Error('Render failed');
  }
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    render(<ErrorBoundary><BrokenChild /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load notes. Check the API connection and reload.');
  } finally {
    consoleError.mockRestore();
  }
});

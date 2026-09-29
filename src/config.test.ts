import { expect, it } from 'vitest';
import { readApiUrl } from './config';

it('falls back for missing and empty local config', () => {
  expect(readApiUrl()).toBe('http://localhost:8000');
  window.__APP_CONFIG__ = { apiUrl: '  ' };
  expect(readApiUrl()).toBe('http://localhost:8000');
});

it('reads runtime config and removes trailing slashes', () => {
  window.__APP_CONFIG__ = { apiUrl: 'https://api.example.test///' };
  expect(readApiUrl()).toBe('https://api.example.test');
});

it.each(['/', '///', '  ///  '])('falls back for slash-only runtime config: %s', (apiUrl) => {
  window.__APP_CONFIG__ = { apiUrl };
  expect(readApiUrl()).toBe('http://localhost:8000');
});

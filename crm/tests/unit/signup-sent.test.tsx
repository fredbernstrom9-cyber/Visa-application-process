import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SignupSent } from '@/components/auth/signup-sent';

describe('sign-up confirmation message', () => {
  const html = renderToStaticMarkup(<SignupSent email="jane@example.com" next="/overview" />);
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  it('does not promise an e-mail that may not have been sent', () => {
    expect(text).toContain('If jane@example.com is a new address, we have sent a confirmation link');
    expect(text).not.toMatch(/We sent a confirmation link to/);
  });

  it('tells existing users what to do instead, with their address pre-filled', () => {
    expect(text).toContain('Already have an account with this address?');
    expect(html).toContain('href="/login?email=jane%40example.com&amp;next=%2Foverview"');
    expect(html).toContain('href="/forgot-password"');
  });
});

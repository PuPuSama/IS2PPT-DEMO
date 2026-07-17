import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { APP_IDENTITY } from '@/shared/config/appIdentity';
import { AppFooter } from './AppFooter';

describe('AppFooter', () => {
  test('renders the current product identity and repository link', () => {
    render(<AppFooter />);

    expect(screen.getByText(APP_IDENTITY.displayName)).toBeInTheDocument();
    expect(screen.getByText(String(new Date().getFullYear()), { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      APP_IDENTITY.repositoryUrl,
    );
  });
});

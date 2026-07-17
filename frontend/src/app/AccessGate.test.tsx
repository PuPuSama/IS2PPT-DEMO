import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { checkAccessCode, verifyAccessCode } from '@/api/accessCodeApi';
import { accessCodeSession } from '@/shared/auth/accessCodeSession';
import { AccessGate } from './AccessGate';

vi.mock('@/api/accessCodeApi', () => ({
  checkAccessCode: vi.fn(),
  verifyAccessCode: vi.fn(),
}));

vi.mock('@/shared/auth/accessCodeSession', () => ({
  accessCodeSession: {
    get: vi.fn(),
    save: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('@/hooks/useT', () => ({
  useT: () => (key: string) => key,
}));

describe('AccessGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(accessCodeSession.get).mockReturnValue(null);
  });

  test('grants access when the server policy is disabled', async () => {
    vi.mocked(checkAccessCode).mockResolvedValue({ data: { enabled: false } } as never);

    render(<AccessGate><div>workspace</div></AccessGate>);

    expect(await screen.findByText('workspace')).toBeInTheDocument();
    expect(verifyAccessCode).not.toHaveBeenCalled();
  });

  test('shows a challenge when access protection is enabled', async () => {
    vi.mocked(checkAccessCode).mockResolvedValue({ data: { enabled: true } } as never);

    render(<AccessGate><div>workspace</div></AccessGate>);

    expect(await screen.findByText('title')).toBeInTheDocument();
    expect(screen.queryByText('workspace')).not.toBeInTheDocument();
  });

  test('accepts and stores a valid code', async () => {
    vi.mocked(checkAccessCode).mockResolvedValue({ data: { enabled: true } } as never);
    vi.mocked(verifyAccessCode).mockResolvedValue({ data: { valid: true } } as never);
    render(<AccessGate><div>workspace</div></AccessGate>);
    await screen.findByText('title');

    fireEvent.change(screen.getByPlaceholderText('placeholder'), { target: { value: '  valid-code  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() => expect(screen.getByText('workspace')).toBeInTheDocument());
    expect(verifyAccessCode).toHaveBeenCalledWith('valid-code');
    expect(accessCodeSession.save).toHaveBeenCalledWith('valid-code');
  });
});

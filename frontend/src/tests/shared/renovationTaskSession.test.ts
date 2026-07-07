import { beforeEach, describe, expect, it } from 'vitest';

import { renovationTaskSession } from '@/shared/storage/renovationTaskSession';

describe('renovationTaskSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('tracks the active renovation task', () => {
    renovationTaskSession.trackTask('task-001');

    expect(renovationTaskSession.getTaskId()).toBe('task-001');
  });

  it('clears the active renovation task', () => {
    renovationTaskSession.trackTask('task-001');

    renovationTaskSession.clearTask();

    expect(renovationTaskSession.getTaskId()).toBeNull();
  });
});

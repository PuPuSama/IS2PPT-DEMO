import { beforeEach, describe, expect, it } from 'vitest';

import { presetCapsuleStore } from '@/shared/storage/presetCapsuleStore';
import { getPresetCapsulesStorageKey } from '@/shared/storage/storageKeys';

describe('presetCapsuleStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty list by default', () => {
    expect(presetCapsuleStore.read('outline')).toEqual([]);
  });

  it('saves user presets by type', () => {
    presetCapsuleStore.save('description', [{ name: 'Tone', content: 'More concise' }]);

    expect(presetCapsuleStore.read('description')).toEqual([
      { name: 'Tone', content: 'More concise' },
    ]);
    expect(presetCapsuleStore.read('outline')).toEqual([]);
  });

  it('falls back to an empty list for invalid JSON', () => {
    localStorage.setItem(getPresetCapsulesStorageKey('outline'), '{broken');

    expect(presetCapsuleStore.read('outline')).toEqual([]);
  });

  it('filters invalid preset entries', () => {
    localStorage.setItem(
      getPresetCapsulesStorageKey('outline'),
      JSON.stringify([{ name: 'Valid', content: 'Prompt' }, { name: 'Broken' }])
    );

    expect(presetCapsuleStore.read('outline')).toEqual([
      { name: 'Valid', content: 'Prompt' },
    ]);
  });
});

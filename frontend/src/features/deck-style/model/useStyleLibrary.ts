import { useCallback, useEffect, useState } from 'react';
import {
  createUserStyleTemplate,
  deleteUserStyleTemplate,
  listUserStyleTemplates,
  type UserStyleTemplate,
} from '@/api/templatesApi';

interface NewStyleEntry {
  name: string;
  description: string;
  color: string;
}

export function useStyleLibrary() {
  const [styles, setStyles] = useState<UserStyleTemplate[]>([]);

  useEffect(() => {
    let active = true;

    void listUserStyleTemplates()
      .then((response) => {
        if (active) setStyles(response.data?.templates ?? []);
      })
      .catch((error) => {
        console.error('Failed to load the personal style library:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  const createStyle = useCallback(async (entry: NewStyleEntry) => {
    const response = await createUserStyleTemplate(entry);
    if (!response.data) throw new Error('Style service returned an empty record');
    setStyles((current) => [response.data!, ...current]);
  }, []);

  const removeStyle = useCallback(async (styleId: string) => {
    await deleteUserStyleTemplate(styleId);
    setStyles((current) => current.filter((style) => style.id !== styleId));
  }, []);

  return { styles, createStyle, removeStyle };
}

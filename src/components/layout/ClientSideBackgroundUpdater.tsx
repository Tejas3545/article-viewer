'use client';

import { useEffect } from 'react';

const LOCAL_STORAGE_KEY = 'userCustomBackgroundImageUrl';

export function ClientSideBackgroundUpdater() {
  useEffect(() => {
    const storedUrl = localStorage.getItem(LOCAL_STORAGE_KEY);

    if (storedUrl && storedUrl.trim() !== '') {
      // Only update if a non-empty URL is found in localStorage
      // This will override the server-rendered background style
      document.body.style.backgroundImage = `url('${storedUrl}')`;
    }
    // If not found, the server-rendered background (from env var or default from layout.tsx) remains.
  }, []); // Runs once on mount after hydration

  return null; // This component does not render any UI itself
}

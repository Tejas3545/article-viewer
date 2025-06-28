"use client";

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Assuming auth is exported from firebase.ts
import { useRouter } from 'next/navigation'; // For redirection if needed within the hook

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export function useAuth(options?: { redirectOnUnauthenticated?: string }): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (!currentUser && options?.redirectOnUnauthenticated) {
        router.push(options.redirectOnUnauthenticated);
      }
    });

    return () => unsubscribe();
  }, [router, options]);

  return { user, loading, isAuthenticated: !!user };
}

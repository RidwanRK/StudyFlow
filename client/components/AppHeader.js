'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function AppHeader() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <header className="app-header">
      <Link href="/" className="brand">
        StudyFlow
      </Link>
      {user && (
        <span className="header-right">
          <span className="who">Hi, {user.username}</span>
          <button type="button" className="btn btn-quiet" onClick={handleSignOut}>
            Sign out
          </button>
        </span>
      )}
    </header>
  );
}

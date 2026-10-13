import Link from 'next/link';

// Small step switcher shown on the setup pages. `current` is "hours" or "courses".
export default function SetupNav({ current }) {
  return (
    <nav className="setup-nav" aria-label="Setup steps">
      <Link href="/setup/hours" className={`setup-step ${current === 'hours' ? 'setup-step-on' : ''}`} aria-current={current === 'hours' ? 'page' : undefined}>
        1. Study hours
      </Link>
      <Link href="/setup/courses" className={`setup-step ${current === 'courses' ? 'setup-step-on' : ''}`} aria-current={current === 'courses' ? 'page' : undefined}>
        2. Courses
      </Link>
    </nav>
  );
}

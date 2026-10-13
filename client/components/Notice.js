// A short, gentle message. tone="error" is still soft (no red anywhere in StudyFlow).
export default function Notice({ tone = 'info', children }) {
  if (!children) return null;
  return (
    <p className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

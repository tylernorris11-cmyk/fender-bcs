'use client';

// Only fires if the root layout itself throws — the rare, catastrophic case.
// Kept plain and self-contained (inline styles, no shared components) since
// it replaces the whole document and can't rely on anything else having
// loaded correctly.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-GB">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#F4F6F5', margin: 0 }}>
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 420, textAlign: 'center', boxShadow: '0 4px 16px rgba(6,50,44,0.08)' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>The control centre hit a problem</h1>
            <p style={{ color: '#5C6B67' }}>
              {error.message || 'Something went wrong loading the page itself.'}
            </p>
            {error.digest && <p style={{ fontSize: 12, color: '#8B9995', marginTop: 12 }}>Reference: {error.digest}</p>}
            <button
              onClick={reset}
              style={{ marginTop: 20, width: '100%', padding: '10px 16px', borderRadius: 12, border: 'none', background: '#16A085', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

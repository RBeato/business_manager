'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      window.location.href = '/';
      return;
    } else {
      setError('Wrong password');
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
    }}>
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '32px',
        borderRadius: '12px',
        border: '1px solid #333',
        background: '#111',
        width: '320px',
      }}>
        <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, textAlign: 'center' }}>
          Business Dashboard
        </h1>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #333',
            background: '#1a1a1a',
            color: '#fff',
            fontSize: '16px',
            outline: 'none',
          }}
        />
        {error && (
          <p style={{ color: '#ef4444', margin: 0, fontSize: '14px', textAlign: 'center' }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px',
            borderRadius: '8px',
            border: 'none',
            background: '#3b82f6',
            color: '#fff',
            fontSize: '16px',
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

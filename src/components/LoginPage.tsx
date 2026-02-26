import { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';

interface LoginPageProps {
  onLogin: () => void;
}

export const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setError('Wrong password');
        return;
      }

      const data = await res.json();
      localStorage.setItem('rc_token', data.token);
      onLogin();
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="bg-elevated border border-default rounded-xl p-8 w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="p-3 bg-blue-600/20 rounded-full">
            <Lock size={24} className="text-blue-400" />
          </div>
          <h1 className="text-xl font-semibold text-primary">Tabularis Remote</h1>
          <p className="text-sm text-muted text-center">Enter the server password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full bg-base border border-strong rounded px-3 py-2 text-primary focus:outline-none focus:border-blue-500 transition-colors"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

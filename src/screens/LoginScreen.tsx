import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, Lock, Mail } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) setError(err);
    else navigate('/dashboard');
  }

  return (
    <AuthLayout
      title="Bienvenido de vuelta"
      subtitle="Retoma tu práctica cuando quieras."
      footer={
        <p className="auth-switch">
          ¿No tienes cuenta? <Link to="/register" state={{ openAuth: true }}>Crea tu cuenta</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="login-email" className="auth-label mb-2 block text-[11px] font-bold uppercase tracking-[.13em]">
            Correo electrónico
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="auth-input w-full rounded-xl py-3 pl-11 pr-4 text-sm outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label htmlFor="login-password" className="auth-label mb-2 block text-[11px] font-bold uppercase tracking-[.13em]">
            Contraseña
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              className="auth-input w-full rounded-xl py-3 pl-11 pr-4 text-sm outline-none transition-all"
            />
          </div>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="auth-error rounded-xl border px-3 py-2.5 text-xs"
            role="alert"
          >
            {error}
          </motion.p>
        )}

        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ y: loading ? 0 : -1 }}
          whileTap={{ scale: 0.99 }}
          className="auth-submit flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-extrabold transition-all disabled:cursor-not-allowed disabled:opacity-55"
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><span>Iniciar sesión</span><ArrowRight className="h-4 w-4" /></>}
        </motion.button>
      </form>
    </AuthLayout>
  );
}

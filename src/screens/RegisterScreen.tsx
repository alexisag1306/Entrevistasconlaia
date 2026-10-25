import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, Lock, Mail, User } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { useAuth } from '@/context/AuthContext';

function getPasswordStrength(pwd: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pwd.length === 0) return { level: 0, label: '', color: '' };
  if (pwd.length < 6) return { level: 1, label: 'Muy débil', color: '#f87171' };
  if (pwd.length < 8) return { level: 2, label: 'Débil', color: '#909aa8' };
  const strong = [/[A-Z]/.test(pwd), /\d/.test(pwd), /[^A-Za-z0-9]/.test(pwd)].filter(Boolean).length;
  if (strong >= 2) return { level: 3, label: 'Segura', color: '#cbd2dc' };
  return { level: 2, label: 'Aceptable', color: '#aeb7c3' };
}

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const strength = getPasswordStrength(password);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmationMessage(null);
    if (!fullName.trim()) {
      setError('El nombre no puede estar vacío.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLoading(true);
    const { error: err, confirmationRequired } = await signUp(email, password, fullName.trim());
    setLoading(false);
    if (err) setError(err);
    else if (confirmationRequired) {
      setConfirmationMessage('Tu cuenta se creó. Confirma tu correo y después inicia sesión; guardaremos tu perfil al validar la cuenta.');
    }
    else navigate('/dashboard');
  }

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Empieza a preparar tu siguiente oportunidad."
      footer={
        <p className="auth-switch">
          ¿Ya tienes cuenta? <Link to="/login" state={{ openAuth: true }}>Inicia sesión</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="register-name" className="auth-label mb-2 block text-[11px] font-bold uppercase tracking-[.13em]">
            Nombre completo
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
            <input
              id="register-name"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Tu nombre"
              className="auth-input w-full rounded-xl py-3 pl-11 pr-4 text-sm outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label htmlFor="register-email" className="auth-label mb-2 block text-[11px] font-bold uppercase tracking-[.13em]">
            Correo electrónico
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
            <input
              id="register-email"
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
          <label htmlFor="register-password" className="auth-label mb-2 block text-[11px] font-bold uppercase tracking-[.13em]">
            Contraseña
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Al menos 6 caracteres"
              className="auth-input w-full rounded-xl py-3 pl-11 pr-4 text-sm outline-none transition-all"
            />
          </div>
          {password.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5">
              <div className="flex gap-1">
                {[1, 2, 3].map(bar => (
                  <div
                    key={bar}
                    className="h-1 flex-1 rounded-full transition-all duration-300"
                    style={{ background: strength.level >= bar ? strength.color : 'var(--border)' }}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-xs font-medium" style={{ color: strength.color }}>{strength.label}</p>
            </motion.div>
          )}
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

        {confirmationMessage && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-xs text-[var(--text-secondary)]"
            role="status"
          >
            {confirmationMessage}
          </motion.p>
        )}

        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ y: loading ? 0 : -1 }}
          whileTap={{ scale: 0.99 }}
          className="auth-submit mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-extrabold transition-all disabled:cursor-not-allowed disabled:opacity-55"
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><span>Crear cuenta</span><ArrowRight className="h-4 w-4" /></>}
        </motion.button>
      </form>
    </AuthLayout>
  );
}

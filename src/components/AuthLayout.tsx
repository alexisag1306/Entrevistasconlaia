import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, LockKeyhole } from 'lucide-react';
import AnimatedWords from '@/components/AnimatedWords';
import BrandLogo from '@/components/BrandLogo';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
}

const headlineWords = ['RESPONDER', 'DESTACAR', 'AVANZAR'];

export default function AuthLayout({
  title,
  subtitle,
  footer,
  children,
}: AuthLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const isRegister = location.pathname === '/register';
  const activeMode = isRegister ? 'register' : 'login';
  const [formOpen, setFormOpen] = useState(() => Boolean((location.state as { openAuth?: boolean } | null)?.openAuth));
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [headlinePhase, setHeadlinePhase] = useState<'visible' | 'leaving' | 'entering'>('visible');

  useEffect(() => {
    let nextTimer = 0;
    let exitTimer = 0;
    let firstFrame = 0;
    let secondFrame = 0;
    let cancelled = false;

    function scheduleNextWord() {
      nextTimer = window.setTimeout(() => {
        if (cancelled) return;
        if (reduceMotion) {
          setHeadlineIndex((current) => (current + 1) % headlineWords.length);
          scheduleNextWord();
          return;
        }

        setHeadlinePhase('leaving');
        exitTimer = window.setTimeout(() => {
          if (cancelled) return;
          setHeadlineIndex((current) => (current + 1) % headlineWords.length);
          setHeadlinePhase('entering');
          firstFrame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(() => {
              if (cancelled) return;
              setHeadlinePhase('visible');
              scheduleNextWord();
            });
          });
        }, 560);
      }, 2500);
    }

    scheduleNextWord();
    return () => {
      cancelled = true;
      window.clearTimeout(nextTimer);
      window.clearTimeout(exitTimer);
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (!formOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setFormOpen(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [formOpen]);

  function openMode(mode: 'login' | 'register') {
    if (mode === activeMode) {
      setFormOpen(true);
      return;
    }
    navigate(mode === 'register' ? '/register' : '/login', { state: { openAuth: true } });
  }

  return (
    <main className="auth-portal">
      <div className="auth-portal-cover" aria-hidden="true">
        <img src="/images/cover/voice-interview.jpg" alt="" />
        <span />
      </div>

      <header className="auth-portal-header">
        <div className="auth-portal-header-actions">
          <motion.button
            type="button"
            className="auth-portal-signin"
            onClick={() => openMode('login')}
            initial={reduceMotion ? false : { opacity: 0, x: 18, scale: .96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: .55, delay: .18, ease: [.22, 1, .36, 1] }}
            whileHover={reduceMotion ? undefined : { y: -3, scale: 1.025 }}
            whileTap={reduceMotion ? undefined : { scale: .97 }}
          >
            Iniciar sesión <ArrowRight aria-hidden="true" />
          </motion.button>
          <motion.button
            type="button"
            className="auth-portal-signup"
            onClick={() => openMode('register')}
            initial={reduceMotion ? false : { opacity: 0, x: 18, scale: .96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: .55, delay: .29, ease: [.22, 1, .36, 1] }}
            whileHover={reduceMotion ? undefined : { y: -3, scale: 1.025 }}
            whileTap={reduceMotion ? undefined : { scale: .97 }}
          >
            Crear cuenta <ArrowUpRight aria-hidden="true" />
          </motion.button>
        </div>
      </header>

      <motion.section
        className="auth-portal-poster"
        aria-label="SimulaEntrevista: práctica con inteligencia artificial"
        initial={reduceMotion ? false : { opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .75, delay: .12, ease: [.22, 1, .36, 1] }}
      >
        <p>ENTREVISTAS · PRÁCTICA CON IA</p>
        <h1 aria-label="Prepárate para responder, destacar y avanzar">
          <span className="auth-portal-fixed-line"><AnimatedWords text="PREPÁRATE" /></span>
          <em>
            <span className="auth-portal-poster-static auth-portal-fixed-para">PARA</span>
            <span className="auth-portal-phrase-window" aria-hidden="true">
              <span className={`auth-portal-phrase auth-portal-phrase--${reduceMotion ? 'visible' : headlinePhase}`}>
                {headlineWords[headlineIndex]}
              </span>
            </span>
          </em>
        </h1>
        <span className="auth-portal-poster-note">Voz o texto <i /> A tu ritmo</span>
      </motion.section>

      <AnimatePresence>
        {formOpen && (
          <>
            <motion.button
              type="button"
              className="auth-portal-backdrop"
              aria-label="Cerrar formulario de acceso"
              onClick={() => setFormOpen(false)}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: .24 }}
            />
            <motion.aside
              className="auth-portal-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="auth-portal-title"
              initial={reduceMotion ? { opacity: 0 } : { x: '100%', opacity: .7 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { x: '100%', opacity: .7 }}
              transition={{ duration: reduceMotion ? .15 : .46, ease: [.22, 1, .36, 1] }}
            >
              <div className="auth-portal-panel-top">
                <button type="button" onClick={() => setFormOpen(false)}><ArrowLeft aria-hidden="true" /> Volver</button>
                <span>ACCESO SEGURO <LockKeyhole aria-hidden="true" /></span>
              </div>
              <div className="auth-portal-panel-content">
                <BrandLogo to="/login" className="auth-portal-panel-brand" />
                <motion.div className="auth-portal-form-heading" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .16, duration: .3 }}>
                  <p>{isRegister ? 'EMPIEZA POR AQUÍ' : 'QUÉ BUENO VERTE DE NUEVO'}</p>
                  <h2 id="auth-portal-title">{title}</h2>
                  <span>{subtitle}</span>
                </motion.div>
                <div className="auth-portal-form">{children}</div>
                {footer}
                <p className="auth-portal-privacy"><LockKeyhole aria-hidden="true" /> Tu información se utiliza únicamente para gestionar tu cuenta y tus prácticas.</p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}

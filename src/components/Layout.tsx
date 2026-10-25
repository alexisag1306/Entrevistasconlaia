import { useEffect, useState, type MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, LayoutDashboard, LogOut, Mic, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import BrandLogo from '@/components/BrandLogo';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

const MotionLink = motion.create(Link);

const navItems = [
  { to: '/dashboard', label: 'Inicio', mobileLabel: 'Inicio', icon: LayoutDashboard },
  { to: '/setup/voice', label: 'Por Voz', mobileLabel: 'Voz', icon: Mic },
  { to: '/setup/text', label: 'Por Texto', mobileLabel: 'Texto', icon: FileText },
  { to: '/profile', label: 'Perfil', mobileLabel: 'Perfil', icon: User },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirmDialog();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [headerCompact, setHeaderCompact] = useState(false);

  useEffect(() => {
    let previousY = window.scrollY;
    if (previousY > 80) setHeaderCompact(true);
    function updateHeaderOnScroll() {
      const currentY = window.scrollY;
      if (currentY < 48) setHeaderCompact(false);
      else if (currentY > previousY + 4) setHeaderCompact(true);
      else if (currentY < previousY - 7) setHeaderCompact(false);
      previousY = currentY;
    }
    window.addEventListener('scroll', updateHeaderOnScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateHeaderOnScroll);
  }, []);

  function isActive(to: string) {
    return location.pathname === to ||
      (to === '/setup/voice' && location.pathname === '/voice') ||
      (to === '/setup/text' && location.pathname === '/text');
  }

  function isInInterview() {
    return location.pathname === '/voice' || location.pathname === '/text';
  }

  async function leaveInterview() {
    return confirm({
      eyebrow: 'Entrevista en curso',
      title: '¿Quieres salir de la entrevista?',
      description: 'La sesión quedará pausada y podrás retomarla desde Inicio. Las respuestas guardadas se conservarán; cualquier respuesta que todavía no hayas enviado podría perderse.',
      confirmLabel: 'Salir y pausar',
      cancelLabel: 'Seguir en entrevista',
    });
  }

  function handleNavigation(event: MouseEvent<HTMLAnchorElement>, to: string) {
    if (isActive(to)) {
      event.preventDefault();
      return;
    }
    if (!isInInterview()) return;

    event.preventDefault();
    void leaveInterview().then(confirmed => {
      if (confirmed) navigate(to);
    });
  }

  async function handleSignOut() {
    if (isInInterview()) {
      const confirmed = await confirm({
        eyebrow: 'Entrevista en curso',
        title: '¿Cerrar sesión ahora?',
        description: 'La entrevista quedará pausada. Tus respuestas guardadas se conservarán y podrás retomarla al volver a entrar.',
        confirmLabel: 'Cerrar sesión',
        cancelLabel: 'Seguir en entrevista',
      });
      if (!confirmed) return;
    }
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-layout scene-bg">
      <div className="site-header-spacer" aria-hidden="true" />
      <header className={`site-header ${headerCompact ? 'is-compact' : ''}`}>
        <div className="header-shell mx-auto w-full px-4 sm:px-6">
          <div className="site-header-inner flex h-[76px] items-center justify-between gap-4">
            <BrandLogo className="shrink-0" />

            <nav className="desktop-nav hidden items-center gap-1 md:flex" aria-label="Navegación principal">
              {navItems.map((item) => {
                const active = isActive(item.to);
                const expanded = active || hoveredItem === item.to;
                return (
                  <MotionLink
                    key={item.to}
                    layout
                    to={item.to}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    title={item.label}
                    onClick={(event) => handleNavigation(event, item.to)}
                    className={`app-nav-link ${active ? 'is-active' : ''} ${expanded ? 'is-expanded' : ''}`}
                    onMouseEnter={() => setHoveredItem(item.to)}
                    onMouseLeave={() => setHoveredItem(current => current === item.to ? null : current)}
                    onFocus={() => setHoveredItem(item.to)}
                    onBlur={() => setHoveredItem(current => current === item.to ? null : current)}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: .96 }}
                    transition={{ layout: { type: 'spring', stiffness: 520, damping: 38 }, y: { duration: .16 } }}
                  >
                    {active && (
                      <motion.span
                        layoutId="desktop-nav-active"
                        className="nav-active-bg"
                        transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                      />
                    )}
                    <span className="nav-icon-wrap"><item.icon className="h-[18px] w-[18px]" strokeWidth={1.9} /></span>
                    <AnimatePresence initial={false}>
                      {expanded && (
                        <motion.span
                          className="nav-label"
                          initial={{ opacity: 0, width: 0, x: -5 }}
                          animate={{ opacity: 1, width: 'auto', x: 0 }}
                          exit={{ opacity: 0, width: 0, x: -5 }}
                          transition={{ duration: .18, ease: 'easeOut' }}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </MotionLink>
                );
              })}
            </nav>

            <div className="flex min-w-0 items-center gap-3">
              {profile?.full_name && (
                <span className="hidden max-w-[150px] truncate text-xs font-medium text-[var(--text-muted)] sm:block">
                  {profile.full_name}
                </span>
              )}
              <button
                onClick={() => { void handleSignOut(); }}
                className="signout-button flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="mobile-nav fixed bottom-0 left-0 right-0 z-40 flex justify-around px-1 py-2 md:hidden" aria-label="Navegación móvil">
        {navItems.map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`mobile-nav-link ${active ? 'is-active' : ''}`}
              onClick={(event) => handleNavigation(event, item.to)}
            >
              {active && <motion.span layoutId="mobile-nav-active" className="mobile-nav-active-bg" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
              <item.icon className="relative z-10 h-5 w-5" strokeWidth={1.9} />
              <span className="relative z-10">{item.mobileLabel}</span>
            </Link>
          );
        })}
      </nav>

      <main className={`app-main flex-1 pb-24 md:pb-12 ${location.pathname.startsWith('/setup/') ? 'app-main--setup' : ''}`}>
        {children}
        <footer className="app-footer">
          <Link to="/privacy">Privacidad y uso de IA</Link>
          <span>SimulaEntrevista · ISC</span>
        </footer>
      </main>
      {dialog}
    </div>
  );
}

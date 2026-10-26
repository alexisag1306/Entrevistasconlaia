import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import SetupIllustration from '@/components/SetupIllustration';
import SessionConsole from '@/components/SessionConsole';
import RoleArtwork from '@/components/RoleArtwork';
import AnimatedWords from '@/components/AnimatedWords';
import {
  Mic, FileText, Globe, Code2, Database, Layers,
  MessageSquare, Wrench, Shuffle, ArrowRight, ChevronLeft,
  Check, Clock3, Hourglass, Sparkles, Timer
} from 'lucide-react';
import type { RoleFocus, SessionType, QuestionCount } from '@/types';

/* ── Datos ────────────────────────────────────────────── */

type RoleOption = {
  value: RoleFocus; label: string; desc: string; icon: React.ElementType;
  accentColor: string; accentBg: string; accentBorder: string;
  barBg: string; praise: string; highlights: string[];
};

const ROLES: RoleOption[] = [
  {
    value: 'general', label: 'General ISC', desc: 'Algoritmos, OOP, Git, redes, SO',
    icon: Layers,
    accentColor: '#c5ccd6', accentBg: 'rgba(192,202,215,0.12)', accentBorder: 'rgba(192,202,215,0.32)',
    barBg: 'linear-gradient(90deg,#dce1e8,#8994a2)',
    praise: 'Buena elección: comunicar fundamentos con claridad ayuda a resolver problemas con seguridad.',
    highlights: ['Algoritmos', 'POO', 'Git', 'Redes', 'Sistemas'],
  },
  {
    value: 'web', label: 'Desarrollo Web', desc: 'HTML, CSS, JS, React, rendimiento',
    icon: Globe,
    accentColor: '#c5ccd6', accentBg: 'rgba(192,202,215,0.12)', accentBorder: 'rgba(192,202,215,0.32)',
    barBg: 'linear-gradient(90deg,#dce1e8,#8994a2)',
    praise: 'Buen enfoque: podrás explicar cómo equilibras experiencia, rendimiento y accesibilidad.',
    highlights: ['React', 'Interfaces', 'Accesibilidad', 'Rendimiento'],
  },
  {
    value: 'backend', label: 'Backend / APIs', desc: 'REST, Node.js, auth, arquitectura',
    icon: Code2,
    accentColor: '#c5ccd6', accentBg: 'rgba(192,202,215,0.12)', accentBorder: 'rgba(192,202,215,0.32)',
    barBg: 'linear-gradient(90deg,#dce1e8,#8994a2)',
    praise: 'Aquí puedes mostrar criterio sobre diseño de APIs, seguridad y decisiones de arquitectura.',
    highlights: ['REST', 'Node.js', 'Seguridad', 'Arquitectura'],
  },
  {
    value: 'bd', label: 'Bases de Datos', desc: 'SQL, normalización, índices, NoSQL',
    icon: Database,
    accentColor: '#c5ccd6', accentBg: 'rgba(192,202,215,0.12)', accentBorder: 'rgba(192,202,215,0.32)',
    barBg: 'linear-gradient(90deg,#dce1e8,#8994a2)',
    praise: 'Excelente enfoque: el modelado y el razonamiento sobre datos marcan la diferencia.',
    highlights: ['SQL', 'Modelado', 'Índices', 'NoSQL'],
  },
];

const SESSION_TYPES: { value: SessionType; label: string; desc: string; icon: React.ElementType; image: string }[] = [
  { value: 'mixta',      label: 'Mixta',            desc: 'Conductuales + técnicas', icon: Shuffle, image: '/images/interview-options/questions-mixed.webp' },
  { value: 'tecnica',    label: 'Solo técnicas',     desc: 'Enfocada en el área',     icon: Wrench, image: '/images/interview-options/questions-technical.webp' },
  { value: 'conductual', label: 'Solo conductuales', desc: 'Soft skills',             icon: MessageSquare, image: '/images/interview-options/questions-behavioral.webp' },
];

const QUESTION_COUNTS: { value: QuestionCount; label: string; time: string; desc: string; icon: React.ElementType; image: string }[] = [
  { value: 5,  label: '5',  time: '~10 min', desc: 'Rápida',   icon: Timer, image: '/images/interview-options/time-quick.webp' },
  { value: 10, label: '10', time: '~20 min', desc: 'Estándar', icon: Clock3, image: '/images/interview-options/time-standard.webp' },
  { value: 15, label: '15', time: '~30 min', desc: 'Completa', icon: Hourglass, image: '/images/interview-options/time-complete.webp' },
];

const QUESTION_PREVIEWS: Record<RoleFocus, Record<SessionType, string>> = {
  general: {
    mixta: '¿Cómo explicarías una decisión técnica que tomaste y el problema que buscabas resolver?',
    tecnica: '¿Qué diferencia hay entre una pila y una cola, y en qué caso elegirías cada una?',
    conductual: 'Cuéntame de una ocasión en que tuviste que aprender una herramienta o concepto con poco tiempo.',
  },
  web: {
    mixta: '¿Cómo mejorarías la carga inicial de una aplicación web sin sacrificar la experiencia?',
    tecnica: '¿Cómo detectas y reduces renders innecesarios en una interfaz React?',
    conductual: 'Háblame de un cambio de interfaz que tuviste que ajustar después de recibir retroalimentación.',
  },
  backend: {
    mixta: '¿Cómo diseñarías un endpoint para que un reintento no duplique una operación?',
    tecnica: '¿Qué mecanismos usarías para proteger una API y cómo controlarías el acceso?',
    conductual: 'Cuéntame sobre una ocasión en que tuviste que diagnosticar un problema difícil de reproducir.',
  },
  bd: {
    mixta: '¿Qué revisarías antes de añadir un índice a una consulta lenta?',
    tecnica: '¿Cómo identificarías una anomalía de actualización y la corregirías mediante normalización?',
    conductual: 'Descríbeme un error de datos que hayas detectado y cómo verificaste su causa.',
  },
};

/* ── Variantes ────────────────────────────────────────── */
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};
const cardMotion = {
  rest:  { scale: 1, y: 0, rotateX: 0, rotateY: 0, z: 0 },
  hover: { scale: 1.012, y: -3, rotateX: 1.5, rotateY: -1.2, z: 7, transition: { duration: 0.2, ease: 'easeOut' } },
  tap:   { scale: 0.985, rotateX: -1.5, z: 2 },
};

/* ── Componente ──────────────────────────────────────── */
export default function InterviewSetupScreen() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // These setup routes are explicit (/setup/voice and /setup/text), not /setup/:mode.
  const mode: 'voice' | 'text' = pathname === '/setup/text' ? 'text' : 'voice';
  const isVoice = mode === 'voice';
  const motionEnabled = !useReducedMotion();

  const [role, setRole]               = useState<RoleFocus | null>(null);
  const [previousRole, setPreviousRole] = useState<RoleFocus | null>(null);
  const [consoleReplayKey, setConsoleReplayKey] = useState(0);
  const [hoveredRole, setHoveredRole] = useState<RoleFocus | null>(null);
  const [deckHoverLocked, setDeckHoverLocked] = useState(false);
  const hoverLockUntil = useRef(0);
  const hoverLockPointer = useRef<{ x: number; y: number } | null>(null);
  const hoverLockMoved = useRef(false);
  const hoverLockActive = useRef(false);
  const pendingHoverRole = useRef<RoleFocus | null>(null);
  const hoverUnlockTimer = useRef<number | null>(null);
  const previewHoverTimer = useRef<number | null>(null);
  const pendingPreviewRole = useRef<RoleFocus | null>(null);
  const pendingPreviewPointer = useRef<{ x: number; y: number } | null>(null);
  const lastPreviewPointer = useRef<{ x: number; y: number } | null>(null);
  const [sessionType, setSessionType] = useState<SessionType>('mixta');
  const [count, setCount]             = useState<QuestionCount>(10);

  const resolvedRole = role ?? 'general';
  const selRole = ROLES.find(r => r.value === resolvedRole)!;
  const selectedType = SESSION_TYPES.find(t => t.value === sessionType)!;
  const sampleQuestion = QUESTION_PREVIEWS[resolvedRole][sessionType];
  const roleDeckOptions = role
    ? [
        ...ROLES.filter(item => item.value === previousRole && item.value !== role),
        ...ROLES.filter(item => item.value !== role && item.value !== previousRole),
      ]
    : [];
  const previewingAlternative = Boolean(role && hoveredRole && hoveredRole !== role);
  const featuredRoleValue = previewingAlternative ? hoveredRole! : resolvedRole;
  const featuredRole = ROLES.find(item => item.value === featuredRoleValue)!;
  const visibleDeckOptions = previewingAlternative
    ? [ROLES.find(item => item.value === role)!, ...roleDeckOptions.filter(item => item.value !== featuredRoleValue)]
    : roleDeckOptions;

  useEffect(() => () => {
    if (previewHoverTimer.current !== null) window.clearTimeout(previewHoverTimer.current);
    if (hoverUnlockTimer.current !== null) window.clearTimeout(hoverUnlockTimer.current);
  }, []);

  function cancelPreviewSchedule() {
    if (previewHoverTimer.current !== null) window.clearTimeout(previewHoverTimer.current);
    previewHoverTimer.current = null;
    pendingPreviewRole.current = null;
    pendingPreviewPointer.current = null;
  }

  function scheduleRolePreview(nextRole: RoleFocus | null, pointer: { x: number; y: number } | null = null) {
    const requestedRole = nextRole === role ? null : nextRole;
    if (hoverLockActive.current) {
      cancelPreviewSchedule();
      pendingHoverRole.current = requestedRole;
      return;
    }

    if (requestedRole === hoveredRole) {
      cancelPreviewSchedule();
      return;
    }
    if (previewHoverTimer.current !== null && pendingPreviewRole.current === requestedRole) {
      if (pointer) pendingPreviewPointer.current = pointer;
      return;
    }

    cancelPreviewSchedule();
    pendingPreviewRole.current = requestedRole;
    pendingPreviewPointer.current = pointer;
    previewHoverTimer.current = window.setTimeout(() => {
      const roleToPreview = pendingPreviewRole.current;
      setHoveredRole(roleToPreview);
      lastPreviewPointer.current = roleToPreview ? pendingPreviewPointer.current : null;
      previewHoverTimer.current = null;
      pendingPreviewRole.current = null;
      pendingPreviewPointer.current = null;
    }, requestedRole ? 280 : 110);
  }

  function handleRoleSelect(nextRole: RoleFocus, event?: React.MouseEvent<HTMLButtonElement>) {
    cancelPreviewSchedule();
    lastPreviewPointer.current = null;
    setConsoleReplayKey((key) => key + 1);
    hoverLockUntil.current = Date.now() + 850;
    hoverLockActive.current = true;
    pendingHoverRole.current = null;
    hoverLockPointer.current = event && event.detail > 0 ? { x: event.clientX, y: event.clientY } : null;
    hoverLockMoved.current = hoverLockPointer.current === null;
    setDeckHoverLocked(true);
    if (hoverUnlockTimer.current !== null) window.clearTimeout(hoverUnlockTimer.current);
    hoverUnlockTimer.current = window.setTimeout(() => {
      if (hoverLockMoved.current || hoverLockPointer.current === null) releaseDeckHoverLock();
      hoverUnlockTimer.current = null;
    }, 850);
    setHoveredRole(null);
    if (role && role !== nextRole) setPreviousRole(role);
    setRole(nextRole);
  }

  function clearRolePreview() {
    cancelPreviewSchedule();
    if (hoverLockActive.current) {
      pendingHoverRole.current = null;
      return;
    }
    lastPreviewPointer.current = null;
    setHoveredRole(null);
  }

  function releaseDeckHoverLock(
    nextRole = pendingHoverRole.current,
    pointer = pendingPreviewPointer.current,
  ) {
    pendingPreviewPointer.current = null;
    hoverLockActive.current = false;
    hoverLockUntil.current = 0;
    hoverLockPointer.current = null;
    pendingHoverRole.current = null;
    setDeckHoverLocked(false);
    scheduleRolePreview(nextRole, pointer);
  }

  function handleRolePointerMove(event: React.PointerEvent<HTMLElement>) {
    const hoveredCard = (event.target as HTMLElement).closest<HTMLElement>('[data-role-focus]');
    const targetRole = hoveredCard?.dataset.roleFocus as RoleFocus | undefined ?? null;
    const previewRole = targetRole === role ? null : targetRole;

    if (hoverLockActive.current) {
      const origin = hoverLockPointer.current;
      if (!origin || Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 9) return;
      hoverLockMoved.current = true;
      pendingHoverRole.current = previewRole;
      pendingPreviewPointer.current = { x: event.clientX, y: event.clientY };
      if (Date.now() >= hoverLockUntil.current) releaseDeckHoverLock(previewRole, { x: event.clientX, y: event.clientY });
      return;
    }

    if (!role || hoveredRole) return;
    scheduleRolePreview(previewRole, { x: event.clientX, y: event.clientY });
  }

  function handleRoleClickCapture(event: React.MouseEvent<HTMLElement>) {
    if (!role || !hoveredRole) return;
    const clickedCard = (event.target as HTMLElement).closest<HTMLElement>('[data-role-focus]');
    if (!clickedCard) return;
    const clickedRole = clickedCard.dataset.roleFocus as RoleFocus | undefined;
    if (!clickedRole) return;
    const previewAnchor = lastPreviewPointer.current;
    const pointerStayedAtPreview = Boolean(previewAnchor && Math.hypot(event.clientX - previewAnchor.x, event.clientY - previewAnchor.y) < 20);
    const roleToSelect = pointerStayedAtPreview ? hoveredRole : clickedRole;
    if (clickedRole === roleToSelect) return;

    event.preventDefault();
    event.stopPropagation();
    handleRoleSelect(roleToSelect);
  }

  function handleRoleClear() {
    hoverLockActive.current = false;
    hoverLockUntil.current = 0;
    hoverLockPointer.current = null;
    if (hoverUnlockTimer.current !== null) window.clearTimeout(hoverUnlockTimer.current);
    hoverUnlockTimer.current = null;
    setDeckHoverLocked(false);
    setHoveredRole(null);
    cancelPreviewSchedule();
    lastPreviewPointer.current = null;
    setPreviousRole(null);
    setRole(null);
  }

  function handleStart() {
    if (!role) return;
    const params = new URLSearchParams({ role, type: sessionType, count: String(count) });
    navigate(`/${mode}?${params.toString()}`);
  }

  return (
    <div className="min-h-screen scene-bg">
      <div className="orb-warm-1" />
      <div className="orb-em-2"   />
      <div className="dot-grid" style={{ opacity: 0.5 }} />

      <div className="interview-setup-shell mx-auto px-4 pt-3 pb-8 relative z-10">

        {/* ── Volver ── */}
        <motion.button
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1.5 text-sm mb-3 transition-colors group"
          style={{ color: 'var(--text-subtle)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Volver
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: .45, ease: [0.22, 1, 0.36, 1] }}
          className={`setup-unified-panel setup-unified-panel--${isVoice ? 'voice' : 'text'} ${role ? 'setup-unified-panel--role-selected' : ''}`}
        >
        {/* ── Cabecera y configuración dentro del mismo panel ── */}
        <motion.section
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={`setup-hero setup-hero--${isVoice ? 'voice' : 'text'}`}
        >
          <div className="setup-hero-copy">
            <div className="setup-hero-badge">
              <span className="setup-hero-badge-icon">
                {isVoice ? <Mic /> : <FileText />}
              </span>
              <span>{isVoice ? 'PRÁCTICA POR VOZ' : 'PRÁCTICA POR TEXTO'}</span>
              <i />
            </div>

            <p className="setup-hero-overline">ENTREVISTA SIMULADA · ISC</p>
            <h1 className="setup-hero-title" aria-label={isVoice ? 'Configura tu espacio de voz' : 'Configura tu espacio de ideas'}>
              {isVoice ? <>
                <AnimatedWords text="Configura tu" /><br />
                <em><AnimatedWords text="espacio de voz" /></em>
              </> : <>
                <AnimatedWords text="Configura tu" /><br />
                <em><AnimatedWords text="espacio de ideas" /></em>
              </>}
            </h1>
            <p className="setup-hero-description">
              {isVoice
                ? 'Habla con naturalidad. La IA escucha tu respuesta y te ayuda a mejorarla con observaciones concretas.'
                : 'Tómate el tiempo para ordenar tus ideas y recibe una revisión clara de lo que respondes.'}
            </p>
            <div className="setup-hero-footnote">
              <span className="setup-hero-live-dot" />
              {isVoice ? 'Escucha activa · retroalimentación al terminar' : 'A tu ritmo · retroalimentación al enviar'}
            </div>
          </div>

          <SetupIllustration mode={isVoice ? 'voice' : 'text'} />
        </motion.section>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className={`setup-workspace ${role ? 'setup-workspace--role-selected' : 'setup-workspace--role-picker'}`}
        >
            <motion.div variants={fadeUp} className="setup-selection-intro">
              <span className="setup-selection-kicker"><Sparkles /> A TU MEDIDA</span>
              <AnimatedSetupTitle
                title={role ? 'Personaliza tu entrevista' : 'Elige un rol para comenzar tu práctica con IA'}
                motionEnabled={motionEnabled}
              />
              <p>{role ? 'Ya definimos el área. Ahora ajusta el tipo de preguntas y el tiempo de práctica.' : 'Explora las áreas, elige la que mejor encaja contigo y prepara una sesión hecha para ese rol.'}</p>
            </motion.div>

            <motion.section
              layout
              className={`setup-step-section setup-role-picker ${hoveredRole ? 'is-role-previewing' : ''} ${deckHoverLocked ? 'is-hover-locked' : ''}`}
              onPointerMove={handleRolePointerMove}
              onPointerLeave={clearRolePreview}
              onClickCapture={handleRoleClickCapture}
            >
              <SectionLabel
                title={role ? 'Tu área de práctica' : '¿Qué te gustaría practicar?'}
                detail={role ? 'Pasa el cursor para subir un área al frente; haz clic para seleccionarla.' : 'Selecciona un área para abrir tu espacio de entrevista personalizado.'}
              />
              {role && (
                <motion.button
                  type="button"
                  className="setup-area-back-button"
                  onClick={handleRoleClear}
                  initial={motionEnabled ? { opacity: 0, x: -8 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: motionEnabled ? .22 : 0, delay: motionEnabled ? .08 : 0 }}
                >
                  <ChevronLeft /> Cambiar área
                </motion.button>
              )}
              {role === null ? (
                <motion.div layout className="setup-role-grid" role="group" aria-label="Área de práctica">
                  {ROLES.map((item, index) => (
                    <RoleChoiceCard key={item.value} item={item} index={index} motionEnabled={motionEnabled} onSelect={handleRoleSelect} />
                  ))}
                </motion.div>
              ) : (
                <>
                  <motion.div layout className="setup-role-grid setup-role-grid--expanded" role="group" aria-label="Área de práctica seleccionada">
                    <AnimatePresence initial={false} mode="sync">
                      <RoleChoiceCard
                        key={featuredRole.value}
                        item={featuredRole}
                        index={0}
                        selected={featuredRole.value === role}
                        featured
                        previewing={previewingAlternative}
                        motionEnabled={motionEnabled}
                        onSelect={handleRoleSelect}
                      />
                    </AnimatePresence>
                  </motion.div>
                  <motion.div layout className="setup-role-deck" role="group" aria-label="Otras áreas disponibles">
                    {visibleDeckOptions.map((item, index) => (
                      <RoleChoiceCard
                        key={item.value}
                        item={item}
                        index={index}
                        deck
                        selected={item.value === role}
                        hoverLocked={deckHoverLocked}
                        motionEnabled={motionEnabled}
                        onSelect={handleRoleSelect}
                      />
                    ))}
                  </motion.div>
                </>
              )}
            </motion.section>

            {role !== null && (
                <div className="setup-followup-options">
                  <motion.section className="setup-step-section">
                    <SectionLabel title="¿Qué tipo de entrevista quieres practicar?" detail="Selecciona una opción: mixta, solo técnica o solo conductual." />
                    <div className="setup-type-grid" role="group" aria-label="Tipo de preguntas">
                      {SESSION_TYPES.map((item) => {
                        const selected = sessionType === item.value;
                        return (
                          <motion.button
                            key={item.value}
                            type="button"
                            initial="rest" whileHover={motionEnabled ? 'hover' : undefined} whileTap={motionEnabled ? 'tap' : undefined}
                            variants={cardMotion}
                            onClick={() => setSessionType(item.value)}
                            aria-pressed={selected}
                            className={`setup-choice setup-type-choice ${selected ? 'is-selected' : ''}`}
                          >
                            <span className="setup-type-image" aria-hidden="true"><img src={item.image} alt="" decoding="async" /></span>
                            {selected && <motion.span layoutId="setup-type-wash" className="setup-choice-wash" />}
                            <motion.span
                              className="setup-type-icon"
                              animate={selected && motionEnabled
                                ? { rotateX: [0, -9, 0], rotateY: [0, 12, 0], scale: [1, 1.08, 1] }
                                : { rotateX: 0, rotateY: 0, scale: 1 }}
                              transition={{ duration: motionEnabled ? .38 : 0, ease: [.22, 1, .36, 1] }}
                            ><item.icon /></motion.span>
                            <span className="setup-type-copy"><strong>{item.label}</strong><span>{item.desc}</span></span>
                            {selected && <motion.span layoutId="setup-type-active" className="setup-option-active">ACTIVO</motion.span>}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.section>

                  <motion.section className="setup-step-section">
                    <SectionLabel title="¿Cuántas preguntas quieres responder?" detail="Elige 5, 10 o 15; cada opción muestra una duración aproximada." />
                    <div className="setup-count-grid" role="group" aria-label="Cantidad de preguntas">
                      {QUESTION_COUNTS.map((item) => {
                        const selected = count === item.value;
                        return (
                          <motion.button
                            key={item.value}
                            type="button"
                            initial="rest" whileHover={motionEnabled ? 'hover' : undefined} whileTap={motionEnabled ? 'tap' : undefined}
                            variants={cardMotion}
                            onClick={() => setCount(item.value)}
                            aria-pressed={selected}
                            className={`setup-choice setup-count-choice ${selected ? 'is-selected' : ''}`}
                          >
                            <span className="setup-count-image" aria-hidden="true"><img src={item.image} alt="" decoding="async" /></span>
                            {selected && <motion.span layoutId="setup-count-wash" className="setup-choice-wash" />}
                            <span className="setup-count-number">{item.label}</span>
                            <motion.span
                              className="setup-count-visual"
                              animate={selected && motionEnabled
                                ? { rotateY: [0, 14, 0], rotateX: [0, -8, 0], scale: [.88, 1.08, 1] }
                                : { rotateY: 0, rotateX: 0, scale: 1 }}
                              transition={{ duration: motionEnabled ? .42 : 0, ease: [.22, 1, .36, 1] }}
                              aria-hidden="true"
                            ><item.icon /></motion.span>
                            <span className="setup-count-meta"><Clock3 /> {item.time}</span>
                            <strong>{item.desc}</strong>
                            <span className="setup-count-track"><i style={{ width: `${(item.value / 15) * 100}%` }} /></span>
                            {selected && <motion.span layoutId="setup-count-active" className="setup-option-active">ACTIVO</motion.span>}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.section>

                </div>
            )}
          <AnimatePresence initial={false}>
          {role && <motion.aside
            key="summary"
            variants={fadeUp}
            initial={motionEnabled ? { opacity: 0, y: 18, scale: .985 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={motionEnabled ? { opacity: 0, y: -8, scale: .99 } : undefined}
            transition={{ duration: motionEnabled ? .3 : 0, delay: motionEnabled ? .18 : 0, ease: [.22, 1, .36, 1] }}
            className="setup-summary-column"
          >
            <SessionConsole
              role={resolvedRole}
              roleLabel={selRole.label}
              sessionType={sessionType}
              sessionTypeLabel={selectedType.label}
              count={count}
              mode={isVoice ? 'voice' : 'text'}
              question={sampleQuestion}
              roleSelected={role !== null}
              replayKey={consoleReplayKey}
            />
            <motion.button
              type="button"
              onClick={handleStart}
              whileHover={motionEnabled && role ? { y: -2, boxShadow: '0 14px 30px rgba(198,207,218,.22)' } : undefined}
              whileTap={motionEnabled && role ? { scale: .98 } : undefined}
              disabled={!role}
              className={`setup-start-button ${role ? '' : 'is-disabled'}`}
            >
              {role ? 'Comenzar entrevista' : 'Elige un rol para continuar'} {role && <ArrowRight />}
            </motion.button>
            <p className="setup-preview-privacy">Tus respuestas quedan en tu historial. <Link to="/privacy">Consulta el aviso de datos.</Link></p>
          </motion.aside>}
          </AnimatePresence>
        </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

function RoleChoiceCard({
  item,
  index,
  selected = false,
  featured = false,
  previewing = false,
  deck = false,
  hoverLocked = false,
  motionEnabled,
  onSelect,
}: {
  item: RoleOption;
  index: number;
  selected?: boolean;
  featured?: boolean;
  previewing?: boolean;
  deck?: boolean;
  hoverLocked?: boolean;
  motionEnabled: boolean;
  onSelect: (value: RoleFocus, event?: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <motion.button
      layout
      type="button"
      initial={motionEnabled && (featured || deck) ? { opacity: 0, y: featured ? 18 : -10, rotateX: featured ? -8 : 4, scale: featured ? .975 : .985 } : motionEnabled && !selected ? { opacity: 0, y: 15, rotateX: -5 } : false}
      animate={{
        opacity: 1,
        y: 0,
        rotateX: motionEnabled && deck && !selected ? 5 : 0,
        rotateY: motionEnabled && deck && !selected ? (index % 2 ? 2 : -2) : 0,
        scale: motionEnabled && deck && !selected ? .995 : 1,
        filter: 'blur(0px)',
      }}
      exit={motionEnabled && featured ? { opacity: 0, y: 22, rotateX: 9, scale: .97, transition: { duration: .24, ease: [.22, 1, .36, 1] } } : undefined}
      transition={{
        opacity: { duration: motionEnabled ? .22 : 0, delay: motionEnabled && !selected ? index * .035 : 0 },
        layout: { duration: motionEnabled ? .52 : 0, ease: [.22, 1, .36, 1] },
        default: { duration: motionEnabled ? .48 : 0, ease: [.22, 1, .36, 1] },
      }}
      whileHover={motionEnabled && !selected && !(deck && hoverLocked)
        ? deck
          ? { scale: 1.035, y: -14, rotateX: 0, rotateY: 0, z: 18, transition: { duration: .26, ease: [.22, 1, .36, 1] } }
          : 'hover'
        : undefined}
      whileTap={motionEnabled ? { scale: .985 } : undefined}
      variants={cardMotion}
      onClick={(event) => onSelect(item.value, event)}
      aria-pressed={selected}
      aria-label={selected ? `${item.label}. Área seleccionada.` : previewing ? `Vista previa de ${item.label}. Haz clic para seleccionarla.` : `Cambiar a ${item.label}`}
      className={`setup-choice setup-role-choice ${selected ? 'is-selected' : ''} ${featured ? 'is-expanded' : deck ? 'is-alternative setup-role-deck-card' : ''} ${previewing ? 'is-role-preview-card' : ''}`}
      data-role-focus={item.value}
      style={deck ? { '--deck-index': index } as React.CSSProperties : undefined}
    >
      {!deck && <RoleArtwork role={item.value} />}
      {deck && <span className="setup-role-deck-title">{item.label}</span>}
      <span className="setup-role-copy">
        <span className="setup-choice-overline">{selected ? 'ÁREA SELECCIONADA' : previewing ? 'VISTA PREVIA · CLIC PARA ELEGIR' : 'ÁREA DISPONIBLE'}</span>
        <strong>{item.label}</strong>
        <span className="setup-role-description">{item.desc}</span>
        <span className="setup-role-highlights">{item.highlights.map((highlight, tagIndex) => <i key={highlight} style={{ '--tag-index': tagIndex } as React.CSSProperties}>{highlight}</i>)}</span>
      </span>
      <motion.span
        layoutId={selected ? 'setup-role-check' : undefined}
        className={`setup-choice-check setup-role-check ${selected ? 'is-checked' : ''}`}
        aria-hidden="true"
      >
        {selected && <Check />}
      </motion.span>
      {selected && (
        <motion.span
          className="setup-role-stage-praise"
          initial={motionEnabled ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: motionEnabled ? .26 : 0, delay: motionEnabled ? .14 : 0 }}
        >
          <Sparkles /><span><strong>Buen enfoque.</strong> {item.praise}</span>
        </motion.span>
      )}
    </motion.button>
  );
}

/* ── Sub ─────────────────────────────────────────── */
function SectionLabel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="setup-section-label">
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function AnimatedSetupTitle({ title, motionEnabled }: { title: string; motionEnabled: boolean }) {
  const words = title.split(' ');
  return (
    <h2 className="setup-selection-title" aria-label={title}>
      {words.map((word, wordIndex) => (
        <motion.span
          key={`${title}-${wordIndex}`}
          className={word.toLowerCase() === 'rol' || word.toLowerCase() === 'ia' ? 'is-accent' : undefined}
          aria-hidden="true"
          initial={motionEnabled ? { opacity: 0, y: 12, rotateX: -28 } : false}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: motionEnabled ? .34 : 0, delay: motionEnabled ? wordIndex * .035 : 0, ease: [.22, 1, .36, 1] }}
        >
          {word}{wordIndex < words.length - 1 ? '\u00a0' : ''}
        </motion.span>
      ))}
    </h2>
  );
}


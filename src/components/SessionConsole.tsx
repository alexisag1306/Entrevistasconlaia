import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, CircleHelp, Terminal } from 'lucide-react';
import type { QuestionCount, RoleFocus, SessionType } from '@/types';

interface SessionConsoleProps {
  role: RoleFocus;
  roleLabel: string;
  sessionType: SessionType;
  sessionTypeLabel: string;
  count: QuestionCount;
  mode: 'voice' | 'text';
  question: string;
  roleSelected: boolean;
  replayKey: number;
}

const ROLE_MODULES: Record<RoleFocus, string[]> = {
  general: ['algoritmos', 'fundamentos', 'sistemas'],
  web: ['interfaces', 'rendimiento', 'accesibilidad'],
  backend: ['apis', 'arquitectura', 'seguridad'],
  bd: ['consultas', 'modelado', 'optimización'],
};

interface CodeSegment { text: string; kind?: 'keyword' | 'variable' | 'string' | 'number' }

export default function SessionConsole({ role, roleLabel, sessionType, sessionTypeLabel, count, mode, question, roleSelected, replayKey }: SessionConsoleProps) {
  const motionEnabled = !useReducedMotion();
  const modules = ROLE_MODULES[role];
  const modeLabel = mode === 'voice' ? 'voz' : 'texto';
  const configKey = `${role}-${sessionType}-${count}-${mode}`;
  const codeLines = useMemo<CodeSegment[][]>(() => roleSelected ? [
      [{ text: 'const ', kind: 'keyword' }, { text: 'practica', kind: 'variable' }, { text: ' = {' }],
      [{ text: '  area: ' }, { text: `"${roleLabel}"`, kind: 'string' }, { text: ',' }],
      [{ text: '  enfoque: ' }, { text: `"${sessionTypeLabel}"`, kind: 'string' }, { text: ',' }],
      [{ text: '  preguntas: ' }, { text: String(count), kind: 'number' }, { text: ',' }],
      [{ text: '  formato: ' }, { text: `"${modeLabel}"`, kind: 'string' }],
      [{ text: '};' }],
    ] : [
      [{ text: '// elige un área para empezar', kind: 'keyword' }],
      [{ text: 'const practica = {' }],
      [{ text: '  estado: ' }, { text: '"en espera"', kind: 'string' }],
      [{ text: '};' }],
    ], [roleLabel, sessionTypeLabel, count, modeLabel, roleSelected]);
  const codeLength = codeLines.reduce((total, line, index) => (
    total + line.reduce((lineTotal, segment) => lineTotal + segment.text.length, 0) + (index < codeLines.length - 1 ? 1 : 0)
  ), 0);
  const [typedCharacters, setTypedCharacters] = useState(motionEnabled ? 0 : codeLength);
  const [displayedCode, setDisplayedCode] = useState(() => ({ key: configKey, lines: codeLines, length: codeLength }));
  const [completedAnimationKey, setCompletedAnimationKey] = useState('');
  const typedCharactersRef = useRef(typedCharacters);
  const displayedCodeRef = useRef(displayedCode);
  const animationKey = `${role}-${mode}-${roleSelected}-${replayKey}`;
  typedCharactersRef.current = typedCharacters;
  displayedCodeRef.current = displayedCode;

  useEffect(() => {
    const nextCode = { key: configKey, lines: codeLines, length: codeLength };
    const updateCharacters = (value: number) => {
      typedCharactersRef.current = value;
      setTypedCharacters(value);
    };
    const updateDisplayedCode = (value: typeof nextCode) => {
      displayedCodeRef.current = value;
      setDisplayedCode(value);
    };

    if (!motionEnabled || !roleSelected) {
      updateDisplayedCode(nextCode);
      updateCharacters(codeLength);
      setCompletedAnimationKey(animationKey);
      return;
    }

    setCompletedAnimationKey('');
    let current = Math.min(typedCharactersRef.current, displayedCodeRef.current.length);
    let timer = 0;
    const typeChunk = () => {
      current = Math.min(codeLength, current + 4);
      updateCharacters(current);
      if (current < codeLength) timer = window.setTimeout(typeChunk, 48);
      else setCompletedAnimationKey(animationKey);
    };
    const beginWriting = () => {
      updateDisplayedCode(nextCode);
      current = 0;
      updateCharacters(0);
      timer = window.setTimeout(typeChunk, 65);
    };
    const eraseChunk = () => {
      current = Math.max(0, current - 8);
      updateCharacters(current);
      if (current > 0) timer = window.setTimeout(eraseChunk, 20);
      else beginWriting();
    };

    timer = window.setTimeout(() => {
      if (current > 0) eraseChunk();
      else beginWriting();
    }, 35);
    return () => window.clearTimeout(timer);
  }, [animationKey, codeLength, codeLines, configKey, motionEnabled, roleSelected]);

  let remainingCharacters = typedCharacters;
  const renderedCode = displayedCode.lines.map((line, lineIndex) => {
    const lineLength = line.reduce((total, segment) => total + segment.text.length, 0);
    const visibleLength = Math.max(0, Math.min(lineLength, remainingCharacters));
    const showCaret = visibleLength > 0 && visibleLength < lineLength;
    remainingCharacters = Math.max(0, remainingCharacters - lineLength - (lineIndex < displayedCode.lines.length - 1 ? 1 : 0));
    let charactersInLine = visibleLength;

    return (
      <span key={`${displayedCode.key}-${lineIndex}`}>
        {line.map((segment, segmentIndex) => {
          const visibleText = segment.text.slice(0, Math.max(0, charactersInLine));
          charactersInLine -= segment.text.length;
          return visibleText ? <i key={segmentIndex} className={segment.kind ? `is-${segment.kind}` : undefined}>{visibleText}</i> : null;
        })}
        {showCaret && <i className="setup-console-caret">▋</i>}
      </span>
    );
  });

  return (
    <section className="setup-console" aria-label="Consola de vista previa de tu entrevista">
      <div className="setup-console-topbar">
        <span className="setup-console-brand"><Terminal /> SIMULA <i>/</i> CONFIG</span>
        <span className={`setup-console-status ${completedAnimationKey !== animationKey ? 'is-writing' : ''}`}>
          <b /> {!roleSelected ? 'EN ESPERA' : completedAnimationKey !== animationKey ? 'ESCRIBIENDO' : 'LISTO'}
        </span>
      </div>

      <div className="setup-console-code" aria-label="Código visual de la configuración seleccionada">
        <span className="setup-console-line-number">{displayedCode.lines.map((_, index) => String(index + 1).padStart(2, '0')).join('\n')}</span>
        <code className="setup-console-lines" aria-label={displayedCode.lines.map(line => line.map(segment => segment.text).join('')).join('\n')}>
          {renderedCode}
          {typedCharacters >= displayedCode.length && completedAnimationKey === animationKey && <i className="setup-console-caret">▋</i>}
        </code>
      </div>

      <div className="setup-console-modules">
        <span>MÓDULOS PREPARADOS</span>
        <div>{(roleSelected ? modules : ['esperando selección']).map((module, index) => <motion.i key={`${role}-${module}`} initial={motionEnabled && roleSelected ? { scaleX: 0 } : false} animate={{ scaleX: 1 }} transition={{ duration: .25, delay: index * .08, ease: 'easeOut' }}>{module}</motion.i>)}</div>
      </div>

      <div className="setup-console-output">
        <div className="setup-console-output-head"><span><Check /> {roleSelected ? 'CONFIGURACIÓN LISTA' : 'PENDIENTE DE CONFIGURAR'}</span><span>VISTA PREVIA</span></div>
        <div className="setup-console-question">
          <span><CircleHelp /> PRIMERA PREGUNTA POSIBLE</span>
          <AnimatePresence mode="wait">
            <motion.p
              key={`${roleSelected}-${role}-${sessionType}`}
              initial={motionEnabled ? { opacity: 0, y: 5 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={motionEnabled ? { opacity: 0, y: -4 } : undefined}
              transition={{ duration: motionEnabled ? .2 : 0 }}
            >{roleSelected ? `“${question}”` : 'Al elegir un rol, aparecerá una pregunta de ejemplo aquí.'}</motion.p>
          </AnimatePresence>
        </div>
        <div className="setup-console-disclaimer">Animación de configuración · no es código ejecutable</div>
      </div>
    </section>
  );
}

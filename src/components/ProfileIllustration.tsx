import { motion, useReducedMotion } from 'framer-motion';
import { Activity, Award, Sparkles } from 'lucide-react';

interface ProfileIllustrationProps {
  name: string;
  level: string;
  sessions: number;
  average: number;
  best: number;
}

export default function ProfileIllustration({ name, level, sessions, average, best }: ProfileIllustrationProps) {
  const motionEnabled = !useReducedMotion();
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'ISC';
  const bars = [26, 43, 34, 58, 48, 72, 63, 88];

  return (
    <div className="profile-visual" role="img" aria-label={`Perfil de ${name}, nivel ${level}, ${sessions} respuestas guardadas.`}>
      <div className="profile-visual-photo" aria-hidden="true">
        <img src="/images/profile/profile-workspace.jpg" alt="" loading="lazy" decoding="async" />
      </div>
      <div className="profile-visual-grid" />
      <div className="profile-visual-orbit profile-visual-orbit--one" />
      <div className="profile-visual-orbit profile-visual-orbit--two" />
      <motion.div
        className="profile-visual-mascot"
        animate={motionEnabled ? { y: [0, -6, 0], rotateZ: [-3, 1, -3], rotateY: [-8, 4, -8] } : {}}
        transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 100 112" fill="none">
          <ellipse cx="52" cy="104" rx="32" ry="6" fill="#090b0e" fillOpacity=".34" />
          <path d="M28 77c0-9 7-16 16-16h17c10 0 17 7 17 16v20H28V77Z" fill="url(#mascotBody)" stroke="#dbe0e7" strokeOpacity=".6" />
          <path d="M46 62V51h13v11" stroke="#c1c9d3" strokeWidth="5" strokeLinecap="round" />
          <rect x="20" y="17" width="62" height="47" rx="17" fill="url(#mascotHead)" stroke="#f1f3f6" strokeOpacity=".82" />
          <path d="M51 17V9" stroke="#d8dde4" strokeWidth="4" strokeLinecap="round" />
          <circle cx="51" cy="7" r="5" fill="#cbd2dc" />
          <rect x="14" y="32" width="8" height="17" rx="4" fill="#8993a0" />
          <rect x="80" y="32" width="8" height="17" rx="4" fill="#8993a0" />
          <circle cx="39" cy="39" r="4" fill="#414954" />
          <circle cx="63" cy="39" r="4" fill="#414954" />
          <path d="M42 51c5 4 13 4 18 0" stroke="#747e8b" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M39 82h28" stroke="#e3e7ed" strokeOpacity=".8" strokeWidth="3" strokeLinecap="round" />
          <circle cx="52" cy="91" r="4" fill="#d4dae2" />
          <defs>
            <linearGradient id="mascotHead" x1="25" y1="18" x2="78" y2="67" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f1f3f6" /><stop offset="1" stopColor="#adb6c2" />
            </linearGradient>
            <linearGradient id="mascotBody" x1="32" y1="62" x2="73" y2="101" gradientUnits="userSpaceOnUse">
              <stop stopColor="#8e98a6" /><stop offset="1" stopColor="#414954" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>
      <motion.div
        className="profile-visual-sparkle"
        animate={motionEnabled ? { opacity: [.35, 1, .35], rotate: [0, 20, 0], scale: [.8, 1.15, .8] } : {}}
        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      ><Sparkles /></motion.div>

      <motion.div
        className="profile-visual-card"
        animate={motionEnabled ? { y: [0, -8, 0], rotateY: [-5, -1, -5], rotateX: [2, 0, 2] } : {}}
        transition={{ duration: 7.5, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      >
        <div className="profile-visual-card-top"><span>PERFIL DE PRÁCTICA</span><i /></div>
        <div className="profile-visual-person-row">
          <div className="profile-visual-avatar"><span>{initials}</span><i /></div>
          <div className="profile-visual-person-copy"><strong>{name}</strong><span>{level}</span></div>
          <div className="profile-visual-award"><Award /></div>
        </div>
        <div className="profile-visual-chart-head"><span><Activity /> Tu progreso</span><strong>{average > 0 ? `${average}/10` : 'EN CAMINO'}</strong></div>
        <div className="profile-visual-chart">
          {bars.map((height, index) => (
            <motion.i
              key={index}
              style={{ height: `${height}%` }}
              animate={motionEnabled ? { scaleY: [1, index % 2 === 0 ? .86 : 1.1, 1], opacity: [.7, 1, .7] } : {}}
              transition={{ duration: 2.8 + (index % 3) * .35, repeat: Infinity, ease: 'easeInOut', delay: index * .1 }}
            />
          ))}
        </div>
        <div className="profile-visual-card-foot"><span>{sessions} respuestas guardadas</span><span>Mejor: {best > 0 ? `${best}/10` : '—'}</span></div>
      </motion.div>

      <motion.div
        className="profile-visual-float-tag"
        animate={motionEnabled ? { y: [0, 5, 0], rotateZ: [-2, 1, -2] } : {}}
        transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      ><span className="profile-visual-tag-dot" /> Perfil en evolución</motion.div>
    </div>
  );
}

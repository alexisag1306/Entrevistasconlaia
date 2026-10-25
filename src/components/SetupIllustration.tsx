import { motion, useReducedMotion } from 'framer-motion';
import { Bot, Check, FileText, Mic, PenLine, Sparkles } from 'lucide-react';

type SetupMode = 'voice' | 'text';

export default function SetupIllustration({ mode }: { mode: SetupMode }) {
  const isVoice = mode === 'voice';
  const motionEnabled = !useReducedMotion();

  return (
    <div
      className={`setup-scene setup-scene--${mode}`}
      role="img"
      aria-label={isVoice
        ? 'Vista profesional de una práctica por voz con una persona en videollamada y una interfaz de entrevista con inteligencia artificial.'
        : 'Vista profesional de una práctica escrita con una persona frente a su equipo y una interfaz de análisis con inteligencia artificial.'}
    >
      <div className="setup-scene-grid" />
      <div className="setup-scene-orbit setup-scene-orbit--outer" />
      <div className="setup-scene-orbit setup-scene-orbit--inner" />
      <motion.div
        className="setup-scene-spark setup-scene-spark--one"
        animate={motionEnabled ? { opacity: [.3, 1, .3], scale: [.75, 1.12, .75], rotate: [0, 16, 0] } : {}}
        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      ><Sparkles /></motion.div>
      <motion.div
        className="setup-scene-spark setup-scene-spark--two"
        animate={motionEnabled ? { opacity: [.2, .8, .2], scale: [1, .7, 1], rotate: [12, -12, 12] } : {}}
        transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut', delay: .7 }}
        aria-hidden="true"
      ><Sparkles /></motion.div>

      <motion.div
        className="setup-scene-person"
        animate={motionEnabled ? { y: [0, -6, 0], rotateY: [0, -3, 0] } : {}}
        transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      >
        <img
          className="setup-person-photo"
          src={isVoice ? '/images/interview-setup/voice-professional.jpg' : '/images/interview-setup/text-professional.jpg'}
          alt=""
        />
        <span className="setup-person-photo-shade" />
        <span className="setup-person-photo-label"><i /> {isVoice ? 'ENTREVISTA EN VIVO' : 'SESIÓN DE PRÁCTICA'}</span>
      </motion.div>

      <motion.div
        className="setup-scene-device"
        animate={motionEnabled ? { rotateX: [2, 0, 2], rotateY: [-5, -2, -5], y: [0, 4, 0] } : {}}
        transition={{ duration: 7.2, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      >
        <div className="setup-device-screen">
          <div className="setup-device-topbar"><i /><i /><i /><span>SIMULA · IA</span></div>
          <div className="setup-device-interface">
            <div className="setup-ai-orb"><Bot /></div>
            <div className="setup-device-chat">
              <span>{isVoice ? 'ENTREVISTADORA IA' : 'ANÁLISIS DE RESPUESTA'}</span>
              <strong>{isVoice ? 'Cuéntame tu razonamiento' : 'Una idea a la vez'}</strong>
              <i /><i /><i />
            </div>
            {isVoice ? (
              <div className="setup-device-wave" aria-hidden="true">{Array.from({ length: 15 }, (_, index) => <i key={index} />)}</div>
            ) : (
              <div className="setup-device-lines" aria-hidden="true"><i /><i /><i /><i /></div>
            )}
          </div>
          <div className="setup-device-base" />
        </div>
        <div className="setup-device-keyboard" />
      </motion.div>

      <motion.div
        className={`setup-scene-bubble ${isVoice ? 'setup-scene-bubble--voice' : 'setup-scene-bubble--text'}`}
        animate={motionEnabled ? { y: [0, -7, 0], rotateZ: [1, 0, 1] } : {}}
        transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut', delay: .35 }}
        aria-hidden="true"
      >
        {isVoice ? <Mic /> : <FileText />}
        <span>{isVoice ? 'TE ESCUCHO' : 'TU RESPUESTA'}</span>
        {isVoice && <div className="setup-bubble-wave">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>}
      </motion.div>

      {!isVoice && (
        <motion.div
          className="setup-writing-card"
          animate={motionEnabled ? { y: [0, -5, 0], rotateZ: [-3, -1.5, -3], rotateY: [7, 2, 7] } : {}}
          transition={{ duration: 6.2, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        >
          <div className="setup-writing-card-head">
            <span><PenLine /> BORRADOR</span>
            <i>01</i>
          </div>
          <strong>Mi respuesta</strong>
          <small>Una idea clara empieza con...</small>
          <div className="setup-writing-lines"><i /><i /><i /></div>
          <div className="setup-writing-check"><Check /> IDEAS EN ORDEN</div>
        </motion.div>
      )}

      <div className="setup-scene-caption">
        <span className="setup-scene-live-dot" />
        {isVoice ? 'Conversación en tiempo real' : 'Escribe a tu propio ritmo'}
      </div>
    </div>
  );
}

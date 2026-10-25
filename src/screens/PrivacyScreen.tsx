import { ArrowLeft, Database, Mic, ShieldCheck, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';

const sections = [
  {
    icon: Database,
    title: 'Qué guarda la plataforma',
    body: 'El perfil y el historial de práctica se guardan en Supabase y quedan asociados a tu cuenta: área, modo de entrevista, transcripción, respuestas, puntuaciones y comentarios.',
  },
  {
    icon: Sparkles,
    title: 'Cómo se usa la inteligencia artificial',
    body: 'Cuando está habilitada la evaluación, el texto de tu respuesta y el contexto de la pregunta se envían a Google Gemini para generar retroalimentación. La clave se guarda como secreto del servidor y no se expone en el navegador.',
  },
  {
    icon: Mic,
    title: 'Reconocimiento de voz',
    body: 'La voz se convierte en texto mediante el reconocimiento disponible en tu navegador. La plataforma guarda la transcripción, no un archivo de audio; el proveedor del navegador puede aplicar sus propias prácticas de procesamiento.',
  },
];

export default function PrivacyScreen() {
  const privacyContact = import.meta.env.VITE_PRIVACY_CONTACT_EMAIL?.trim();
  const retentionNotice = import.meta.env.VITE_DATA_RETENTION_NOTICE?.trim();

  return (
    <div className="privacy-page scene-bg">
      <header className="privacy-header">
        <BrandLogo />
        <Link to="/dashboard" className="privacy-back"><ArrowLeft className="h-4 w-4" /> Volver a la plataforma</Link>
      </header>

      <motion.main
        className="privacy-content"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .35, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="privacy-title-row">
          <span className="privacy-icon"><ShieldCheck className="h-5 w-5" /></span>
          <p className="section-kicker">Privacidad y uso de IA</p>
        </div>
        <h1>Información clara antes de practicar.</h1>
        <p className="privacy-intro">SimulaEntrevista es una herramienta de práctica. Tus respuestas sirven para recibir comentarios y no se usan para decidir contrataciones.</p>

        <div className="privacy-cards">
          {sections.map(({ icon: Icon, title, body }) => (
            <section className="privacy-card" key={title}>
              <Icon className="h-5 w-5" aria-hidden="true" />
              <div><h2>{title}</h2><p>{body}</p></div>
            </section>
          ))}
        </div>

        <section className="privacy-notice">
          <h2>Consejos para proteger tu información</h2>
          <ul>
            <li>No incluyas contraseñas, datos financieros ni información confidencial de otras personas o empresas.</li>
            <li>Puedes eliminar tus sesiones y respuestas guardadas desde tu perfil. La acción también descarta cualquier sesión que siga abierta.</li>
            <li>Contacto para privacidad: {privacyContact ? <a className="underline" href={`mailto:${privacyContact}`}>{privacyContact}</a> : <strong>pendiente de configurar antes de abrir la plataforma al público.</strong>}</li>
            <li>Conservación de datos: {retentionNotice || <strong>periodo pendiente de definir y configurar antes de abrir la plataforma al público.</strong>}</li>
            <li>Cuando la evaluación con Gemini no está disponible, se muestra una guía local orientativa; esa guía no se presenta como calificación de IA.</li>
          </ul>
        </section>
      </motion.main>
    </div>
  );
}

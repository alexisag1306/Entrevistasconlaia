import { Component, Suspense, lazy, type ErrorInfo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Layout from '@/components/Layout';
import FlowError from '@/components/FlowError';
import LoadingState from '@/components/LoadingState';

const LoginScreen = lazy(() => import('@/screens/LoginScreen'));
const RegisterScreen = lazy(() => import('@/screens/RegisterScreen'));
const DashboardScreen = lazy(() => import('@/screens/DashboardScreen'));
const InterviewSetupScreen = lazy(() => import('@/screens/InterviewSetupScreen'));
const VoiceInterviewScreen = lazy(() => import('@/screens/VoiceInterviewScreen'));
const TextInterviewScreen = lazy(() => import('@/screens/TextInterviewScreen'));
const ProfileScreen = lazy(() => import('@/screens/ProfileScreen'));
const SessionResultsScreen = lazy(() => import('@/screens/SessionResultsScreen'));
const PrivacyScreen = lazy(() => import('@/screens/PrivacyScreen'));

const pageVariants = {
  initial: { opacity: 1, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
};

class RouteErrorBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('No se pudo mostrar esta pantalla.', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
        <FlowError
          icon={AlertCircle}
          eyebrow="Recuperación de pantalla"
          title="Esta vista tuvo un problema"
          description="Tu sesión sigue abierta. Puedes volver al panel o recargar para intentarlo otra vez."
          style={{ margin: 0 }}
        >
          <Link to="/dashboard" className="flow-primary inline-flex items-center justify-center">Volver al inicio</Link>
          <button type="button" onClick={() => window.location.reload()} className="flow-secondary">Recargar</button>
        </FlowError>
      </main>
    );
  }
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate">
      {children}
    </motion.div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <LoadingState label="Revisando tu sesión..." fullScreen />;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <LoadingState label="Revisando tu sesión..." fullScreen />;
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function UnknownRouteRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState label="Revisando tu sesión..." fullScreen />;
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <RouteErrorBoundary key={location.pathname}>
      <Suspense fallback={<LoadingState label="Cargando pantalla..." fullScreen />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/login"              element={<PublicRoute><PageWrapper><LoginScreen /></PageWrapper></PublicRoute>} />
          <Route path="/register"           element={<PublicRoute><PageWrapper><RegisterScreen /></PageWrapper></PublicRoute>} />
          <Route path="/privacy"            element={<PageWrapper><PrivacyScreen /></PageWrapper>} />
          <Route path="/dashboard"          element={<ProtectedRoute><PageWrapper><DashboardScreen /></PageWrapper></ProtectedRoute>} />
          <Route path="/setup/voice"       element={<ProtectedRoute><PageWrapper><InterviewSetupScreen /></PageWrapper></ProtectedRoute>} />
          <Route path="/setup/text"        element={<ProtectedRoute><PageWrapper><InterviewSetupScreen /></PageWrapper></ProtectedRoute>} />
          <Route path="/voice"              element={<ProtectedRoute><PageWrapper><VoiceInterviewScreen /></PageWrapper></ProtectedRoute>} />
          <Route path="/text"               element={<ProtectedRoute><PageWrapper><TextInterviewScreen /></PageWrapper></ProtectedRoute>} />
          <Route path="/profile"            element={<ProtectedRoute><PageWrapper><ProfileScreen /></PageWrapper></ProtectedRoute>} />
          <Route path="/results/:sessionId" element={<ProtectedRoute><PageWrapper><SessionResultsScreen /></PageWrapper></ProtectedRoute>} />
          <Route path="*"                   element={<UnknownRouteRedirect />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

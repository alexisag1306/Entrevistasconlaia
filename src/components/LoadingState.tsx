import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  label: string;
  fullScreen?: boolean;
}

export default function LoadingState({ label, fullScreen = false }: LoadingStateProps) {
  return (
    <div className={`flex ${fullScreen ? 'min-h-screen' : 'min-h-[60vh]'} items-center justify-center`} role="status" aria-live="polite">
      <div className="text-center">
        <Loader2 className="mx-auto mb-3 h-9 w-9 animate-spin text-teal-500" aria-hidden="true" />
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

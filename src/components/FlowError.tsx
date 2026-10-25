import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface FlowErrorProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export default function FlowError({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
  className = 'mx-auto',
  style,
}: FlowErrorProps) {
  return (
    <section className={`flow-error ${className}`.trim()} style={style} role="alert">
      <div className="flow-error-icon"><Icon className="h-5 w-5" aria-hidden="true" /></div>
      <p className="flow-error-kicker">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="flow-error-copy">{description}</p>
      <div className="flow-error-actions">{children}</div>
    </section>
  );
}

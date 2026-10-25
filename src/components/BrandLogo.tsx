import { Link } from 'react-router-dom';

interface BrandLogoProps {
  to?: string;
  className?: string;
}

export default function BrandLogo({ to = '/dashboard', className = '' }: BrandLogoProps) {
  return (
    <Link to={to} className={`brand-lockup ${className}`.trim()} aria-label="SimulaEntrevista, inicio">
      <img className="brand-symbol" src="/brand-mark.svg" alt="" aria-hidden="true" />
      <span className="brand-copy">
        <span className="brand-name block">SimulaEntrevista</span>
        <span className="brand-caption block">ISC · práctica con IA</span>
      </span>
    </Link>
  );
}

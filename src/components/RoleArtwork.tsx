import type { RoleFocus } from '@/types';

const ARTWORK: Record<RoleFocus, { image: string; tag: string; caption: string }> = {
  general: { image: '/images/roles/general.webp', tag: 'FUNDAMENTOS', caption: 'INGENIERÍA · ISC' },
  web: { image: '/images/roles/web.webp', tag: 'WEB / UI', caption: 'DESARROLLO WEB' },
  backend: { image: '/images/roles/backend.webp', tag: 'SERVICIOS', caption: 'BACKEND · API' },
  bd: { image: '/images/roles/database.webp', tag: 'DATOS', caption: 'SQL · MODELADO' },
};

export default function RoleArtwork({ role }: { role: RoleFocus }) {
  const artwork = ARTWORK[role];

  return (
    <div className={`setup-role-art setup-role-art--${role}`} aria-hidden="true">
      <img className="setup-role-photo" src={artwork.image} alt="" loading="eager" decoding="async" />
      <span className="setup-role-photo-shade" />
      <span className="setup-role-art-glow" />
      <span className="setup-role-photo-caption">{artwork.caption}</span>
      <span className="setup-role-art-tag">{artwork.tag}</span>
      <span className="setup-role-photo-orbit" />
    </div>
  );
}

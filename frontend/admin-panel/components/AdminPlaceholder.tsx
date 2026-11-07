import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';

type Tile = { label: string; value: string };

type AdminPlaceholderProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  eyebrow?: string;
  tiles?: Tile[];
  bullets?: string[];
  status?: string;
};

export default function AdminPlaceholder({
  icon: Icon,
  title,
  description,
  eyebrow = 'Workspace module',
  tiles = [],
  bullets = [],
  status = 'Demo shell · wiring pending',
}: AdminPlaceholderProps) {
  return (
    <div className="animate-rise">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="page-heading-actions">
          <span className="chip chip-warning">{status}</span>
        </div>
      </div>

      <div className="grid-3">
        <section className="card card-padding" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <span className="placeholder-icon" aria-hidden>
                <Icon size={22} strokeWidth={1.9} />
              </span>
              <div>
                <h2 className="card-title">Module preview</h2>
                <p className="card-description">
                  This surface is part of the new admin shell. Data wiring and controls will land
                  here without exposing candidate PII.
                </p>
              </div>
            </div>
            <span className="chip">No private PII</span>
          </div>

          {tiles.length > 0 && (
            <div className="placeholder-grid">
              {tiles.map((tile) => (
                <div className="placeholder-tile" key={tile.label}>
                  <span>{tile.label}</span>
                  <b>{tile.value}</b>
                  <div className="skeleton" style={{ width: '72%' }} />
                </div>
              ))}
            </div>
          )}

          {bullets.length > 0 && (
            <ul
              style={{
                display: 'grid',
                gap: 9,
                margin: '20px 0 0',
                padding: 0,
                listStyle: 'none',
              }}
            >
              {bullets.map((bullet) => (
                <li
                  key={bullet}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 9,
                    color: 'rgb(var(--on-surface-variant))',
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                >
                  <ArrowUpRight
                    size={14}
                    style={{ flex: '0 0 14px', marginTop: 2, color: 'rgb(var(--primary))' }}
                  />
                  {bullet}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

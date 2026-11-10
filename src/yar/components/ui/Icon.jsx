import React from 'react';
import { YAR_ICONS, EXTRA_ICONS } from '../../assets/icons';

export function Icon({ name, style, className }) {
  if (!name) return null;
  const phosphorPath = YAR_ICONS[name]?.regular;

  const svg = phosphorPath ? (
    <svg viewBox="0 0 256 256" width="20" height="20" aria-hidden="true">
      <path d={phosphorPath} />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      fill="none"
      style={{
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
    >
      <path d={EXTRA_ICONS[name] || EXTRA_ICONS.layers} />
    </svg>
  );

  return (
    <i aria-hidden="true" className={className} style={{ display: 'inline-flex', fontStyle: 'normal', flexShrink: 0, ...style }}>
      {svg}
    </i>
  );
}

// Direct alias
export function I({ name, style, className }) {
  return <Icon name={name} style={style} className={className} />;
}

export default Icon;

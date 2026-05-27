import { memo } from 'react';

function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        {eyebrow && (
          <p className="uppercase tracking-[0.18em] text-[11px] m-0 text-ink-muted">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-semibold m-0">{title}</h1>
        {description && <p className="text-ink-muted text-sm mt-1 m-0">{description}</p>}
      </div>
      {actions && <div className="flex gap-2.5 items-center">{actions}</div>}
    </header>
  );
}

export default memo(PageHeader);

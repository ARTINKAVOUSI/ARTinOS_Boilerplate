import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';
import type { MetaBlockGroup, MetaBlockInstance } from '../core/types.js';

/**
 * Package-owned body surface for a child MetaBlock.
 *
 * MetaBlock is the single window/dock/panel management system, so everything a panel
 * needs around its content belongs here rather than in each panel:
 *
 *   - scrolling and overflow, so a body never has to invent its own scroll container
 *   - min/preferred size hints published as CSS custom properties
 *   - an optional package-rendered toolbar strip above the content
 *   - empty and error states
 *
 * A panel body stays chrome-free: no title bar, no close button, no drag handle. Those
 * are the group's, and the group is MetaBlock's.
 */

export interface MetaBlockBodyProps {
  block: MetaBlockInstance;
  group: MetaBlockGroup;
  /** Rendered above the scroll area and excluded from it. */
  toolbar?: ReactNode;
  children?: ReactNode;
}

/** Body-level size and scroll hints read off `block.meta`. */
export interface MetaBlockBodyHints {
  scroll?: boolean | 'x' | 'y' | 'both';
  minWidth?: number;
  minHeight?: number;
  preferredWidth?: number;
  preferredHeight?: number;
  pad?: boolean;
}

export function resolveBodyHints(block: MetaBlockInstance): MetaBlockBodyHints {
  const meta = (block.meta ?? {}) as Record<string, unknown>;
  const scroll = meta.scroll as MetaBlockBodyHints['scroll'];
  return {
    // Panels scroll by default; viewports and render surfaces never do.
    scroll: scroll ?? (block.role === 'viewport' || meta.renderSurface === true ? false : 'y'),
    minWidth: Number.isFinite(Number(meta.minWidth)) ? Number(meta.minWidth) : undefined,
    minHeight: Number.isFinite(Number(meta.minHeight)) ? Number(meta.minHeight) : undefined,
    preferredWidth: Number.isFinite(Number(meta.preferredWidth)) ? Number(meta.preferredWidth) : undefined,
    preferredHeight: Number.isFinite(Number(meta.preferredHeight)) ? Number(meta.preferredHeight) : undefined,
    pad: meta.pad !== false && block.role !== 'viewport' && meta.renderSurface !== true,
  };
}

export function MetaBlockBody({ block, group, toolbar, children }: MetaBlockBodyProps) {
  const hints = resolveBodyHints(block);
  const style: Record<string, string> = {};
  if (hints.minWidth != null) style['--mb-body-min-width'] = `${hints.minWidth}px`;
  if (hints.minHeight != null) style['--mb-body-min-height'] = `${hints.minHeight}px`;
  const scroll = hints.scroll === true ? 'both' : hints.scroll === false ? 'none' : hints.scroll ?? 'none';
  return (
    <div className="mb-block-body" data-block-role={block.role} data-pad={hints.pad ? 'true' : 'false'} style={style as never}>
      {toolbar ? <div className="mb-block-toolbar">{toolbar}</div> : null}
      <div className="mb-block-scroll" data-scroll={scroll}>
        <MetaBlockBodyBoundary blockId={block.id} groupId={group.id}>
          {children ?? <MetaBlockEmpty label={block.title} />}
        </MetaBlockBodyBoundary>
      </div>
    </div>
  );
}

export function MetaBlockEmpty({ label, hint }: { label?: string; hint?: string }) {
  return (
    <div className="mb-block-empty" role="status">
      <b>{(label ?? 'EMPTY').toUpperCase()}</b>
      <span>{hint ?? 'NOTHING TO SHOW'}</span>
    </div>
  );
}

/**
 * A body that throws must not take the whole workspace down with it. The rest of the
 * docks keep working and the failed block reports in place.
 */
class MetaBlockBodyBoundary extends Component<PropsWithChildren<{ blockId: string; groupId: string }>, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[MetaBlock] block "${this.props.blockId}" failed to render`, error, info.componentStack);
  }
  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mb-block-error" role="alert">
        <b>BLOCK ERROR</b>
        <span>{this.state.error.message}</span>
        <button type="button" onClick={() => this.setState({ error: null })}>Retry</button>
      </div>
    );
  }
}

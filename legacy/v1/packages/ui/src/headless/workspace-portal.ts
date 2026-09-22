/**
 * Portal target for surfaces that must render above everything (dialogs,
 * palettes, toasts) while still resolving theme roles correctly.
 *
 * `data-theme` lives on `.plate-workspace`, not `<html>` or `<body>` — a
 * portal straight to `document.body` sits outside that scope, so every
 * `var(--role)` it reads falls back to the `:root` (dark) default regardless
 * of the active theme. Portaling into the workspace instead keeps it in the
 * cascade; `position: fixed` still escapes any panel's `overflow: hidden`.
 */
export function workspacePortalTarget(): Element {
  return document.querySelector('.plate-workspace') ?? document.body
}

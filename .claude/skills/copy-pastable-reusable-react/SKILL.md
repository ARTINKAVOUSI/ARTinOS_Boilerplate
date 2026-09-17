---
name: copy-pastable-reusable-react
description: "Build, extract, or refactor self-contained React components whose complete files can be copied into another compatible React project. Use for reusable, portable, copy-paste, or drop-in React components, including interactive effects, visualizations, and 3D scenes. Do not impose this architecture on unrelated app work or an explicitly requested shared library or framework."
---

# Copy-Pastable React Components

Make the component itself the reusable unit. The destination workflow is:

**copy files -> paste into a compatible project -> install listed dependencies -> import -> use**

Apply this across projects and component types without tying the result to the source repository, a particular bundler, or an internal component system. Compatibility means the documented React, language, styling, and runtime requirements are met; do not promise support for every React environment.

## Establish the requested scope before editing

A request for a copy-pastable component authorizes a component deliverable, not a new application or package. Unless the user asks for them, do not create a runnable project, package manifest, bundler configuration, demo page, showcase, control panel, or package publishing setup as part of the deliverable. A dependency installation command and a short usage snippet are sufficient integration instructions.

Before writing files, inspect the relevant source and state a short scope summary: what component behavior will be retained, what the user excluded, and the file or folder that will be delivered. This is an execution checkpoint, not a request for approval. If an inclusion/exclusion is materially ambiguous or contradictory, ask one targeted clarification and continue only the independent, clearly requested work. Do not silently choose the larger scope.

For extraction, classify source code by purpose:

- Requested component behavior: retain it and expose useful customization through props.
- Dependencies needed by that behavior: include them locally or document ordinary external packages.
- Host application and sample content: exclude unless explicitly requested. Being present in the source does not make something a component requirement.

Apply exclusions to implementation files, exports, defaults, documentation examples, and optional features. Do not retain unwanted content merely because it is disabled by default or could be useful later. Conversely, preserve effects, simulation, or decorative content when it is itself the requested component. Treat "clean" or "polished" as refinement of the requested component, not permission to add UI, examples, or features.

## Choose the portable boundary

- For a simple component, prefer one `.tsx` or `.jsx` file, with one accompanying stylesheet when useful.
- For larger components, keep the complete implementation in one isolated folder. Include component-specific hooks, utilities, types, constants, shaders, simulation logic, workers, and assets there as needed.
- Use only the files that keep the implementation understandable. Do not automatically add barrels, separate type and constant files, config files, or a packaging layer.
- When extracting an existing component, preserve its requested behavior and public interface unless the user asks to change them. Inspect its imports, styling, assets, and runtime assumptions before choosing the boundary.

The target shape is what a copy-paste component gallery such as reactbits.dev ships: a single file the reader follows top to bottom, or one folder they drag across whole. Splitting is justified by a file being genuinely hard to follow, never by tidiness. When a split is right, each resulting file should be a part someone would actually open on its own — a shader, a simulation step, a worker — not a fragment that exists only because the main file felt long.

## Remove hidden coupling

Every required dependency must be either inside the portable unit or explicitly identified as a normal external dependency.

- Use relative imports for files within the unit. Avoid source-project aliases and assumptions about the destination folder structure.
- Replace internal stores, app services, routing assumptions, or hidden global state with ordinary props and callbacks where appropriate. Keep component-specific state local.
- Include small component-specific helpers locally instead of importing an internal utility package. Prefer modest duplication to making independent components depend on shared infrastructure.
- Do not create or require a registry, installer, CLI, generator, component pipeline, custom build system, shared UI framework, or custom runtime for portability.
- Do not introduce project-wide configuration or a provider merely to support a reusable-component architecture. If the component genuinely requires a library context or runtime feature, document that requirement and include the minimal usage example. Keep necessary setup local when feasible.
- If the user explicitly requests a demo or host integration, keep it separate from the portable implementation. A component must not import its demo or rely on the demo's providers or styles. Otherwise deliver only a minimal usage snippet, not a demo application.

Normal npm dependencies are allowed when useful. List the packages actually imported and the relevant compatibility requirements. Use the project's package manager when known. Avoid wrapping familiar libraries in custom abstractions without a component-specific need.

## Expose a practical interface

Expose useful customization through normal React props with sensible defaults. Make the smallest valid example work immediately; identify any genuinely required data or callbacks. Do not replace the component API with an extensive configuration system.

Match the user's language and destination constraints. Prefer TypeScript when appropriate, but do not force a TypeScript migration for a JavaScript project. Keep framework-specific features optional where practical; explicitly identify client-only or server-rendering limitations when they apply.

## Keep styling and assets portable

- Ship the styles with the component: local CSS, CSS modules when supported, or inline styles as appropriate.
- Scope plain CSS selectors to the component to avoid affecting the host page. Avoid relying on a global reset, inherited application theme, or undocumented fonts.
- Provide local defaults or fallbacks for CSS variables. Do not silently depend on project-wide design tokens.
- Use Tailwind only when intentionally required by the user or destination. State the styling prerequisite; do not assume classes or custom plugins exist in an arbitrary project.
- Include required local assets or accept explicit asset inputs. Avoid source-project public-directory paths and undocumented remote resources.

## Handle complex interactive components

Particle simulations, fluid effects, animated backgrounds, graph editors, and 3D scenes may need multiple files. Keep those files together as a complete portable unit rather than reconstructing the original application architecture.

Make ownership of canvases, library contexts, workers, and sizing explicit. Clean up subscriptions, animation loops, workers, and allocated resources on unmount. Avoid unintended state sharing between component instances. Document browser or bundler features required by workers or special asset imports instead of silently assuming source-project support.

A React Three Fiber component mounts inside the host's existing `<Canvas>` rather than creating its own, so it can be composed into a scene that already exists. When a standalone version is genuinely useful, keep it a separate optional export and say plainly which one owns a canvas and which one does not.

For graphics and rendering work, default to TSL, then raw WebGPU, then WebGL2, then WebGL — taking the highest of those that gives the best balance of performance, visual quality, and frame rate for the effect. Assume the Three.js WebGPU pipeline with React Three Fiber v10 and drei v11 unless the destination says otherwise; a project pinned to WebGL or to an older renderer overrides this default. Either way the renderer requirement, and any runtime feature detection the component performs, belong in the compatibility notes — a blank canvas in an unsupported browser is the worst failure mode for a pasted component.

Extract shared infrastructure only when the user asks for a shared library or substantial demonstrated reuse justifies it. Preserve a complete copyable unit when portability remains a requirement; do not centralize merely for hypothetical future reuse.

## Verify and deliver

Trace imports, asset references, styling, and runtime context from the component entrypoint. Confirm each requirement travels with the unit or is explicitly documented. Mentally place it in a different compatible React project: no source-repository utilities, aliases, stores, global CSS, or hidden setup should remain.

Use appropriate available checks for the actual change. Prefer existing compatible tooling. When a complex extraction needs a temporary smoke-test host, keep it in a clearly separate temporary location and test only the portable files and declared dependencies. The test host is verification equipment, not a deliverable or justification for adding demo features. Do not modify the source application's setup solely to validate portability. Check relevant interaction and cleanup behavior, and report which checks actually ran.

Before delivering, inspect the actual output tree and import graph against the scope summary:

- Every delivered implementation file must serve requested behavior or a necessary dependency.
- User-excluded content must be absent, including optional exports and examples.
- No unrequested application scaffold, package configuration, or demo may remain in the deliverable.
- The smallest usage example must depend only on the copied files and disclosed libraries/runtime requirements.

Fix a failed check before claiming completion. A successful build does not compensate for the wrong scope. Do not substitute a statement that the result is "portable" for inspecting its files and dependencies.

Deliver:

- The exact file or folder to copy, containing the complete implementation.
- Any dependency installation command and genuine compatibility or styling prerequisites.
- A minimal import-and-render example, including a stylesheet import if required.
- Brief notes on useful props, required inputs, and any remaining limitations.

Completion means the files can be copied into another compatible React project and used directly with the disclosed dependencies. If hidden setup remains, fix it or clearly report the unresolved portability limitation.
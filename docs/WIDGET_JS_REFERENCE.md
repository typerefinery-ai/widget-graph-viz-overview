# Widget Widget Module Reference

The `src/js/widget.js` module is the orchestration layer for the Widget Graph Viz experience. It binds together panel namespaces, drives data-loading strategies, and coordinates parent ↔ iframe communication. This document explains how the module is loaded, how it initializes UI components, and how each function contributes to runtime behavior.

---

## Build-Time Context

- **Bundle inclusion**: Webpack concatenates every file in `src/js/**/*.js` (alphabetical order) into `dist/widget.js`. The resulting bundle is injected into `dist/index.html` via `src/html/_index.html`.
- **Namespace availability**: `_namespace.js` runs earlier in the bundle, ensuring `window.Widgets`, `window.Widgets.Panel`, `window.Widgets.Events`, and `window.Widgets.Notifications` exist before `widget.js` executes.
- **CSS companion**: `src/_index.js` imports `src/sass/custom.scss`, so tooltip and panel styling referenced in `widget.js` is available when the module runs.

---

## Module-Level State

| Symbol | Description |
|--------|-------------|
| `ns.version` | Human-readable version string for the widget module. |
| `ns.selectorComponent` | Attribute selector (`[component="graphviz"]`) used to locate widget roots. |
| `ns.selectorTooltipContainer` | Selector used for tooltip anchoring; defaults to `body`. |
| `ns.listeners` | `Map<string, Listener>` tracking registered postMessage callbacks keyed by `componentId`. |
| `ns.scratch` | Default topic for unattached force-graph requests (`/viz-data/unattached-force-graph`). |
| `_eventListenerRegistered` | Internal guard preventing duplicate `windowListener` registrations. |

---

## Lifecycle Overview

1. **DOM Watch Registration**  
   The module immediately runs an IIFE that calls `componentsNs.watchDOMForComponent(ns.selectorComponent, ns.init)`. This ensures that any DOM node rendered with `component="graphviz"` triggers `ns.init`.

2. **Initialization (`ns.init`)**  
   - Skips re-initialization by marking the component with `data("widget-initialized", true)`.
   - Resolves the theme in `panelUtilsNs` (`light_theme` or `dark_theme`) and prepares a D3 tooltip container.
   - Invokes each panel’s init function (`Tree`, `Filter`, `Promo`, `Scratch`) with shared options.
   - Chooses a data-loading strategy:
     - **Local mode** (`panelTreeNs.isLocalMode()` is `true`): schedules `panelTreeNs.updateTree(defaultType)` to pull fixture-backed JSON.
     - **Widget mode**: calls `ns.requestData()` to raise a `DATA_REQUEST` event to the parent frame.
   - Registers a mouseover listener to hide tooltips while hovering the main component.
   - Delegates parent-driven refresh behavior to `ns.addEventListener`.

3. **Outgoing Data Request Flow**  
   `ns.requestData()` wraps `ns.raiseEventDataRequest(...)`, displaying a loading toast and wiring a callback that:
   - Removes any lingering loading toasts.
  - Emits success or error notifications depending on the payload returned from the parent.
   - Calls `ns.loadData()` when valid data arrives.

4. **Incoming Event Handling**  
   - `ns.addEventListener` registers a single `eventsNs.windowListener` callback (guarded by `_eventListenerRegistered`). When it receives an action of `DATA_REFRESH`, it either loads inline data (`data.data`) or requests fresh data.
   - A global `window.addEventListener("message", …)` listens for simulation controls triggered by the workbench (error, timeout, crash, reload) and surfaces toast notifications or reloads the page.

---

## Core Functions

### `ns.raiseEventDataRequest(eventName, topics, eventAction, id, callbackFn)`

Compiles and dispatches a postMessage payload using `eventsNs.compileEventData`, while ensuring the provided `callbackFn` is stored in `ns.listeners`. Matching logic runs inside a dedicated `eventsNs.windowListener` that compares:

- `eventData.type` or `eventData.topicName`
- The `action` field
- `config.action` (if present)
- `payload.action`

When a match succeeds, the registered callback receives the raw `eventData`.

### `ns.requestData()`

High-level helper that raises a `DATA_REQUEST` for the scratch panel topic. It shows a loading toast, invokes `ns.raiseEventDataRequest`, and handles success/error messaging inside the callback.

### `ns.loadData(data)`

Normalizes inbound data before hydrating downstream panels:

1. Validates the payload and converts tree-shaped objects via `ns.convertTreeToGraph`.
2. Calls `panelUtilsNs.processGraphData(graphData)` to populate shared structures.
3. Triggers `panelPromoNs.simGraph()` → `panelPromoNs.showGraph()` and `panelScratchNs.simGraph()` → `panelScratchNs.showGraph()`.
4. Emits a success toast once the panels are ready.

### `ns.addEventListener($component, componentConfig)`

Registers a single listener for parent-initiated updates:

- Guards against duplicate registration with `_eventListenerRegistered`.
- On `DATA_REFRESH`, either processes inline data (`data.data`) or defers to `ns.requestData`.
- Logs and ignores unrelated events.

### `ns.init($component)`

Entry point executed whenever a DOM node matches the widget selector. Handles:

- Idempotent initialization via `data("widget-initialized")`.
- Theme detection and tooltip setup.
- Panel bootstrapping (`panelTreeNs.init`, `panelFilterNs.init`, `panelPromoNs.init`, `panelScratchNs.init`).
- First data load (local or widget mode).
- Tooltip-hide wiring and event listener registration.

### `ns.convertTreeToGraph(treeData)`

Transforms hierarchical tree data into node/edge arrays. Key behaviors:

- Creates unique node IDs.
- Copies metadata (name, type, icon, description, original).
- Adds `parent-child` edges for each nested relationship.

### `ns.createDefaultGraphData(data)`

Fallback conversion when payloads lack `nodes`/`edges`. Produces:

- A root `default-node` with provided metadata.
- Property nodes for top-level keys (excluding reserved widget properties) with `has-property` edges.

### Global `message` Listener

Handles workbench simulations by switching on `eventData.type`:

- `SIMULATE_ERROR`, `SIMULATE_TIMEOUT`, `SIMULATE_CRASH`: display error toasts.
- `RELOAD_WIDGET`: show info toast and reload the page after 500 ms.

---

## Dependencies

- **`panelUtilsNs`**: Configuration (`options`), theme state, tooltip helpers, notifications, `processGraphData`.
- **`panelTreeNs`**: Local vs widget mode detection, tree updates, DOM selectors.
- **`panelFilterNs`**, **`panelPromoNs`**, **`panelScratchNs`**: Panel-specific initialization and rendering.
- **`eventsNs`**: `compileEventData`, `raiseEvent`, `windowListener`.
- **`componentsNs`**: DOM observation utilities introduced in `_namespace.js`.
- **`d3`**: Tooltip creation and other panel-level D3 operations.
- **`window.Widgets.Notifications`**: Toast lifecycle management.

---

## Related Files

- `src/js/_namespace.js`: Provides the DOM watching utilities consumed by `widget.js`.
- `src/js/panel.*.js`: Individual panel implementations invoked during initialization.
- `docs/TREE_PANEL_MENU_EVENT_FLOW.md`, `docs/PROMO_PANEL_MENU_EVENT_FLOW.md`: Deep dives into panel-specific menu actions.
- `src/html/content.html`: DOM structure searched by `ns.selectorComponent`.
- `src/html/workbench.html`: Sends the simulation postMessages handled by the global listener.

---

## Suggested Follow-Ups

- Consider centralizing toast dismissal logic (currently duplicated in several callbacks).
- Provide teardown helpers for removing tooltips and listeners when the widget is destroyed.
- Expand `ns.listeners` management to clean up unused component IDs after callbacks run.



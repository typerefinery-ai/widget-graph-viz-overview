---
title: Widget.js vs Simulation.js Comparison
description: Architectural and functional comparison between the main widget orchestration module and the legacy simulation module.
---

# Widget.js vs Simulation.js Comparison

This document compares the two JavaScript modules to understand their roles, patterns, and relationship within the Widget Graph Viz codebase.

## Executive Summary

| Aspect | `widget.js` | `simulation.js` |
|--------|-------------|----------------|
| **Status** | ✅ Active - Core orchestration layer | ⚠️ Legacy/Unused - Marked for removal |
| **Purpose** | Coordinate panels, handle data flow, manage parent communication | Standalone D3 force-directed graph visualization |
| **Selector** | `[component="graphviz"]` (exists in HTML) | `#object_form` (does not exist) |
| **Dependencies** | Heavy - 6 panel namespaces + events | Light - Only D3.js and jQuery |
| **Integration** | Central hub - initializes all panels | Isolated - no integration with other modules |
| **Data Source** | Dynamic - parent app or local API | Static - hardcoded JSON file path |

## Purpose & Role

### widget.js - Orchestration Layer

**Primary Responsibilities**:
1. **Panel Coordination**: Initializes and coordinates all panel modules (Tree, Filter, Promo, Scratch)
2. **Data Flow Management**: Routes data between panels and handles format conversions
3. **Parent Communication**: Manages postMessage events with parent application
4. **Mode Detection**: Handles local vs widget mode differences
5. **Lifecycle Management**: Controls initialization sequence and event listeners

**Architecture Pattern**: Facade/Orchestrator pattern - provides unified interface to multiple subsystems

### simulation.js - Standalone Visualization

**Primary Responsibilities**:
1. **Graph Rendering**: Creates D3 force-directed graph visualization
2. **Force Simulation**: Configures and runs D3 physics simulation
3. **Interactive Elements**: Handles node dragging, tooltips, zoom
4. **Data Loading**: Loads static JSON file and renders graph

**Architecture Pattern**: Self-contained module - no dependencies on other widget modules

## Code Structure Comparison

### Module Pattern

**Both modules use the same IIFE pattern**:

```javascript
// widget.js
(function($, ns, componentsNs, eventsNs, d3, panelUtilsNs, ...) {
    // Implementation
})(window.jQuery, window.Widgets.Widget, ...);

// simulation.js  
(function($, ns, d3, document, window) {
    // Implementation
})(window.jQuery, window.Widgets.Simulation, window.d3, ...);
```

**Key Difference**: `widget.js` has 10+ dependencies injected, `simulation.js` has only 4.

### Initialization Pattern

**Both use DOM watcher pattern**:

```javascript
// widget.js (line 485)
componentsNs.watchDOMForComponent(`[component="graphviz"]`, ns.init);

// simulation.js (line 272)
componentsNs.watchDOMForComponent(`#object_form`, ns.init);
```

**Key Difference**: `widget.js` selector exists and is active, `simulation.js` selector doesn't exist.

## Dependencies Comparison

### widget.js Dependencies

```javascript
// Injected dependencies (line 6):
- jQuery ($)
- Widgets.Widget namespace (ns)
- Widgets namespace (componentsNs) - for DOM watching
- Widgets.Events (eventsNs) - for postMessage communication
- D3.js (d3) - for tooltip creation only
- Widgets.Panel.Utils (panelUtilsNs) - shared utilities
- Widgets.Panel.Filter (panelFilterNs) - filter panel
- Widgets.Panel.Tree (panelTreeNs) - tree panel
- Widgets.Panel.Promo (panelPromoNs) - promo panel
- Widgets.Panel.Scratch (panelScratchNs) - scratch panel
- document, window
```

**Total**: 12 dependencies

### simulation.js Dependencies

```javascript
// Injected dependencies (line 4):
- jQuery ($)
- Widgets.Simulation namespace (ns)
- D3.js (d3) - for force simulation and SVG rendering
- document, window
```

**Total**: 4 dependencies

**Key Insight**: `simulation.js` is much more self-contained and could theoretically work standalone.

## Data Handling Comparison

### widget.js Data Flow

```
Parent App / Local API
    ↓
requestData() / loadTreeDataFromAPI()
    ↓
raiseEventDataRequest() / direct API call
    ↓
loadData(data)
    ↓
Data format detection & conversion
    ↓
Distribute to panels:
  - panelUtilsNs.processGraphData()
  - panelPromoNs.simGraph() + showGraph()
  - panelScratchNs.simGraph() + showGraph()
```

**Characteristics**:
- **Dynamic**: Data comes from parent or API
- **Multi-format**: Handles tree, graph, and unknown formats
- **Distributed**: Sends data to multiple panels
- **Transformative**: Converts tree → graph when needed

### simulation.js Data Flow

```
Hardcoded file path (config.dataFile)
    ↓
d3.json() fetch
    ↓
loadFromData($component, data)
    ↓
Direct D3 rendering:
  - Create SVG elements
  - Configure force simulation
  - Render nodes and edges
```

**Characteristics**:
- **Static**: Hardcoded file path
- **Single-format**: Expects `{nodes, edges}` structure
- **Self-contained**: Renders directly, no distribution
- **No transformation**: Assumes correct format

## Function Comparison

### Shared Concepts

Both modules have similar function categories:

| Category | widget.js | simulation.js |
|----------|-----------|---------------|
| **Initialization** | `ns.init($component)` | `ns.init($component)` |
| **Data Loading** | `ns.loadData(data)` | `ns.loadFromData($component, data)` |
| **Force Simulation** | ❌ None | ✅ `ns.forceSimulation(width, height)` |
| **Event Handling** | ✅ `ns.addEventListener()` | ❌ None |
| **Parent Communication** | ✅ `ns.raiseEventDataRequest()` | ❌ None |
| **Data Conversion** | ✅ `ns.convertTreeToGraph()` | ❌ None |
| **Utility Functions** | ❌ None | ✅ `ns.syntaxHighlight()` |

### Key Functional Differences

#### widget.js Unique Functions

1. **`raiseEventDataRequest()`**: Manages parent communication with callback tracking
2. **`requestData()`**: Requests data from parent application
3. **`loadData()`**: Multi-format data handler with conversion logic
4. **`addEventListener()`**: Listens for parent events (DATA_REFRESH, etc.)
5. **`convertTreeToGraph()`**: Transforms tree structure to graph format
6. **`createDefaultGraphData()`**: Fallback data structure creator

#### simulation.js Unique Functions

1. **`forceSimulation()`**: Creates and configures D3 force simulation
2. **`loadFromData()`**: Renders complete force-directed graph
3. **`syntaxHighlight()`**: JSON syntax highlighting utility

## Integration Points

### widget.js Integration

**Integrates with**:
- ✅ `panel.tree.js` - Tree visualization
- ✅ `panel.filter.js` - Data filtering
- ✅ `panel.promo.js` - Promo graph panel
- ✅ `panel.scratch.js` - Scratch graph panel
- ✅ `panel._utils.js` - Shared utilities
- ✅ `#events.js` - Event system
- ✅ `_namespace.js` - DOM watching

**Called by**: None (entry point via DOM watcher)

**Calls**: All panel modules during initialization

### simulation.js Integration

**Integrates with**: None

**Called by**: None (selector doesn't exist, so never called)

**Calls**: None (self-contained)

## Configuration Comparison

### widget.js Configuration

```javascript
// No internal config object
// Uses panelUtilsNs.options for shared configuration
// Mode detection via URL parameter (?local=true)
```

**Configuration Source**: External (panel utilities, URL params)

### simulation.js Configuration

```javascript
ns.config = {
    prefix: "https://raw.githubusercontent.com/...",
    dataFile: "data/n_and_e.json",
    shape: "rect-",
    margin: { top: 30, right: 80, bottom: 30, left: 30 },
    with: 1200,  // ⚠️ Typo: should be "width"
    radius: 50,
    height: 1000
}
```

**Configuration Source**: Internal (hardcoded object)

**Issues**: 
- Typo: `with` should be `width`
- Hardcoded paths (not configurable)
- No environment-based configuration

## D3.js Usage Comparison

### widget.js D3 Usage

**Minimal D3 usage**:
- Creates tooltip element: `d3.select("body").append("div")`
- Sets tooltip styles
- **No force simulation**
- **No SVG rendering**

**Purpose**: UI enhancement only (tooltips)

### simulation.js D3 Usage

**Heavy D3 usage**:
- Force simulation: `d3.forceSimulation()`
- Force types: Link, Charge, Center
- SVG rendering: Nodes, edges, labels, markers
- Interactions: Drag, zoom, tooltips
- Event handling: `simulation.on("tick")`

**Purpose**: Core visualization engine

## Event Handling Comparison

### widget.js Events

**Event Types**:
- `DATA_REQUEST` - Request data from parent
- `DATA_REFRESH` - Refresh data from parent
- `SIMULATE_ERROR` - Testing/debugging
- `SIMULATE_TIMEOUT` - Testing/debugging
- `SIMULATE_CRASH` - Testing/debugging
- `RELOAD_WIDGET` - Reload widget

**Event Sources**:
- Parent application (via postMessage)
- Internal widget actions

**Event Management**:
- Listener Map for callback tracking
- Event registration/deregistration
- Component ID-based routing

### simulation.js Events

**Event Types**:
- D3 simulation tick events
- Mouse events (hover, drag, move)
- Zoom events

**Event Sources**:
- D3 force simulation
- User interactions

**Event Management**:
- Direct D3 event handlers
- No external event system

## Data Format Handling

### widget.js Format Support

**Supports**:
1. **Graph format**: `{nodes: [], edges: []}`
2. **Tree format**: `{children: [], ...}` (converts to graph)
3. **Unknown format**: Creates default graph structure

**Conversion Logic**:
```javascript
if (!graphData.nodes || !graphData.edges) {
    if (graphData.children && Array.isArray(graphData.children)) {
        graphData = ns.convertTreeToGraph(graphData);
    } else {
        graphData = ns.createDefaultGraphData(graphData);
    }
}
```

### simulation.js Format Support

**Supports**:
1. **Graph format only**: `{nodes: [], edges: []}`

**No Conversion**: Assumes correct format, will fail if data structure differs

## Similarities

1. **Same Module Pattern**: Both use IIFE with dependency injection
2. **Same Initialization**: Both use `componentsNs.watchDOMForComponent()`
3. **Same Namespace Pattern**: Both extend `window.Widgets.*`
4. **Both Use D3**: Though for different purposes
5. **Both Use jQuery**: For DOM manipulation
6. **Both Have `init()` Function**: Component initialization pattern
7. **Both Handle Data Loading**: Though from different sources

## Key Differences

| Aspect | widget.js | simulation.js |
|--------|-----------|---------------|
| **Complexity** | High (orchestration) | Medium (visualization) |
| **Dependencies** | 12 dependencies | 4 dependencies |
| **Integration** | Central hub | Isolated |
| **Data Source** | Dynamic (parent/API) | Static (file) |
| **Format Support** | Multi-format with conversion | Single format |
| **Event System** | Custom postMessage system | D3 native events |
| **Status** | Active and used | Legacy/unused |
| **Selector** | Exists in HTML | Missing from HTML |
| **Force Simulation** | None (delegates to panels) | Direct implementation |
| **Panel Coordination** | Yes (4 panels) | No |

## Why simulation.js Exists

**Historical Context**: Likely an early prototype or standalone example that:
1. Demonstrated D3 force-directed graph capabilities
2. Was replaced by panel-based architecture (`panel.scratch.js`, `panel.promo.js`)
3. Never fully integrated into widget system
4. Left in codebase but marked for removal

## Migration Path (If Needed)

If `simulation.js` functionality is needed:

1. **Extract force simulation logic** → Move to `panel._utils.js` as shared utility
2. **Extract rendering logic** → Already exists in `panel.scratch.js` and `panel.promo.js`
3. **Remove module** → Delete file, remove from webpack bundle
4. **Update documentation** → Remove references

**Recommendation**: Safe to remove - functionality already exists in panel modules.

## Conclusion

**widget.js** is the **active orchestration layer** that coordinates the entire widget system, handles data flow, and manages parent communication. It's essential to the application.

**simulation.js** is a **legacy standalone module** that demonstrates D3 force simulation but is not integrated into the widget system. It's marked for removal and can be safely deleted.

The modules serve completely different purposes:
- `widget.js`: **System coordination** (high-level)
- `simulation.js`: **Visualization implementation** (low-level, but unused)

---

**Related Documentation**:
- [WIDGET_JS_REFERENCE.md](./WIDGET_JS_REFERENCE.md) - Detailed widget.js documentation
- [SIMULATION_JS_REFERENCE.md](./SIMULATION_JS_REFERENCE.md) - Detailed simulation.js documentation


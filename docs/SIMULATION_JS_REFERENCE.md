---
title: Simulation Module Reference
description: Documentation for the D3.js force-directed graph simulation module (legacy/unused).
---

# Simulation Module Reference

The `src/js/simulation.js` module provides a D3.js force-directed graph visualization implementation. **Note: This module appears to be legacy/unused code**—it contains a TODO comment indicating it should be removed, and the selector it watches for (`#object_form`) does not exist in the current HTML templates.

## Module Status

⚠️ **Legacy/Unused**: This module is marked for removal (see line 3: `//TODO: remove as not required`). The selector `#object_form` it watches for does not exist in the current codebase.

## Namespace

- **Root**: `window.Widgets.Simulation`
- **Selector**: `#object_form` (not present in current HTML)

## Module Structure

The module is organized into two IIFE blocks:

1. **Core Implementation** (lines 4-267): Defines simulation logic, D3 force setup, and data loading
2. **DOM Watcher** (lines 269-274): Registers the component for automatic initialization

## Configuration

```javascript
ns.config = {
    prefix: "https://raw.githubusercontent.com/os-threat/images/main/img/",
    dataFile: "data/n_and_e.json",
    shape: "rect-",
    margin: { top: 30, right: 80, bottom: 30, left: 30 },
    with: 1200,  // Note: typo - should be "width"
    radius: 50,
    height: 1000
}
```

### Configuration Properties

- **`prefix`**: Base URL for node icon images
- **`dataFile`**: Path to JSON data file (relative to page)
- **`shape`**: Icon shape prefix (`rect-`, `norm-`, `rnd-`)
- **`margin`**: SVG margins (top, right, bottom, left)
- **`with`**: ⚠️ Typo - should be `width` (SVG width)
- **`radius`**: Default node radius
- **`height`**: SVG height

## Core Functions

### `ns.forceSimulation(width, height)`

Creates and configures a D3 force simulation with three forces:

1. **Link Force**: Connects nodes via edges
   - Uses node `id` property for identification
2. **Charge Force**: Repulsion between nodes
   - Strength: `-500` (negative = repulsion)
3. **Center Force**: Attracts nodes to center
   - Position: `(width/2, height/2)`

**Returns**: Configured `d3.forceSimulation()` instance

### `ns.loadFromData($component, data)`

Renders a force-directed graph from node/edge data.

**Parameters**:
- `$component`: jQuery-wrapped container element
- `data`: Object with `nodes` and `edges` arrays

**Process**:

1. **Link Rendering**:
   - Creates SVG `<line>` elements for edges
   - Applies arrowhead markers (`marker-end`)
   - Sets stroke width (0.75) and color (grey)

2. **Edge Paths**:
   - Creates invisible `<path>` elements for edge labels
   - Used as reference for text positioning

3. **Edge Labels**:
   - Renders text along edge paths using `<textPath>`
   - Displays `edge.label` property
   - Styled with 18px font, #aaa color

4. **Node Rendering**:
   - Creates `<image>` elements for each node
   - Icon source: `{prefix}{shape}{icon}.svg`
   - Size: `radius + 5` (default 55px)
   - Hover effects: scales to 70px on mouseover

5. **Interactions**:
   - **Tooltip**: Shows node data on hover (syntax-highlighted JSON)
   - **Drag**: Enables node dragging with force simulation
   - **Simulation Tick**: Updates positions on each tick

**Force Configuration**:
- Link distance: `4 * radius` (200px default)
- Drag behavior: Restarts simulation with alpha 0.3
- Fixed positions: Nodes are fixed during drag (`fx`, `fy`)

### `ns.syntaxHighlight(json)`

Converts JSON to syntax-highlighted HTML.

**Parameters**:
- `json`: JSON object or string

**Returns**: HTML string with CSS classes:
- `key`: Object keys
- `string`: String values
- `number`: Numeric values
- `boolean`: true/false values
- `null`: null values

**Process**:
1. Converts object to JSON string if needed
2. Escapes HTML entities (`<`, `>`, `&`)
3. Wraps tokens in `<span>` elements with appropriate classes

### `ns.init($component)`

Initializes the simulation component.

**Parameters**:
- `$component`: jQuery-wrapped container element

**Process**:

1. **Force Simulation Setup**:
   - Creates simulation with container dimensions
   - Stores in `ns.simulation`

2. **SVG Creation**:
   - Appends `<svg>` to container
   - Adds transform group with margin offset
   - Sets dimensions from container

3. **Tooltip Reference**:
   - ⚠️ **Bug**: References `window.Widgets.widjets.tooltip` (typo: `widjets` should be `widgets`)
   - Should reference `window.Widgets.Widget.tooltip` or similar

4. **Arrowhead Marker**:
   - Creates SVG `<marker>` for edge arrows
   - ViewBox: `-0 -5 10 10`
   - Path: `M 0,-5 L 10 ,0 L 0,5` (triangle)
   - Color: `#999`

5. **Zoom Handler**:
   - Configures D3 zoom behavior
   - Applies transform to SVG group on zoom

6. **Data Loading**:
   - Loads JSON from `ns.config.dataFile`
   - Calls `ns.loadFromData()` on success

## Data Structure

### Expected Input Format

```javascript
{
    nodes: [
        {
            id: "node-1",
            icon: "software",
            name: "Software",
            // ... other properties
        }
    ],
    edges: [
        {
            source: "node-1",  // or node object
            target: "node-2",  // or node object
            label: "connects to"
        }
    ]
}
```

### Node Properties

- **`id`**: Unique identifier (required for force simulation)
- **`icon`**: Icon name (used in image URL)
- **`name`**: Display name
- **Additional**: Any properties are preserved and shown in tooltip

### Edge Properties

- **`source`**: Source node ID or object
- **`target`**: Target node ID or object
- **`label`**: Text displayed along edge path

## D3 Force Simulation Properties

After simulation runs, nodes receive these properties:

- **`index`**: Zero-based index in nodes array
- **`x`**: Current x-position
- **`y`**: Current y-position
- **`vx`**: Current x-velocity
- **`vy`**: Current y-velocity
- **`fx`**: Fixed x-position (null = free, set during drag)
- **`fy`**: Fixed y-position (null = free, set during drag)

## Known Issues

1. **TODO Comment**: Module marked for removal (line 3)
2. **Missing Selector**: `#object_form` does not exist in HTML
3. **Typo in Config**: `with` should be `width` (line 17)
4. **Tooltip Reference Bug**: `window.Widgets.widjets.tooltip` typo (line 230)
5. **Unused Module**: No evidence of this module being used in current codebase

## Dependencies

- **jQuery**: DOM manipulation and element selection
- **D3.js v6/v7**: Force simulation, SVG rendering, drag behavior, zoom
- **window.Widgets**: Namespace system (for tooltip reference)

## Related Modules

- **`panel.scratch.js`**: Uses similar force-directed graph visualization
- **`panel.promo.js`**: Uses similar force-directed graph visualization
- **`widget.js`**: Main orchestration layer (does not reference this module)

## Removal Considerations

If removing this module:

1. Verify no HTML templates reference `#object_form`
2. Check for any dynamic creation of elements with this ID
3. Remove from webpack bundle (currently included via `src/js/**/*.js`)
4. Consider if functionality should be preserved in `panel.scratch.js` or `panel.promo.js`

## Example Usage (If Module Were Active)

```html
<div id="object_form"></div>
```

```javascript
// Module auto-initializes when #object_form appears in DOM
// Loads data from config.dataFile and renders force-directed graph
```

---

**Status**: Legacy/Unused - Marked for removal  
**Last Reviewed**: 2025-01-XX  
**Related Issues**: None (consider creating removal task)


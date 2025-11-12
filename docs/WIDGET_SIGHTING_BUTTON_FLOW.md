# Widget Sighting Button - Complete Function Execution Flow

## Overview
This document traces the **EXACT** function execution path when a user clicks the "Sighting" button in the widget's filter panel, from the initial click event to the final data rendering.

## HTML Structure
```html
<input type="radio" class="btn-check" name="vbtn-radio2" id="sighting" value="sighting" autocomplete="off" checked />
<label class="btn btn-outline-warning" for="sighting">Sighting</label>
```

## Complete Function Execution Flowchart

```mermaid
graph TD
    A[User clicks "Sighting" radio button] --> B[panel.filter.js: filter.change event]
    B --> C[panel.filter.js: filterChange function]
    C --> D[panel.tree.js: updateTree function]
    
    D --> E{Check Widget Mode}
    
    E -->|Local Mode ?local=true| F[panel.tree.js: loadTreeDataFromAPI]
    E -->|Widget Mode| G[panel.tree.js: loadTreeDataFromParent]
    
    %% Local Mode Path
    F --> F1[panel.tree.js: showLoadingState]
    F1 --> F2[panel._utils.js: showNotification loading]
    F2 --> F3[fetch API request to: https://flow.typerefinery.localhost:8101/viz-data/tree-sighting]
    F3 --> F4{API Response}
    F4 -->|Success| F5[panel.tree.js: loadData function]
    F4 -->|Error| F6[panel.tree.js: showErrorMessage]
    
    %% Widget Mode Path
    G --> G1[panel._utils.js: showNotification loading]
    G1 --> G2[widget.js: raiseEventDataRequest]
    G2 --> G3[events.js: compileEventData]
    G3 --> G4[events.js: raiseEvent]
    G4 --> G5[window.parent.postMessage]
    G5 --> G6[Workbench receives postMessage]
    G6 --> G7[Workbench sends DATA_REFRESH response]
    G7 --> G8[widget.js: windowListener callback]
    G8 --> G9[panel.tree.js: loadData function]
    
    %% Common Data Processing Path
    F5 --> H[panel.tree.js: loadData function]
    G9 --> H
    
    H --> I[Clear existing SVG content]
    I --> J[Create new SVG root group]
    J --> K[Create link lines group]
    K --> L[Create nodes group]
    L --> M[d3.hierarchy create tree structure]
    M --> N[Process node hierarchy]
    N --> O[panel.tree.js: drawTree function]
    
    O --> P[Create D3 tree layout]
    P --> Q[Position nodes and links]
    Q --> R[Create SVG elements for nodes]
    R --> S[Create SVG elements for links]
    S --> T[Apply transitions and animations]
    T --> U[Final tree visualization rendered]
    
    %% Error Handling
    F6 --> V[panel._utils.js: showNotification error]
    V --> W[Display error message in tree panel]
```

## Detailed Function Call Sequence

### 1. Initial Click Event (panel.filter.js)
```javascript
// Event: Radio button change
$filter_options.on('change', function (d) {
    let filterValue = this.value; // "sighting"
    let type = window.Widgets.Panel.Utils.options.tree_data[filterValue]; // "sighting"
    window.Widgets.Panel.Filter.filterChange(type);
});
```

### 2. Filter Change Handler (panel.filter.js)
```javascript
ns.filterChange = function(type) {
    // type = "sighting"
    window.Widgets.Panel.Tree.updateTree(type);
}
```

### 3. Tree Update Function (panel.tree.js)
```javascript
ns.updateTree = function(type) {
    // type = "sighting"
    const isLocal = ns.isLocalMode(); // Check URL for ?local=true
    
    if (isLocal) {
        ns.loadTreeDataFromAPI(type);
    } else {
        ns.loadTreeDataFromParent(type);
    }
}
```

### 4A. Local Mode Path (panel.tree.js)
```javascript
ns.loadTreeDataFromAPI = function(type) {
    // type = "sighting"
    const apiConfig = panelUtilsNs.options.api;
    const fullUrl = apiConfig.baseUrl + apiConfig.endpoints.tree + type;
    // URL: https://flow.typerefinery.localhost:8101/viz-data/tree-sighting
    
    fetch(fullUrl)
        .then(response => response.json())
        .then(data => {
            ns.loadData(data); // Process API response
        })
        .catch(error => {
            ns.showErrorMessage("Failed to load tree data");
        });
}
```

### 4B. Widget Mode Path (panel.tree.js → widget.js → events.js)
```javascript
// panel.tree.js
ns.loadTreeDataFromParent = function(type) {
    const eventName = `embed-viz-event-payload-data-tree-${type}`;
    // eventName = "embed-viz-event-payload-data-tree-sighting"
    
    window.Widgets.Widget.raiseEventDataRequest(
        eventName, 
        [eventName], 
        "load_data", 
        type, 
        callbackFunction
    );
}

// widget.js
ns.raiseEventDataRequest = function(eventName, topics, eventAction, id, callbackFn) {
    const componentId = `${id}-${eventName}-${eventAction}`;
    const payload = { action: eventAction, id: id, type: 'load' };
    
    const eventCompileData = eventsNs.compileEventData(
        payload, eventName, "DATA_REQUEST", componentId, config
    );
    
    eventsNs.raiseEvent(eventName, eventCompileData);
}

// events.js
ns.raiseEvent = function(eventName, data) {
    if (window.parent) {
        window.parent.postMessage(JSON.stringify(data), "*");
    }
}
```

### 5. Data Processing (panel.tree.js)
```javascript
ns.loadData = function(data) {
    // data = API response or parent response
    ns.data = data;
    
    // Clear existing visualization
    ns.tree_svg.selectAll("*").remove();
    
    // Create new SVG structure
    ns.tree_svg_root = ns.tree_svg.append('g');
    ns.gLink = ns.tree_svg_root.append('g');
    ns.gNode = ns.tree_svg_root.append('g');
    
    // Create D3 hierarchy
    ns.root = d3.hierarchy(ns.data);
    
    // Process node structure
    ns.root.descendants().forEach((d, i) => {
        d.id = i;
        d._children = d.children;
        if (d.depth && d.data.name.length !== 7) d.children = null;
    });
    
    // Draw the tree
    ns.drawTree();
}
```

### 6. Tree Drawing (panel.tree.js)
```javascript
ns.drawTree = function(reset) {
    // Create D3 tree layout
    ns.tree(ns.root);
    
    // Position nodes
    ns.root.eachBefore(function (n) {
        n.x = ++index * ns.options.lineSpacing;
        n.y = n.depth * ns.options.indentSpacing;
    });
    
    // Create SVG elements for nodes
    const node = ns.gNode.selectAll('g').data(nodes, (d) => d.id);
    const nodeEnter = node.enter().append('g');
    
    // Add node components (checkbox, icon, label)
    nodeEnter.append('rect'); // Checkbox
    nodeEnter.append('text'); // Plus/minus symbol
    nodeEnter.append('image'); // Icon
    nodeEnter.append('text'); // Label text
    
    // Create SVG elements for links
    const link = ns.gLink.selectAll('path').data(links, (d) => d.target.id);
    const linkEnter = link.enter().append('path');
    
    // Apply transitions
    const transition = ns.tree_svg.transition().duration(ns.options.duration);
    
    // Final tree visualization is rendered
}
```

## Key Data Flow Points

### 1. Mode Detection
- **Local Mode**: URL contains `?local=true`
- **Widget Mode**: No local parameter, communicates via postMessage

### 2. Data Sources
- **Local Mode**: Direct API call to `https://flow.typerefinery.localhost:8101/viz-data/tree-sighting`
- **Widget Mode**: Parent application sends data via postMessage

### 3. Event Communication (Widget Mode)
- **Widget → Parent**: `window.parent.postMessage()` with event data
- **Parent → Widget**: `window.addEventListener("message")` receives response
- **Event Format**: JSON with `type`, `payload`, `action`, `componentId`, `config`, `target`

### 4. Data Processing
- **Input**: Raw API/parent data
- **Processing**: `d3.hierarchy()` creates tree structure
- **Output**: Interactive SVG tree visualization

### 5. Error Handling
- **API Errors**: Show error message in tree panel
- **Network Errors**: Retry mechanism with exponential backoff
- **Data Errors**: Graceful degradation with error notifications

## Function Dependencies

### Core Dependencies
- **jQuery**: DOM manipulation and event handling
- **D3.js**: Data visualization and tree layout
- **panel._utils.js**: Shared utilities and API configuration
- **events.js**: PostMessage communication system

### Namespace Dependencies
- `window.Widgets.Panel.Filter`: Filter panel functionality
- `window.Widgets.Panel.Tree`: Tree visualization logic
- `window.Widgets.Widget`: Main widget coordination
- `window.Widgets.Events`: Event communication system

## Performance Considerations

### Loading States
- Show loading notification during data fetch
- Display loading overlay in tree panel
- Hide loading states on completion/error

### Error Recovery
- Retry failed API requests (local mode)
- Graceful error display
- Fallback to cached data if available

### Memory Management
- Clear existing SVG content before redrawing
- Remove event listeners on component destruction
- Clean up D3 selections and transitions 
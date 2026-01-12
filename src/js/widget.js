//define namespace for your JS file
//window.Widgets = {};  //  already defined in _namespace.js
window.Widgets.Widget = {};

// Main visualization module - force-directed graph using D3
(function($, ns, componentsNs, eventsNs, d3, document, window) {
    ns.version = '1.0.0';

    ns.selectorComponent = '[component="graphviz"]';

    // Data URL for event-based data loading
    ns.dataUrl = '/viz-data/overview-default-incident';
    ns.eventName = 'embed-viz-event-payload-data-overview-default-incident';

    ns.config = {
        prefix: "https://raw.githubusercontent.com/os-threat/images/main/img/",
        shape: "rect-", //norm-, rnd-,
        margin: {
            top: 30,
            right: 80,
            bottom: 30,
            left: 30
        },
        width: 1200,
        iconSize: 35,  // Reduced to 70% of original (50) for better spacing
        height: 1000,
        edgeFontSize: 12,
        edgeFontFamily: 'Arial, sans-serif',
        theme: {
            treeFill: 'white',
            scratchFill: 'blanchedalmond',
            promoFill: 'ivory',
            svgName: 'black',
            svgBorder: 'black',
            checkColour: 'gray',
            checkText: 'white',
            select: 'yellow',
            edges: 'black',
            tooltip: {
                fill: 'white', 
                stroke: '1px', 
                scolour: 'black', 
                corner: 5, 
                tcolour: 'black', 
                tsize: '11px', 
                padding: '5px',
                maxwidth: '900px',
                overflow: 'auto'
            },
        },
        // API Configuration for Local Mode
        api: {
            // Local mode loads from local files, production uses events only
            // No baseUrl needed - local mode uses file:// URLs or relative paths
            endpoints: {
                graph: "/viz-data/overview-default-incident"
            },
            timeout: 10000, // 10 seconds
            retryAttempts: 3
        },
        // Notification Configuration
        notifications: {
            enabled: true,
            duration: 5000,
            gravity: "top", // top, bottom
            position: "right", // left, center, right
            maxQueueSize: 10,
            showLoadingStates: true,
            showSuccessMessages: true,
            showErrorMessages: true,
            showWarningMessages: true,
            showInfoMessages: true
        }
    }

    // Track selected node
    ns.selectedNode = null;

    // Track listeners for event callbacks
    ns.listeners = new Map();

    /**
     * Check if running in local mode
     * @returns {boolean} True if local mode (?local=true in URL)
     */
    ns.isLocalMode = function() {
        return window.location.search.includes("local=true");
    }

    /**
     * Request data from parent application via postMessage
     */
    ns.requestData = function() {
        console.group(`widget requestData on ${window.location}`);
        
        const eventName = ns.eventName;
        const topics = [eventName];
        const eventAction = "load_data";
        const id = "overview-default-incident";
        const componentId = `${id}-${eventName}-${eventAction}`;
        
        const payload = {
            action: eventAction,
            id: id,
            type: 'load',
            endpoint: ns.dataUrl
        };
        const config = "";
        
        console.log("Requesting data via event:", eventName, payload);
        
        const eventCompileData = eventsNs.compileEventData(
            payload, 
            eventName, 
            "DATA_REQUEST", 
            componentId, 
            config
        );
        
        // Register callback for response
        if (!ns.listeners.has(componentId)) {
            const $component = $(ns.selectorComponent);
            ns.listeners.set(componentId, {
                componentId: componentId,
                eventAction: eventAction,
                topics: topics,
                eventName: eventName,
                id: id,
                callbackFn: function(eventData) {
                    console.log("Data received from parent:", eventData);
                    const $currentComponent = $(ns.selectorComponent);
                    if (eventData && eventData.data) {
                        ns.loadFromData($currentComponent, eventData.data);
                    } else if (eventData && eventData.error) {
                        console.error("Error loading data:", eventData.error);
                    }
                }
            });
            
            // Listen for parent response
            eventsNs.windowListener((eventData) => {
                const dataEventName = eventData.type || eventData.topicName;
                const { type, topicName, payload, action, componentId: eventComponentId } = eventData;
                
                const eventMatch = dataEventName === eventName || 
                                 topics.includes(dataEventName) || 
                                 action === eventAction;
                
                if (eventMatch && ns.listeners.has(componentId)) {
                    ns.listeners.get(componentId).callbackFn(eventData);
                }
            });
        }
        
        // Raise event to parent
        eventsNs.raiseEvent(eventName, eventCompileData);
        console.groupEnd();
    }

    /**
     * Load data from local API endpoint
     */
    ns.loadDataFromAPI = function() {
        console.group(`widget loadDataFromAPI on ${window.location}`);
        
        const apiBaseUrl = "http://localhost:8111";
        const fullUrl = apiBaseUrl + ns.dataUrl;
        
        console.log("Loading data from API:", fullUrl);
        
        fetch(fullUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log("Data loaded from API:", data);
                const $component = $(ns.selectorComponent);
                if ($component.length) {
                    ns.loadFromData($component, data);
                } else {
                    console.error("Component not found:", ns.selectorComponent);
                }
            })
            .catch(error => {
                console.error("Error loading data from API:", error);
            })
            .finally(() => {
                console.groupEnd();
            });
    }

    /**
     * Clear all visualization data without reloading
     * Removes all nodes, links, edge paths, and edge labels
     * Stops the simulation and clears simulation data
     * Keeps SVG structure (defs, arrowhead markers) intact
     */
    ns.clearData = function() {
        console.group(`widget clearData on ${window.location}`);
        
        const $component = $(ns.selectorComponent);
        if (!$component.length) {
            console.warn("Component not found:", ns.selectorComponent);
            console.groupEnd();
            return;
        }
        
        // Stop and clear the simulation first (before removing DOM elements)
        if (ns.simulation) {
            console.log("Stopping simulation");
            ns.simulation.stop();
            // Clear all nodes and links from simulation
            ns.simulation.nodes([]);
            if (ns.simulation.force("link")) {
                ns.simulation.force("link").links([]);
            }
            // Reset alpha to 0 to ensure it's stopped
            ns.simulation.alpha(0);
            // Remove tick event handler
            ns.simulation.on("tick", null);
        }
        
        let container = $component.get(0);
        let rootSvg = d3.select(container).select("svg");
        
        if (rootSvg.empty()) {
            console.warn("SVG not found in component");
            console.groupEnd();
            return;
        }
        
        // Get the g element (the one with transform) - this is where all visualization elements are
        let g = rootSvg.select("g");
        
        if (g.empty()) {
            console.warn("g element not found in SVG - structure may be broken");
            console.groupEnd();
            return;
        }
        
        // Remove all visualization elements from the g element
        // Remove links (line elements)
        g.selectAll(".links").remove();
        g.selectAll("line.links").remove();
        
        // Remove edge paths (path elements)
        g.selectAll(".edgepath").remove();
        g.selectAll("path.edgepath").remove();
        
        // Remove edge labels (text elements with textPath children)
        g.selectAll(".edgelabel").remove();
        g.selectAll("text.edgelabel").remove();
        g.selectAll("textPath").remove(); // Remove textPath elements too
        
        // Remove nodes (g element containing image elements)
        g.selectAll(".nodes").remove();
        g.selectAll("g.nodes").remove();
        
        // Clear any data bound to remaining elements (but keep defs and g structure)
        g.selectAll("line, path, text, g.nodes").data([]);
        
        // Hide tooltip if visible
        if (ns.tooltip) {
            ns.tooltip.style("opacity", 0);
        }
        
        console.log("Data and visualization cleared - all nodes, links, and labels removed");
        console.groupEnd();
    }

    ns.reload = function() {
        console.group(`widget reload on ${window.location}`);
        
        // Clear existing nodes, links, and labels (but keep SVG structure)
        const $component = $(ns.selectorComponent);
        if ($component.length) {
            const svg = d3.select($component.get(0)).select("svg");
            if (!svg.empty()) {
                const g = svg.select("g");
                if (!g.empty()) {
                    // Remove only visualization elements, keep defs (arrowhead marker)
                    g.selectAll(".links").remove();
                    g.selectAll(".edgepath").remove();
                    g.selectAll(".edgelabel").remove();
                    g.selectAll(".nodes").remove();
                }
            }
            
            // Stop existing simulation
            if (ns.simulation) {
                ns.simulation.stop();
            }
        }
        
        // Reload data based on mode
        if (ns.isLocalMode()) {
            console.log("Reloading in local mode");
            ns.loadDataFromAPI();
        } else {
            console.log("Reloading in widget mode");
            ns.requestData();
        }
        
        console.groupEnd();
    }

    /**
     * Calculate the intersection point of a line from center to target with the node shape
     * @param {number} angle - The angle in radians from source to target
     * @param {number} iconSize - The iconSize of the node
     * @param {string} shape - The shape type (rect-, norm-, rnd-)
     * @returns {object} - Object with x and y offsets from center to edge
     */
    ns.calculateShapeIntersection = function(angle, iconSize, shape) {
        // For circular shapes (norm-, rnd-), use fixed iconSize
        if (shape === "norm-" || shape === "rnd-") {
            return {
                x: iconSize * Math.cos(angle),
                y: iconSize * Math.sin(angle)
            };
        }
        
        // For rectangular shapes (rect-), calculate intersection with rectangle edges
        // Rectangle has width and height = 2 * iconSize, centered at origin
        const rectHalfWidth = iconSize;
        const rectHalfHeight = iconSize;
        
        // Calculate potential intersection points
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        
        // Avoid division by zero
        const absDx = Math.abs(dx) < 0.0001 ? 0.0001 : Math.abs(dx);
        const absDy = Math.abs(dy) < 0.0001 ? 0.0001 : Math.abs(dy);
        
        // Distance to vertical edge (left or right)
        const tVertical = rectHalfWidth / absDx;
        
        // Distance to horizontal edge (top or bottom)
        const tHorizontal = rectHalfHeight / absDy;
        
        // Use the smaller distance (closer intersection)
        const t = Math.min(tVertical, tHorizontal);
        
        return {
            x: t * dx,
            y: t * dy
        };
    }

    ns.syntaxHighlight = function(json) {
        if (typeof json != 'string') {
             json = JSON.stringify(json, undefined, 2);
        }
        if (!json || json === 'undefined') {
            return "";
        }
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            var cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }

    //create a simulation for an array of nodes, and compose the desired forces.
    ns.forceSimulation = function(width, height) {
        return d3.forceSimulation()
            .force("link", d3.forceLink() // This force provides links between nodes
                            .id(d => d.id) // This sets the node id accessor to the specified function. If not specified, will default to the index of a node.
            ) 
            .force("charge", d3.forceManyBody().strength(-500)) // This adds repulsion (if it's negative) between nodes.
            .force("center", d3.forceCenter(width / 2, height / 2)) // This force attracts nodes to the center of the svg area
            .force("collision", d3.forceCollide().radius(ns.config.iconSize * 1.5)) // Prevent node overlap with collision detection
            .force("x", d3.forceX(width / 2).strength(0.05)) // Keep nodes within horizontal bounds
            .force("y", d3.forceY(height / 2).strength(0.05)); // Keep nodes within vertical bounds
    }

    ns.loadFromData = function($component, data) {

        console.group(`widget loadFromData on ${window.location}`);

        let container = $component.get(0)

        // Get the g element inside svg (the one with transform) - this is where elements are added
        let svg = d3.select(container)
            .select("svg")
            .select("g")

        // Initialize the links
        let link = svg.selectAll(".links")
            .data(data.edges)
            .join("line")
            .attr("class", "links")
            .attr("source", (d) => d.source)
            .attr("target", (d) => d.target)
            .attr("stroke-width", 0.75)
            .attr("stroke", ns.config.theme.edges)
            .style("pointer-events", "none")
            .style("user-select", "none")
            .attr('marker-end','url(#arrowhead)'); //The marker-end attribute defines the arrowhead or polymarker that will be drawn at the final vertex of the given shape.

        let edgepaths = svg.selectAll(".edgepath") //make path go along with the link provide position for link labels
            .data(data.edges)
            .join('path')
            .attr('class', 'edgepath')
            .attr('fill-opacity', 0)
            .attr('stroke-opacity', 0)
            .attr('id', function (d, i) {return 'edgepath' + i})
            .style("pointer-events", "none")
            .style("user-select", "none");

        const edgelabels = svg.selectAll(".edgelabel")
            .data(data.edges)
            .join('text')
            .style("pointer-events", "none")
            .style("user-select", "none")
            .attr('class', 'edgelabel')
            .attr('id', function (d, i) {return 'edgelabel' + i})
            .attr('font-size', 12)
            .attr('font-family', 'Arial, sans-serif')
            .attr('font-weight', '500')
            .attr('fill', '#666');


        edgelabels.append('textPath') //To render text along the shape of a <path>, enclose the text in a <textPath> element that has an href attribute with a reference to the <path> element.
            .attr('xlink:href', function (d, i) {return '#edgepath' + i})
            .style("text-anchor", "middle")
            .style("pointer-events", "none")
            .style("user-select", "none")
            .attr("startOffset", "50%")
            .attr("dy", -2)  // Lift text 2 pixels above the edge line
            .text(d => d.name);

        // Initialize the nodes
        // add hover over effect
        const node = svg.append("g")
            .attr("class", "nodes")
            .selectAll("image")
            .data(data.nodes)
            .join("image")
            .attr("xlink:href",  function(d) { return (ns.config.prefix + ns.config.shape + d.icon + ".svg");})
            .attr("width",  ns.config.iconSize)
            .attr("height", ns.config.iconSize)
            .attr("class", "node-image")
            // .on("mouseover", function(d){
            //     d3.select(this)
            //         .transition()
            //         .duration(350)
            //         .attr("width",  ns.config.iconSize * 1.4)
            //         .attr("height", ns.config.iconSize * 1.4)
            // })
            // .on("mouseout", function(d){
            //     // Don't shrink if this is the selected node
            //     const datum = d3.select(this).datum();
            //     if (ns.selectedNode && ns.selectedNode.id === datum.id) {
            //         return;
            //     }
            //     d3.select(this)
            //         .transition()
            //         .duration(350)
            //         .attr("width",  ns.config.iconSize)
            //         .attr("height", ns.config.iconSize)
            // })
            .on("click", function(event, d) {
                event.stopPropagation();
                const clickedNode = d3.select(this).datum();
                
                // Clear previous selection
                svg.selectAll(".node-image")
                    .style("filter", null)
                    .style("stroke", null)
                    .style("stroke-width", null);
                
                // If clicking the same node, deselect it
                if (ns.selectedNode && ns.selectedNode.id === clickedNode.id) {
                    ns.selectedNode = null;
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr("width", ns.config.iconSize)
                        .attr("height", ns.config.iconSize);
                } else {
                    // Select the new node
                    ns.selectedNode = clickedNode;
                    d3.select(this)
                        .style("filter", "drop-shadow(0 0 8px rgba(0, 123, 255, 0.8))")
                        .style("stroke", "#007bff")
                        .style("stroke-width", "3px")
                        .transition()
                        .duration(200)
                        .attr("width", ns.config.iconSize * 1.2)
                        .attr("height", ns.config.iconSize * 1.2);
                }
                console.log("Node selected:", ns.selectedNode);
            })
            .on("dblclick", function(event, d) {
                event.stopPropagation();
                const datum = d3.select(this).datum();
                
                // Unfix the node on double-click
                datum.fx = null;
                datum.fy = null;
                
                // Restart simulation to allow the node to move
                ns.simulation.alpha(0.3).restart();
                
                console.log("Node unfixed:", datum.id);
            })
            .on('mouseover.tooltip', function(event, d) {
                console.log("mouseover.tooltip ", event);
                var x = event.clientX;
                var y = event.clientY;
                
                console.log("x ", x, " y ", y);
                ns.tooltip.transition()
                    .duration(300)
                    .style("opacity", .8);
                ns.tooltip.html("<pre>"+ns.syntaxHighlight(d3.select(this).datum()) +"</pre>")
                    .style("left", (x) + "px")
                    .style("top", (y + 10) + "px")
                    .style("opacity", .8);
                })
            .on("mouseout.tooltip", function(event) {
                console.log("mouseout.tooltip");
                ns.tooltip.transition()
                    .duration(100)
                    .style("opacity", 0);
                })
            .on("mousemove", function(event, d) {
                console.log("mousemove", event);
                var x = event.clientX;
                var y = event.clientY;

                console.log("x ", x, " y ", y);
                ns.tooltip.style("left", x + "px")
                    .style("top", (y + 10) + "px");
                })
            .call(d3.drag()  //sets the event listener for the specified typenames and returns the drag behavior.
                .on("start", function(event, d) {
                    if (!event.active) {
                        ns.simulation.alphaTarget(0.3).restart();//sets the current target alpha to the specified number in the range [0,1].
                    }
                    d.fy = d.y; //fx - the node's fixed x-position. Original is null.
                    d.fx = d.x; //fy - the node's fixed y-position. Original is null.
                }) //start - after a new pointer becomes active (on mousedown or touchstart).
                .on("drag", function(event, d) {
                    d.fx = event.x;
                    d.fy = event.y;
                })      //drag - after an active pointer moves (on mousemove or touchmove).
                .on("end", function(event, d) {
                    if (!event.active) {
                        ns.simulation.alphaTarget(0);
                    }
                    // Keep nodes fixed in position after dragging
                    // They can be unfixed by double-clicking
                    // fx and fy remain set, keeping the node in place
                    console.log("Node fixed at position:", d.id, d.fx, d.fy);
                })     //end - after an active pointer becomes inactive (on mouseup, touchend or touchcancel).
            );

        //Listen for tick events to render the nodes as they update in your Canvas or SVG.
        ns.simulation
            .nodes(data.nodes) //sets the simulation's nodes to the specified array of objects, initializing their positions and velocities, and then re-initializes any bound forces;
            .on("tick", function() {
                link.attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);

                node.attr("x", d => d.x - ns.config.iconSize/2)
                    .attr("y", d => d.y - ns.config.iconSize/2);

                edgepaths.attr('d', d => {
                    // Calculate angle from source to target
                    const dx = d.target.x - d.source.x;
                    const dy = d.target.y - d.source.y;
                    const angle = Math.atan2(dy, dx);
                    
                    // Calculate intersection with target node shape
                    const intersection = ns.calculateShapeIntersection(angle, ns.config.iconSize, ns.config.shape);
                    
                    // Calculate the end point of the edge (at the target node's edge)
                    const targetX = d.target.x - intersection.x;
                    const targetY = d.target.y - intersection.y;
                    
                    return 'M ' + d.source.x + ' ' + d.source.y + ' L ' + targetX + ' ' + targetY;
                });
            })

        ns.simulation.force("link")
            .links(data.edges)
            .distance(function() {return 4 * ns.config.iconSize;});

        // Restart the simulation if it was stopped (e.g., after clear)
        if (ns.simulation.alpha() === 0) {
            console.log("Restarting simulation after data load");
            ns.simulation.alpha(1).restart();
        } else {
            // Ensure simulation is running
            ns.simulation.restart();
        }
        
        console.groupEnd();
    }


    ns.init = function($component) {
        console.group(`widget init on ${window.location}`);
        
        // Prevent multiple initializations
        if ($component.data("widget-initialized")) {
            console.log("Widget already initialized, skipping.");
            console.groupEnd();
            return;
        }
        $component.data("widget-initialized", true);
        
        console.log($component);

        // Get container dimensions
        const width = $component.width() || ns.config.width;
        const height = $component.height() || ns.config.height;

        //init d3 force simulation
        ns.simulation = ns.forceSimulation(width, height);

        let container = $component.get(0)

        //create svg
        let svg = d3.select(container)
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", "translate(" + ns.config.margin.left + "," + ns.config.margin.top + ")");

        //create tooltip - create new one if doesn't exist
        if (!window.Widgets.Widget.tooltip) {
            ns.tooltip = d3.select("body")
                .append("div")
                .attr('class', 'tooltip')
                .attr('id', 'widget-tooltip')
                .style('display', 'block')
                .style("position", "absolute")
                .style("z-index", "10")
                .style("background-color", "white")
                .style("border", "solid")
                .style("border-width", "1px")
                .style("border-color", "black")
                .style("border-iconSize", "5px")
                .style("padding", "5px")
                .style("max-width", "900px")
                .style("overflow-x", "auto")
                .style('opacity', 0);
            window.Widgets.Widget.tooltip = ns.tooltip;
        } else {
            ns.tooltip = window.Widgets.Widget.tooltip;
        }

        console.log("ns.tooltip", ns.tooltip);

        //create arrowhead marker
        let arrowhead = svg.append('defs').append('marker')
            .attr("id",'arrowhead')
            .attr('viewBox','-0 -5 10 10')
            .attr('refX', ns.config.iconSize * 1.25)
            .attr('refY',0)
            .attr('orient','auto')
            .attr('markerWidth',10)
            .attr('markerHeight',10)
            .attr('xoverflow','visible')
            .append('svg:path')
            .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
            .attr('fill', '#999')
            .style('stroke','none');

        //create zoom handler - apply to parent SVG, transform the g element
        const parentSvg = d3.select(container).select("svg");
        const initialTransform = `translate(${ns.config.margin.left},${ns.config.margin.top})`;
        var zoom_handler = d3.zoom()
            .scaleExtent([0.1, 10])  // Allow zoom from 10% to 1000%
            .on("zoom", function(event){
                // Combine zoom transform with initial margin translate
                svg.attr("transform", `${initialTransform} ${event.transform}`);
            });

        // Apply zoom to the parent SVG element, not the g element
        zoom_handler(parentSvg);
        
        // Add click handler to SVG to deselect nodes when clicking on empty space
        parentSvg.on("click", function() {
            if (ns.selectedNode) {
                ns.selectedNode = null;
                svg.selectAll(".node-image")
                    .style("filter", null)
                    .style("stroke", null)
                    .style("stroke-width", null)
                    .transition()
                    .duration(200)
                    .attr("width", ns.config.iconSize)
                    .attr("height", ns.config.iconSize);
            }
        });

        // Set up event listener for DATA_REFRESH and CLEAR_DATA
        eventsNs.windowListener((eventData) => {
            console.group(`widget windowListener on ${window.location}`);
            try {
                const { type, payload, action, componentId, config } = eventData;
                
                if (action === "DATA_REFRESH") {
                    console.log("DATA_REFRESH received, reloading data");
                    ns.reload();
                } else if (action === "CLEAR_DATA") {
                    console.log("CLEAR_DATA received, clearing visualization");
                    ns.clearData();
                }
            } catch (error) {
                console.error("Error in widget windowListener", error);
            } finally {
                console.groupEnd();
            }
        });

        // Load data based on mode
        if (ns.isLocalMode()) {
            console.log("Local mode detected, loading from API");
            ns.loadDataFromAPI();
        } else {
            console.log("Widget mode detected, requesting data from parent");
            ns.requestData();
        }
        
        console.groupEnd();
    }

})(
    window.jQuery, 
    window.Widgets.Widget, 
    window.Widgets, 
    window.Widgets.Events, 
    window.d3, 
    document, 
    window
);

//define your behaviour how will this component will be added to DOM.
(function($, ns, componentsNs, document, window) {
    
    //watch for the component to be added to DOM
    componentsNs.watchDOMForComponent(`${ns.selectorComponent}`, ns.init);

})(window.jQuery, window.Widgets.Widget, window.Widgets, document, window);

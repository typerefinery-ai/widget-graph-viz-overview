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
        radius: 50,
        height: 1000
    }

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
        let svg = d3.select(container).select("svg");
        
        if (svg.empty()) {
            console.warn("SVG not found in component");
            console.groupEnd();
            return;
        }
        
        // Get the g element (the one with transform) - elements might be in root svg or in g
        let g = svg.select("g");
        
        // Remove all visualization elements from both svg and g
        // Remove links (line elements)
        svg.selectAll(".links").remove();
        svg.selectAll("line.links").remove();
        if (!g.empty()) {
            g.selectAll(".links").remove();
            g.selectAll("line.links").remove();
        }
        
        // Remove edge paths (path elements)
        svg.selectAll(".edgepath").remove();
        svg.selectAll("path.edgepath").remove();
        if (!g.empty()) {
            g.selectAll(".edgepath").remove();
            g.selectAll("path.edgepath").remove();
        }
        
        // Remove edge labels (text elements with textPath children)
        svg.selectAll(".edgelabel").remove();
        svg.selectAll("text.edgelabel").remove();
        svg.selectAll("textPath").remove(); // Remove textPath elements too
        if (!g.empty()) {
            g.selectAll(".edgelabel").remove();
            g.selectAll("text.edgelabel").remove();
            g.selectAll("textPath").remove();
        }
        
        // Remove nodes (g element containing image elements)
        svg.selectAll(".nodes").remove();
        svg.selectAll("g.nodes").remove();
        svg.selectAll("g.nodes image").remove(); // Also remove images directly
        if (!g.empty()) {
            g.selectAll(".nodes").remove();
            g.selectAll("g.nodes").remove();
            g.selectAll("g.nodes image").remove();
        }
        
        // Clear any data bound to remaining elements
        svg.selectAll("*").data([]);
        if (!g.empty()) {
            g.selectAll("*").data([]);
        }
        
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
            .force("center", d3.forceCenter(width / 2, height / 2)); // This force attracts nodes to the center of the svg area
    }

    ns.loadFromData = function($component, data) {

        console.group(`widget loadFromData on ${window.location}`);

        let container = $component.get(0)

        let svg = d3.select(container)
            .select("svg")

        // Initialize the links
        let link = svg.selectAll(".links")
            .data(data.edges)
            .join("line")
            .attr("class", "links")
            .attr("source", (d) => d.source)
            .attr("target", (d) => d.target)
            .attr("stroke-width", 0.75)
            .attr("stroke", "grey")
            .attr('marker-end','url(#arrowhead)'); //The marker-end attribute defines the arrowhead or polymarker that will be drawn at the final vertex of the given shape.

        let edgepaths = svg.selectAll(".edgepath") //make path go along with the link provide position for link labels
                .data(data.edges)
                .join('path')
                .attr('class', 'edgepath')
                .attr('fill-opacity', 0)
                .attr('stroke-opacity', 0)
                .attr('id', function (d, i) {return 'edgepath' + i})
                .style("pointer-events", "none");

        const edgelabels = svg.selectAll(".edgelabel")
            .data(data.edges)
            .join('text')
            .style("pointer-events", "none")
            .attr('class', 'edgelabel')
            .attr('id', function (d, i) {return 'edgelabel' + i})
            .attr('font-size', 18)
            .attr('fill', '#aaa');


        edgelabels.append('textPath') //To render text along the shape of a <path>, enclose the text in a <textPath> element that has an href attribute with a reference to the <path> element.
            .attr('xlink:href', function (d, i) {return '#edgepath' + i})
            .style("text-anchor", "middle")
            .style("pointer-events", "none")
            .attr("startOffset", "50%")
            .text(d => d.label);

        // Initialize the nodes
        // add hover over effect
        const node = svg.append("g")
            .attr("class", "nodes")
            .selectAll("image")
            .data(data.nodes)
            .join("image")
            .attr("xlink:href",  function(d) { return (ns.config.prefix + ns.config.shape + d.icon + ".svg");})
            .attr("width",  function(d) { return ns.config.radius + 5;})
            .attr("height", function(d) { return ns.config.radius + 5;})
            .on("mouseover", function(d){d3.select(this)
                                        .transition()
                                        .duration(350)
                                        .attr("width",  70)
                                        .attr("height", 70)
                                    })
            .on("mouseout", function(d){d3.select(this)
                                        .transition()
                                        .duration(350)
                                        .attr("width",  function(d) { return ns.config.radius;})
                                        .attr("height", function(d) { return ns.config.radius;})
                                    })
            .on('mouseover.tooltip', function(d) {
                console.log("mouseover.tooltip ", d3.event);
                var x = d.clientX; // $(this).attr("x");
                var y = d.clientY; //$(this).attr("y");
                
                console.log("x ", x, " y ", y);
                ns.tooltip.transition()
                    .duration(300)
                    .style("opacity", .8);
                ns.tooltip.html("<pre>"+ns.syntaxHighlight(d3.select(this).datum()) +"</pre>")
                    .style("left", (x) + "px")
                    .style("top", (y + 10) + "px")
                    .style("opacity", .8);
                })
            .on("mouseout.tooltip", function() {
                console.log("mouseout.tooltip");
                ns.tooltip.transition()
                    .duration(100)
                    .style("opacity", 0);
                })
            .on("mousemove", function(e) {
                console.log("mousemove", e);
                var x = e.clientX; // $(this).attr("x");
                var y = e.clientY; //$(this).attr("y");

                console.log("x ", x, " y ", y);
                ns.tooltip.style("left", x + "px")
                    .style("top", (y + 10) + "px");
                })
            .call(d3.drag()  //sets the event listener for the specified typenames and returns the drag behavior.
                .on("start", function(d) {
                    if (!d3.event.active) {
                        ns.simulation.alphaTarget(0.3).restart();//sets the current target alpha to the specified number in the range [0,1].
                    }
                    d.fy = d.y; //fx - the node's fixed x-position. Original is null.
                    d.fx = d.x; //fy - the node's fixed y-position. Original is null.
                }) //start - after a new pointer becomes active (on mousedown or touchstart).
                .on("drag", function(d) {
                    d.fx = d3.event.x;
                    d.fy = d3.event.y;
                })      //drag - after an active pointer moves (on mousemove or touchmove).
                .on("end", function(d) {
                    if (!d3.event.active) {
                        ns.simulation.alphaTarget(0);
                    }
                    d.fx = null;
                    d.fy = null;
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

                node.attr("x", d => d.x - ns.config.radius/2)
                    .attr("y", d => d.y - ns.config.radius/2);

                edgepaths.attr('d', d => 'M ' + d.source.x + ' ' + d.source.y + ' L ' + d.target.x + ' ' + d.target.y);
            })

        ns.simulation.force("link")
            .links(data.edges)
            .distance(function() {return 4 * ns.config.radius;});

        
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
                .style("border-radius", "5px")
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
            .attr('refX', ns.config.radius * 1.25)
            .attr('refY',0)
            .attr('orient','auto')
            .attr('markerWidth',10)
            .attr('markerHeight',10)
            .attr('xoverflow','visible')
            .append('svg:path')
            .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
            .attr('fill', '#999')
            .style('stroke','none');

        //create zoom handler 
        var zoom_handler = d3.zoom()
        .on("zoom", function(){
            svg.attr("transform", d3.event.transform);
        });

        zoom_handler(svg);

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

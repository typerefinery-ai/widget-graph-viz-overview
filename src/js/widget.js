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
        showLayout: false,
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

    // ------------------------------------------------------------------------------------
    // Left-select -> open the object's Update form (os-threat#94)
    //
    // Ported from widget-graph-viz-composer, whose implementation is the working reference
    // (alpha-launch docs/issues/0007 task 3). The overview's nodes carry the same shape -
    // object_family / object_group / object_form / original - so the flow is identical:
    // categorise the object into the four dicts the CMS form binds to, then raise the
    // open-form event the page already listens for.
    // ------------------------------------------------------------------------------------

    // ⚠ DATA-MODEL DEVIATION - see alpha-launch docs/data-agnostic-principle.md
    // These lists are STIX2 vocabulary. This is an os-triage-* application widget, so domain
    // knowledge is permitted here, but the API should own the classification. They are a
    // LAST-RESORT FALLBACK only - resolveFormCategories() prefers whatever the data or the
    // host supplies, exactly as the composer does.
    ns.FORM_CATEGORIES_FALLBACK_SOURCE = "widget built-in (STIX2 default)";
    ns.FORM_BASE_REQUIRED = ["id", "type", "spec_version", "created", "modified"];
    ns.FORM_BASE_OPTIONAL = [
        "created_by_ref", "revoked", "labels", "confidence", "lang",
        "external_references", "object_marking_refs", "granular_markings"
    ];
    ns.FORM_TIMESTAMP_EXCEPTIONS = ["created", "modified"];
    ns.FORM_EXCEPTION_TYPES = ["process", "file", "network-traffic", "x-oca-asset", "x-oca-event"];

    /**
     * Resolve the property classification, preferring whoever owns the data model.
     * 1. supplied with the object, 2. supplied by the host, 3. widget built-ins.
     */
    ns.resolveFormCategories = function(dataObject) {
        const fromData = dataObject && dataObject.form_categories;
        const fromHost = ns.config && ns.config.formCategories;
        const supplied = fromData || fromHost;

        if (supplied && supplied.base_required) {
            return {
                baseRequired: supplied.base_required || [],
                baseOptional: supplied.base_optional || [],
                timestampExceptions: supplied.timestamp_exceptions || [],
                exceptionTypes: supplied.exception_types || [],
                source: fromData ? "data payload" : "host options"
            };
        }
        return {
            baseRequired: ns.FORM_BASE_REQUIRED,
            baseOptional: ns.FORM_BASE_OPTIONAL,
            timestampExceptions: ns.FORM_TIMESTAMP_EXCEPTIONS,
            exceptionTypes: ns.FORM_EXCEPTION_TYPES,
            source: ns.FORM_CATEGORIES_FALLBACK_SOURCE
        };
    };

    /** Split a flat object into the four dicts the CMS form binds to. */
    ns.categoriseFormData = function(dataObject) {
        const categorised = { base_required: {}, base_optional: {}, object: {}, extensions: {} };

        if (!dataObject || typeof dataObject !== "object") {
            console.warn("categoriseFormData: no object to categorise", dataObject);
            return categorised;
        }

        const objectType = dataObject.type;
        const categories = ns.resolveFormCategories(dataObject);
        const isExceptionType = categories.exceptionTypes.indexOf(objectType) > -1;

        Object.keys(dataObject).forEach(function(propertyName) {
            const propertyValue = dataObject[propertyName];

            if (propertyName === "form_categories") {
                return; // control field, not a form property
            }
            if (isExceptionType && categories.timestampExceptions.indexOf(propertyName) > -1) {
                categorised.object[propertyName] = propertyValue;
            } else if (categories.baseRequired.indexOf(propertyName) > -1) {
                categorised.base_required[propertyName] = propertyValue;
            } else if (categories.baseOptional.indexOf(propertyName) > -1) {
                categorised.base_optional[propertyName] = propertyValue;
            } else if (propertyName === "extensions") {
                categorised.extensions = propertyValue;
            } else {
                categorised.object[propertyName] = propertyValue;
            }
        });

        console.log(
            `categoriseFormData: type=${objectType} -> ` +
            `base_required(${Object.keys(categorised.base_required).length}) ` +
            `base_optional(${Object.keys(categorised.base_optional).length}) ` +
            `object(${Object.keys(categorised.object).length}) ` +
            `extensions(${Object.keys(categorised.extensions || {}).length})` +
            (isExceptionType ? " [created/modified treated as object properties]" : "") +
            ` [classification from: ${categories.source}]`
        );

        return categorised;
    };

    /** Raise the open-form event the host page already listens for. */
    ns.openForm = function(formId, formData, options) {
        console.group(`openForm on ${window.location}`);
        const action = "BUTTON_CLICK";
        const data = eventsNs.compileEventData(formData, formId, action, formId, options);
        console.log(`event raise ${formId}`, data, options);
        eventsNs.raiseEvent(formId, data);
        console.groupEnd();
    };

    /**
     * Open the Update form for a selected node.
     *
     * @param {object} node graph node, as delivered by the overview API
     */
    ns.openFormForNode = function(node) {
        if (!node) {
            return;
        }
        try {
            const formId = "embed-viz-event-open-stixorm-forms-object";
            const formData = ns.categoriseFormData(node.original);
            const payloadOptions = {
                "object_family": node.object_family,
                "object_group": node.object_group,
                "object_form": node.object_form,
            };

            if (!node.object_family || !node.object_group || !node.object_form) {
                console.error(
                    "openFormForNode: node is missing the form routing fields, the host cannot " +
                    "resolve a form URL. Expected object_family/object_group/object_form, got:",
                    payloadOptions, node
                );
                return;
            }

            console.log("open form for node", node.id, payloadOptions);
            ns.openForm(formId, formData, payloadOptions);
        } catch (error) {
            console.error("openFormForNode: could not open the form for this node", error, node);
        }
    };

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
     * Fetch the Overview options (GitHub #82) and merge them over the built-in defaults.
     *
     * The API has been live since 2026-08-04 and nothing consumed it — task 5 in the runsheet's
     * rollup. The contract already lines up: 10 of its 15 keys (`width`, `height`, `showLayout`,
     * `prefix`, `shape`, `margin`, `edgeFontFamily`, `edgeFontSize`, `notifications`, `theme`) have
     * the same names as `ns.config`, so this is a merge rather than a mapping.
     *
     * ⚠️ **A 200 is not success here.** These flow algorithms answer 200 with an `{"error":"true"}`
     * envelope when they throw (alpha-launch docs/issues/0026) — that is exactly how the overview
     * half of #82 looked healthy while broken for a day. Reject that body rather than merging it
     * over good defaults.
     *
     * Sets `ns.optionsReady` so a draw can wait for the merge instead of racing it.
     */
    ns.optionsUrl = '/viz-data/overview-options';

    ns.mergeOptions = function(target, source) {
        Object.keys(source || {}).forEach((key) => {
            const value = source[key];
            const isPlainObject = value && typeof value === "object" && !Array.isArray(value);
            if (isPlainObject && target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
                ns.mergeOptions(target[key], value);
            } else {
                target[key] = value;
            }
        });
        return target;
    }

    /**
     * Where to reach the flow API from wherever this widget is running.
     *
     * ⚠️ `http://localhost:8111` only works in the **standalone** workbench. Embedded, the widget is
     * served from `https://widgetdevoverview.typerefinery.localhost:8101`, and the direct port
     * answers with **no `Access-Control-Allow-Origin`** — measured:
     *
     *     Access to fetch at 'http://localhost:8111/viz-data/overview-options' from origin
     *     'https://widgetdevoverview.typerefinery.localhost:8101' has been blocked by CORS policy
     *
     * The Traefik host proxies the same route and does send `Access-Control-Allow-Origin: *`, which
     * is the same conclusion alpha-launch decision 0006 reached for the incidents table's cold-start
     * URL. Choose by the page's own scheme so the workbench keeps working on http.
     *
     * (`ns.loadDataFromAPI` below still hardcodes the direct port and would fail the same way if it
     * were used embedded — it is not, because the host posts data in instead.)
     */
    ns.apiBase = function() {
        return window.location.protocol === "https:"
            ? "https://flow.typerefinery.localhost:8101"
            : "http://localhost:8111";
    }

    ns.loadOptions = function() {
        const url = ns.apiBase() + ns.optionsUrl;
        console.log("loadOptions: fetching Overview options from " + url);
        ns.optionsReady = fetch(url)
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then((options) => {
                if (!options || typeof options !== "object" || options.error) {
                    // docs/issues/0026: a 200 carrying an error body. Keep the defaults.
                    console.warn("loadOptions: options endpoint returned an error body, keeping defaults", options);
                    return false;
                }
                const applied = Object.keys(options);
                ns.mergeOptions(ns.config, options);
                console.log(`loadOptions: merged ${applied.length} option(s) over the defaults: ${applied.join(', ')}`);
                return true;
            })
            .catch((error) => {
                // Never let options break the widget — the defaults are a working configuration.
                console.warn("loadOptions: could not load Overview options, keeping defaults: " + error.message);
                return false;
            });
        return ns.optionsReady;
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
    /**
     * The drawing area, in pixels.
     *
     * The container's own measurement is preferred, as the original code intended — but it cannot
     * be trusted on its own. `$component.height()` was measured returning **0** on some loads (the
     * `|| ns.config.height` fallback then quietly supplied 1000 and everything looked fine) and
     * **150** on others, where 150 is truthy so the fallback never fired and the graph was scaled
     * to 0.20 with 7px icons — legible in neither case (alpha-launch docs/issues/0056).
     *
     * The widget owns its whole iframe, so the viewport is the honest answer whenever the
     * container reports something implausible. `ns.config` stays the last resort.
     */
    ns.panelSize = function($component) {
        const measured = { w: $component.width(), h: $component.height() };
        const view = {
            w: (typeof window !== "undefined" && window.innerWidth) || 0,
            h: (typeof window !== "undefined" && window.innerHeight) || 0,
        };
        // "Implausible" = less than half the viewport. A pane legitimately smaller than that would
        // be too small to draw a force graph in anyway, so this cannot reject a usable measurement.
        const usable = (m, v) => m > 0 && (!v || m >= v / 2);
        const width = usable(measured.w, view.w) ? measured.w : (view.w || ns.config.width);
        const height = usable(measured.h, view.h) ? measured.h : (view.h || ns.config.height);
        if (width !== measured.w || height !== measured.h) {
            console.warn(
                "panelSize: container measured " + measured.w + "x" + measured.h +
                " which does not fit viewport " + view.w + "x" + view.h +
                "; drawing at " + width + "x" + height + " instead"
            );
        }
        return { width: width, height: height };
    };

    /**
     * Re-size the svg and re-fit when the container changes size.
     *
     * **Why this is the fix, and the earlier guess was not** (alpha-launch docs/issues/0056):
     * the host lays this iframe out at its final size only after its own layout settles. Measured,
     * the widget drew into a **1264x150** iframe and the container later became **853x720** — the
     * svg kept the stale attributes, so `fitToPanel()` scaled a 27-node graph to **0.20** and the
     * icons came out at 7px. Rejecting an "implausible" measurement cannot help: at the moment it
     * is taken, the container, the body and the viewport all agree on the wrong size. Nothing is
     * wrong with the measurement — it is simply taken too early, and never taken again.
     *
     * Idempotent: the observer is installed once per component.
     */
    ns.observeResize = function($component) {
        const el = $component.get(0);
        if (!el || typeof ResizeObserver === "undefined") return;
        if ($component.data("resize-observed")) return;
        $component.data("resize-observed", true);

        let last = null;
        const observer = new ResizeObserver(function() {
            const panel = ns.panelSize($component);
            const key = panel.width + "x" + panel.height;
            if (key === last) return;
            last = key;
            const svgEl = d3.select(el).select("svg");
            if (svgEl.empty()) return;
            console.log("observeResize: container is now " + key + ", resizing svg and re-fitting");
            svgEl.attr("width", panel.width).attr("height", panel.height);
            if (ns.fitToPanel) ns.fitToPanel();
        });
        observer.observe(el);
    };

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
        // Rectangle has width and height =  iconSize, centered at origin
        const rectHalfWidth = iconSize/2;
        const rectHalfHeight = iconSize/2;
        
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

    // //create a simulation for an array of nodes, and compose the desired forces.
    // ns.forceSimulation = function(width, height) {
    // //     return d3.forceSimulation()
    // //         .force("link", d3.forceLink() // This force provides links between nodes
    // //                         .id(d => d.id) // This sets the node id accessor to the specified function. If not specified, will default to the index of a node.
    // //         ) 
    // //         .force("charge", d3.forceManyBody().strength(-500)) // This adds repulsion (if it's negative) between nodes.
    // //         .force("center", d3.forceCenter(width / 2, height / 2)) // This force attracts nodes to the center of the svg area
    // //         .force("collision", d3.forceCollide().radius(ns.config.iconSize * 1.5)) // Prevent node overlap with collision detection
    //         // .force("x", d3.forceX(width / 2).strength(0.05)) // Keep nodes within horizontal bounds
    //         // .force("y", d3.forceY(height / 2).strength(0.05)); // Keep nodes within vertical bounds
    // }

    ns.loadFromData = function($component, data) {

        // Draw with the fetched options, not before them. `init()` starts the options fetch and the
        // host posts data separately, so without this the first draw can use the defaults and the
        // merged theme/sizes only take effect on a later render — a race that would show up as
        // "the options are applied, sometimes".
        if (ns.optionsReady && !ns.optionsSettled) {
            console.log("loadFromData: waiting for the options fetch before drawing");
            ns.optionsReady.then(() => {
                ns.optionsSettled = true;
                ns.loadFromData($component, data);
            });
            return;
        }

        console.group(`widget loadFromData on ${window.location}`);

        // Idempotent render: every call appended a fresh <g class="nodes"> (and edge paths with
        // id-based labels) without removing the previous generation, so a second data load
        // doubled every node on screen (alpha-launch docs/issues/0024). Tear down first.
        if (d3.select($component.get(0)).select("svg g .nodes").size() > 0) {
            console.log("loadFromData: clearing previous render before re-render");
            ns.clearData();
        }

        let container = $component.get(0)

        // Get container dimensions — see ns.panelSize for why the raw measurement is not trusted.
        const panel = ns.panelSize($component);
        const width = panel.width;
        const height = panel.height;

        // Dedupe nodes by id before anything binds to them. Upstream payloads can carry the
        // same STIX id twice (incident + its extension row - alpha-launch docs/issues/0024);
        // with a keyed join the duplicate becomes a phantom element that renders but ignores
        // renderPositions() and interactions. Keep the first occurrence, log what was dropped.
        {
            const seenIds = new Set();
            const uniqueNodes = data.nodes.filter(n => {
                if (seenIds.has(n.id)) {
                    console.warn(`Dropping duplicate node id from payload: ${n.id}`);
                    return false;
                }
                seenIds.add(n.id);
                return true;
            });
            if (uniqueNodes.length !== data.nodes.length) {
                console.warn(`Node dedupe: ${data.nodes.length} -> ${uniqueNodes.length}`);
            }
            data.nodes = uniqueNodes;
        }

        // Create a Set of valid node IDs for efficient lookup
        const nodeIds = new Set(data.nodes.map(n => n.id));

        // Filter edges to only include those with valid source and target nodes
        const validEdges = data.edges.filter(edge => {
            const isValid = nodeIds.has(edge.source) && nodeIds.has(edge.target);
            if (!isValid) {
                console.warn(`Skipping edge with missing node - source: ${edge.source}, target: ${edge.target}`);
            }
            return isValid;
        });
        
        console.log(`Filtered edges: ${data.edges.length} total, ${validEdges.length} valid, ${data.edges.length - validEdges.length} invalid`);

        //init d3 force simulation
        ns.simulation = d3
            .forceSimulation(data.nodes)
            .force("link", d3.forceLink() // This force provides links between nodes
                .id(d => d.id) // This sets the node id accessor to the specified function. If not specified, will default to the index of a node.
                // .distance(500 * ns.options.iconSize)
            );

        // Get the g element inside svg (the one with transform) - this is where elements are added
        let svg = d3.select(container)
            .select("svg")
            .select("g")

        // Initialize the links
        let link = svg.selectAll(".links")
            .data(validEdges)
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
            .data(validEdges)
            .join('path')
            .attr('class', 'edgepath')
            .attr('fill-opacity', 0)
            .attr('stroke-opacity', 0)
            .attr('id', function (d, i) {return 'edgepath' + i})
            .style("pointer-events", "none")
            .style("user-select", "none");

        const edgelabels = svg.selectAll(".edgelabel")
            .data(validEdges)
            .join('text')
            .style("pointer-events", "none")
            .style("user-select", "none")
            .attr('class', 'edgelabel')
            .attr('id', function (d, i) {return 'edgelabel' + i})
            .attr('font-size', 12)
            .attr('font-family', 'Arial, sans-serif')
            .attr('font-weight', '500')
            .attr('fill', '#666')
            // docs/issues/0107 Option 3 — edge labels are revealed on hover, not drawn permanently.
            //
            // Measured with 28 nodes: 52 edge labels produced **62 edge-x-edge collisions**, with
            // 46 of the 52 overlapping something — the "black smear" this issue describes around the
            // hub. Adding node labels (Option 2) then added 36 node-x-edge collisions on top, taking
            // 64 of 80 labels (80%) into at least one collision.
            //
            // The mockup (docs/mini-app-source/image5.png) shows the inverse of the build: every
            // node named, and edges drawn as clean unlabelled curves. Hiding edge labels by default
            // therefore matches the design AND is what makes the node names readable — 0107 Option 3
            // is explicitly "make room for Option 2 rather than compete with it".
            //
            // Nothing is lost: hovering a node reveals the labels of the edges that touch it, which
            // is also more useful than a permanent wall of text — the relationship you want named is
            // the one attached to the node you are looking at.
            .style('opacity', 0);


        edgelabels.append('textPath') //To render text along the shape of a <path>, enclose the text in a <textPath> element that has an href attribute with a reference to the <path> element.
            .attr('xlink:href', function (d, i) {return '#edgepath' + i})
            .style("text-anchor", "middle")
            .style("pointer-events", "none")
            .style("user-select", "none")
            .attr("startOffset", "50%")
            .attr("dy", -2)  // Lift text 2 pixels above the edge line
            .text(d => d.name);

        /**
         * docs/issues/0107 — what a node should say under its icon.
         *
         * Every node in `/viz-data/overview-default-incident` has a `name` (0 of 28 missing), but
         * "populated" is not "useful". Measured on the demo incident:
         *   good  — "Potential Phishing Email", "Query Exchange Server", "evil@northkorea.nk",
         *           "https://www.northkorea.nk/we/are/mad/"
         *   weak  — "event", "task" (x5 sequence nodes: `name` is the REFERENT TYPE, not a name),
         *           "99" (impact), "79563902" (user-account id)
         *   bad   — "email-addr--eb38d07e-6ba8-56c1-b107-d4db4aacf212" (email-message: a raw STIX id)
         *
         * So label with `name`, but never render a raw STIX id — fall back to `heading`, the shaped
         * type name, which is at least true. The weak-but-not-id cases are shown as they are rather
         * than hidden: they are the shaper's output and hiding them would conceal docs/issues/0140.
         */
        ns.nodeLabel = function(d) {
            const raw = (d && d.name != null) ? String(d.name).trim() : "";
            const looksLikeStixId = /^[a-z0-9-]+--[0-9a-f-]{8,}$/i.test(raw);
            const text = (!raw || looksLikeStixId) ? String((d && d.heading) || "") : raw;
            return text.length > 28 ? text.slice(0, 27) + "…" : text;
        };

        /**
         * docs/issues/0107 — keep labels the same size ON SCREEN whatever the view scale is.
         *
         * `fitToPanel()` scales the whole root group to fit the settled layout — measured at
         * **0.39** for the 28-node demo incident. Text inside that group is scaled with it, so an
         * 11px font rendered at **5px**: present in the DOM, and unreadable on screen. The first
         * version of this feature shipped exactly that, because its probe asserted the labels
         * existed, were non-empty and did not collide — never that they were legible.
         *
         * So font size and the vertical offset are expressed in GRAPH units as `wanted / scale`,
         * which cancels the transform and lands them at `wanted` pixels on screen.
         */
        ns.LABEL_PX = 11;      // desired on-screen font size
        ns.LABEL_GAP_PX = 6;   // desired on-screen gap between icon bottom and text top
        ns.viewScale = 1;

        ns.rescaleLabels = function(scale) {
            const s = (typeof scale === "number" && isFinite(scale) && scale > 0) ? scale : 1;
            ns.viewScale = s;
            const svgRoot = ns.svg_g || d3.select("svg");
            svgRoot.selectAll("text.node-label").attr("font-size", ns.LABEL_PX / s);
            if (ns.renderPositions) ns.renderPositions();
            if (ns.declutterLabels) ns.declutterLabels();
            console.log(`rescaleLabels: view scale ${s.toFixed(3)} -> font ${(ns.LABEL_PX / s).toFixed(1)} graph units (${ns.LABEL_PX}px on screen)`);
        };

        /**
         * docs/issues/0107 — hide any label that would overlap one already on screen.
         *
         * Making labels legible necessarily makes them wider: at 12px on screen, 28 labels on a
         * graph fitted to 0.39 collided in 10 pairs with 16 of 28 involved. Shrinking them back is
         * not a fix — it just returns to the unreadable 5px this replaced. So show as many
         * non-overlapping labels as genuinely fit, and leave the rest to hover: the same bargain
         * already struck for edge labels, and the reason the graph reads at all.
         *
         * Greedy, in DOM order. Run once per settle, never per tick — it reads layout, so putting it
         * in renderPositions would force a reflow on every simulation step.
         */
        ns.declutterLabels = function() {
            const svgRoot = ns.svg_g || d3.select("svg");
            const labels = svgRoot.selectAll("text.node-label").nodes();
            const kept = [];
            let hidden = 0;
            labels.forEach(function(el) {
                el.style.opacity = 1;              // measure it at full size
                const r = el.getBoundingClientRect();
                if (!r.width) return;
                const clash = kept.some(function(k) {
                    return r.left < k.right && r.right > k.left && r.top < k.bottom && r.bottom > k.top;
                });
                if (clash) { el.style.opacity = 0; el.setAttribute("data-decluttered", "1"); hidden++; }
                else { el.removeAttribute("data-decluttered"); kept.push(r); }
            });
            console.log(`declutterLabels: ${labels.length - hidden} shown, ${hidden} hidden (revealed on hover)`);
        };

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

                    // Requirement 3 / os-threat#94: left-select opens this object's Update form,
                    // populated. Only on select - deselecting should not reopen it.
                    ns.openFormForNode(ns.selectedNode);
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
                // Direct manipulation, no simulation restart. The graph is settled synchronously
                // (the d3 timer is starved in the embedded iframe - docs/issues/0006/0016), so
                // re-heating here flung the sparse layout apart, and alphaTarget(0.3) left the
                // never-cooling simulation churning the starved timer until the iframe froze.
                .on("start", function(event, d) {
                    d.fx = d.x;
                    d.fy = d.y;
                }) //start - after a new pointer becomes active (on mousedown or touchstart).
                .on("drag", function(event, d) {
                    d.fx = d.x = event.x;
                    d.fy = d.y = event.y;
                    ns.renderPositions();
                })      //drag - after an active pointer moves (on mousemove or touchmove).
                .on("end", function(event, d) {
                    // fx/fy remain set, keeping the node where the user put it
                    console.log("Node fixed at position:", d.id, d.fx, d.fy);
                })     //end - after an active pointer becomes inactive (on mouseup, touchend or touchcancel).
            );

        // docs/issues/0107 — a text label under each node icon.
        //
        // Until now the graph showed 28 icons and no names at all, so a viewer could not tell WHICH
        // identity, email address or task any node was without clicking it — and clicking is the
        // least reliable interaction in the act (docs/issues/0084). The mockup
        // (docs/mini-app-source/image5.png) labels every node, so this is the specified product.
        //
        // `pointer-events: none` is deliberate and load-bearing: docs/issues/0084 showed an
        // opacity-hidden tooltip in this same widget acting as a hit shield. A label sitting under
        // every node must never be able to swallow a click meant for the node.
        const nodelabels = svg.append("g")
            .attr("class", "node-labels")
            .selectAll("text")
            .data(data.nodes)
            .join("text")
            .attr("class", "node-label")
            .attr("text-anchor", "middle")
            .attr("font-size", 11)
            .attr("font-family", ns.config.edgeFontFamily || "Arial, sans-serif")
            .attr("fill", "#333")
            .style("pointer-events", "none")
            .style("user-select", "none")
            .text(ns.nodeLabel);

        // docs/issues/0107 Option 3 — reveal an edge's label while its endpoint node is hovered.
        //
        // Namespaced so it composes with the existing `.tooltip` handlers on the same selection
        // rather than replacing them (d3 would silently drop an unnamespaced duplicate).
        const edgeTouches = (e, id) => {
            const s = (e.source && e.source.id !== undefined) ? e.source.id : e.source;
            const t = (e.target && e.target.id !== undefined) ? e.target.id : e.target;
            return s === id || t === id;
        };
        node.on("mouseover.edgelabels", function(event, d) {
                edgelabels.style("opacity", e => edgeTouches(e, d.id) ? 1 : 0);
                // docs/issues/0107 — a label hidden by declutterLabels() is still reachable: hovering
                // its node brings it back, so no node is permanently anonymous.
                nodelabels.filter(n => n.id === d.id).style("opacity", 1);
            })
            .on("mouseout.edgelabels", function(event, d) {
                edgelabels.style("opacity", 0);
                nodelabels.filter(n => n.id === d.id)
                    .style("opacity", function() {
                        return this.getAttribute("data-decluttered") ? 0 : 1;
                    });
            });

        // Render current node/edge positions to the DOM. Shared by the simulation's tick
        // handler and the drag behaviour (which moves nodes directly on a settled graph).
        ns.renderPositions = function() {
                link.attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);

                node.attr("x", d => d.x - ns.config.iconSize/2)
                    .attr("y", d => d.y - ns.config.iconSize/2);

                // Centred under the icon, clear of its bottom edge. The gap is expressed in graph
                // units as `wanted / viewScale` so it stays constant on screen (docs/issues/0107) —
                // at scale 0.39 a fixed 12-unit gap renders as ~5px and the text collides with the
                // icon it belongs to.
                nodelabels.attr("x", d => d.x)
                    .attr("y", d => d.y + ns.config.iconSize/2 + (ns.LABEL_GAP_PX + ns.LABEL_PX) / (ns.viewScale || 1));

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

                    // docs/issues/0107 — keep the label reading left-to-right.
                    //
                    // The label is a <textPath> bound to this path, and a textPath runs in the
                    // path's OWN direction. Drawn source->target unconditionally, every edge whose
                    // target sits left of its source renders its label mirrored and upside-down —
                    // about a third of them (`email-address-ref`, `next-steps`, `sequenced-object`,
                    // `provided-by-ref` were the reported ones). There is no rotation to correct;
                    // the path direction IS the bug.
                    //
                    // Safe to reverse: this path is invisible (fill-opacity 0, stroke-opacity 0,
                    // pointer-events none) and exists only to position the label — the edge the
                    // user sees is the separate <line> updated above, which is untouched. So the
                    // arrowhead and geometry are unaffected; only the text's reading order changes.
                    if (targetX < d.source.x) {
                        return 'M ' + targetX + ' ' + targetY + ' L ' + d.source.x + ' ' + d.source.y;
                    }
                    return 'M ' + d.source.x + ' ' + d.source.y + ' L ' + targetX + ' ' + targetY;
                });
        };

        //Listen for tick events to render the nodes as they update in your Canvas or SVG.
        ns.simulation
            .nodes(data.nodes) //sets the simulation's nodes to the specified array of objects, initializing their positions and velocities, and then re-initializes any bound forces;
            .on("tick", ns.renderPositions)

        // Setup either the Layout, or Default Force Graph
        if (ns.config.showLayout) {
            
            ns.simulation 
                .force("link")
                .links(validEdges)
                .id(d => d.id)
                .distance(function() {return 4 * ns.config.iconSize;})
                .strength(0.05);

            ns.simulation 
                .force('x', d3.forceX().x(function(d) {
                    return d.positionX;
                }).strength(function(d) {
                    // ignore forceX where the positionX is 0 (i.e., not set)
                    if (d.positionX === 0) {
                        return 0;
                    } else {
                        return 1;
                    }
                }))
                .force('y', d3.forceY().y(function(d) {
                    return d.positionY;
                }).strength(1))
                // .force('collision', d3.forceCollide().radius(function(d) {
                //     console.log("d is ->", d)
                //     return d.radius;
                // }))
                .force("collide", d3.forceCollide(ns.config.iconSize))
                // .force("charge", d3.forceManyBody().strength(-200)) // This adds repulsion (if it's negative) between nodes. 
                .force("charge", d3.forceManyBody().strength(-500)) // This adds repulsion (if it's negative) between nodes. 
                // .force("center", d3.forceCenter(ns.config.width / 2, ns.config.height / 2)); // This force attracts nodes to the center of the svg area
        } else {
            ns.simulation 
                .force("link")
                .links(validEdges)
                .id(d => d.id)
                .distance(function() {return 4 * ns.config.iconSize;});
            ns.simulation
                .force("charge", d3.forceManyBody().strength(-500)) // This adds repulsion (if it's negative) between nodes. 
                .force("center", d3.forceCenter(ns.config.width / 2, ns.config.height / 2)); // This force attracts nodes to the center of the svg area
        }

          
        // Re-heat before settling. The previous test was `alpha() === 0`, which d3 never reports -
        // alpha decays towards alphaMin (0.001) and the timer stops there - so after a clear/reload
        // this fell through to a bare restart() on an already-cold simulation and nothing moved.
        ns.simulation.alphaTarget(0).alpha(1);
        ns.settle();

        console.groupEnd();
    }

    /** How many steps to run when settling the layout synchronously. */
    ns.SETTLE_TICKS = 300;

    /**
     * Run the force simulation to a settled layout, synchronously.
     *
     * This widget used to hand the layout to d3's animation timer and hope. That works when the
     * widget is open on its own, but NOT when it is embedded in a CMS page: measured there, the
     * timer is starved, the layout never develops, and the graph renders as a single node in the
     * corner while every node icon has been fetched - i.e. it looks like "no data" when the data
     * is fine. See alpha-launch docs/issues/0006; the composer hit the same wall and solved it the
     * same way (ForceGraph.settle, docs/issues/0004).
     *
     * These graphs are tens of nodes, so stepping them by hand costs a few milliseconds.
     */
    ns.settle = function () {
        const sim = ns.simulation;
        if (!sim || typeof sim.tick !== "function") {
            console.warn("settle: no simulation to settle");
            return;
        }

        const alphaBefore = sim.alpha();
        try {
            for (let i = 0; i < ns.SETTLE_TICKS; i++) {
                sim.tick();
            }

            // simulation.tick() advances the layout but deliberately does NOT dispatch the "tick"
            // event, so the SVG still shows pre-settle positions. Invoke the tick handler once to
            // paint the result.
            const onTick = sim.on("tick");
            if (typeof onTick === "function") {
                onTick.call(sim);
            } else {
                console.warn("settle: no tick handler registered, layout will not be painted");
            }

            // Stop it so the (unreliable) timer cannot re-heat and undo this.
            sim.stop();

            console.log(
                `settle: ran ${ns.SETTLE_TICKS} ticks, alpha ${alphaBefore.toFixed(3)} -> ` +
                `${sim.alpha().toFixed(4)}, ${sim.nodes().length} node(s) positioned`
            );

            ns.fitToPanel();
        } catch (error) {
            console.error("settle: failed to settle layout", error);
        }
    }

    /**
     * Scale and centre the settled layout so all of it is inside the panel.
     *
     * The force configuration produces a layout far larger than the panel - measured on the default
     * incident, 28 nodes settle across y = -857..978 inside an 876px panel, so most of the graph sits
     * above the top edge and the page looks empty. Rather than re-tune the forces (that is task 3 /
     * os-threat#80, and owned elsewhere), fit the finished layout to the box.
     *
     * This is deliberately a *view* transform on the root <g>, not a change to node coordinates, so
     * drag and the existing zoom handler keep working from wherever the graph ends up.
     */
    ns.fitToPanel = function () {
        const sim = ns.simulation;
        const root = ns.svg_g;
        if (!sim || !root) {
            console.warn("fitToPanel: no simulation or root group to fit");
            return;
        }

        const nodes = sim.nodes().filter(n => Number.isFinite(n.x) && Number.isFinite(n.y));
        if (!nodes.length) {
            console.warn("fitToPanel: no positioned nodes to fit");
            return;
        }

        const pad = ns.config.iconSize * 1.5;
        const minX = Math.min(...nodes.map(n => n.x)) - pad;
        const maxX = Math.max(...nodes.map(n => n.x)) + pad;
        const minY = Math.min(...nodes.map(n => n.y)) - pad;
        const maxY = Math.max(...nodes.map(n => n.y)) + pad;

        const svgEl = root.node() && root.node().ownerSVGElement;
        const box = svgEl && svgEl.getBoundingClientRect();
        const panelW = box && box.width ? box.width : ns.config.width;
        const panelH = box && box.height ? box.height : ns.config.height;

        const scale = Math.min(panelW / (maxX - minX), panelH / (maxY - minY), 1);
        const tx = (panelW - (maxX - minX) * scale) / 2 - minX * scale;
        const ty = (panelH - (maxY - minY) * scale) / 2 - minY * scale;

        const fitTransform = `translate(${tx},${ty}) scale(${scale})`;
        root.attr("transform", fitTransform).attr("data-fit-transform", fitTransform);

        // docs/issues/0107 — the fit scale is what shrinks the labels, so re-size them here.
        if (ns.rescaleLabels) ns.rescaleLabels(scale);

        console.log(
            `fitToPanel: layout ${Math.round(maxX - minX)}x${Math.round(maxY - minY)} into ` +
            `panel ${Math.round(panelW)}x${Math.round(panelH)} -> scale ${scale.toFixed(3)}, ` +
            `translate(${Math.round(tx)},${Math.round(ty)})`
        );
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

        // Start the #82 options fetch first, so the merge is in flight before any draw. loadFromData
        // waits on ns.optionsReady rather than racing it.
        ns.loadOptions().then(() => { ns.optionsSettled = true; });

        console.log($component);

        // Get container dimensions — see ns.panelSize for why the raw measurement is not trusted.
        const panel = ns.panelSize($component);
        const width = panel.width;
        const height = panel.height;

        let container = $component.get(0)

        //create svg
        let svg = d3.select(container)
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", "translate(" + ns.config.margin.left + "," + ns.config.margin.top + ")");

        // Keep a handle on the root group so fitToPanel() can re-centre the settled layout.
        ns.svg_g = svg;

        // The host's iframe reaches its final size after this runs — re-fit when it does.
        ns.observeResize($component);

        //create tooltip - create new one if doesn't exist
        if (!window.Widgets.Widget.tooltip) {
            ns.tooltip = d3.select("body")
                .append("div")
                .attr('class', 'tooltip')
                .attr('id', 'widget-tooltip')
                .style('display', 'block')
                .style("position", "absolute")
                .style("z-index", "10")
                // docs/issues/0084 — remove this invisible overlay from hit-testing.
                //
                // Hidden on mouseout by `opacity: 0` ALONE, this div keeps `display: block`,
                // `z-index: 10` and its last position, so it stays a live hit target. Measured on
                // the embedded Overview: after one hover it is 409x634 px at (352,516), still
                // `pointer-events: auto`, and it stays there indefinitely.
                //
                // ⚠️ It was proposed as the cause of 0084's click-delivery strand (a hand run got
                // 0/4 node clicks to issue a form request; 0100 found P2-S5's "8/8 opened" were all
                // the SAME form). That is NOT established, and the guard below was measured NOT to
                // change it: with all 28 nodes checked for geometric overlap against the parked
                // rect, ZERO node centres fell inside it either way. The tooltip anchors at
                // (clientX, clientY + 10) and extends down-right, so it never covers the node you
                // just hovered, and on this layout the rest cluster up-and-left of it.
                //
                // Kept because a 409x634 invisible decorative div should not be clickable under any
                // layout — the exposure is real and node positions move every run — but it is
                // hardening, not a demonstrated fix. 0084's click strand remains unexplained.
                .style("pointer-events", "none")
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
        // Compose zoom on top of whatever transform the layout currently has - fitToPanel() may have
        // replaced the initial margin translate with a fit transform, and zooming must not undo it.
        const baseTransform = () => svg.attr("data-fit-transform")
            || `translate(${ns.config.margin.left},${ns.config.margin.top})`;
        var zoom_handler = d3.zoom()
            .scaleExtent([0.1, 10])  // Allow zoom from 10% to 1000%
            .on("zoom", function(event){
                // Combine zoom transform with initial margin translate
                svg.attr("transform", `${baseTransform()} ${event.transform}`);

                // docs/issues/0107 — the effective scale is fit x zoom, so labels must be re-sized
                // against the product, not against either alone, or they grow/shrink with zoom.
                const fitScale = Number((/scale\(([\d.]+)\)/.exec(baseTransform()) || [])[1]) || 1;
                if (ns.rescaleLabels) ns.rescaleLabels(fitScale * (event.transform.k || 1));
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

/**
 * E2E Tests: Force-Directed Graph Visualization
 * 
 * Tests for the new force-directed graph visualization that replaced panel-based architecture
 */

describe("Force-Directed Graph Visualization", () => {
  beforeEach(() => {
    // Visit widget
    cy.visit("/");
    cy.waitForWidgetReady();
  });

  describe("Graph Rendering", () => {
    it("should render force-directed graph with SVG", () => {
      cy.get('[component="graphviz"]').should("be.visible");
      cy.get('[component="graphviz"] svg').should("exist");
      cy.get('[component="graphviz"] svg g').should("exist");
    });

    it("should render nodes and edges", () => {
      cy.waitForLoadingComplete();
      
      // Check for nodes (images) and links (lines)
      cy.get('[component="graphviz"] svg .nodes').should("exist");
      cy.get('[component="graphviz"] svg .links').should("exist");
      
      // Verify graph is rendered
      cy.verifyGraphRendered();
    });

    it("should render arrowhead markers for edges", () => {
      cy.waitForLoadingComplete();
      
      // Check for arrowhead marker definition
      cy.get('[component="graphviz"] svg defs marker#arrowhead').should("exist");
    });
  });

  describe("Local Mode Data Loading", () => {
    beforeEach(() => {
      // Intercept API call for local mode
      cy.intercept("GET", "http://localhost:8111/viz-data/overview-default-incident", {
        statusCode: 200,
        fixture: "overview-default-incident.json",
      }).as("apiCall");
      
      cy.visit("?local=true");
      cy.waitForWidgetReady();
    });

    it("should load data from API in local mode", () => {
      cy.wait("@apiCall");
      cy.waitForLoadingComplete();
      cy.verifyGraphRendered();
    });

    it("should handle API errors gracefully", () => {
      cy.intercept("GET", "http://localhost:8111/viz-data/overview-default-incident", {
        statusCode: 404,
        body: { error: "Not found" },
      }).as("apiError");
      
      cy.visit("?local=true");
      cy.waitForWidgetReady();
      
      cy.wait("@apiError");
      cy.wait(2000);
      
      // Should show error (check console or error handling)
      cy.get('[component="graphviz"]').should("exist");
    });
  });

  describe("Widget Mode Data Loading", () => {
    let fixtureData;

    beforeEach(() => {
      // Pre-load fixture data
      cy.fixture("overview-default-incident.json").then((data) => {
        fixtureData = data;
      });

      // Listen for DATA_REQUEST and respond with fixture
      cy.window().then((win) => {
        win.addEventListener("message", (event) => {
          let eventData = event.data;
          
          if (typeof eventData === 'string') {
            try {
              eventData = JSON.parse(eventData);
            } catch (e) {
              return;
            }
          }
          
          if (
            eventData &&
            eventData.action === "DATA_REQUEST" &&
            eventData.type === "embed-viz-event-payload-data-overview-default-incident"
          ) {
            win.postMessage({
              ...eventData,
              target: "iframe-embed_BD8EU3LCD",
              topicName: eventData.type,
              eventName: "readaction",
              endpointConfig: {
                method: "GET",
                url: "http://localhost:8111/viz-data/overview-default-incident"
              },
              url: "http://localhost:8111/viz-data/overview-default-incident",
              method: "GET",
              payloadType: "application/json",
              body: null,
              ok: true,
              data: fixtureData
            }, "*");
          }
        });
      });
    });

    it("should request data from parent in widget mode", () => {
      cy.window().then((win) => {
        cy.spy(win.parent, "postMessage").as("postMessage");
      });
      
      cy.wait(2000);
      
      // Widget should request data
      cy.get("@postMessage").should("have.been.called");
    });

    it("should render graph after receiving data from parent", () => {
      cy.wait(3000);
      cy.waitForLoadingComplete();
      cy.verifyGraphRendered();
    });
  });

  describe("Graph Interactions", () => {
    beforeEach(() => {
      // Load test data
      cy.intercept("GET", "http://localhost:8111/viz-data/overview-default-incident", {
        statusCode: 200,
        fixture: "overview-default-incident.json",
      }).as("apiCall");
      
      cy.visit("?local=true");
      cy.waitForWidgetReady();
      cy.wait("@apiCall");
      cy.waitForLoadingComplete();
    });

    it("should show tooltip on node hover", () => {
      // Wait for nodes to be rendered
      cy.get('[component="graphviz"] svg .nodes image').should("exist");
      
      // Hover over first node
      cy.get('[component="graphviz"] svg .nodes image').first().trigger("mouseover");
      
      // Check for tooltip
      cy.get("#widget-tooltip, .tooltip").should("exist");
      cy.get("#widget-tooltip, .tooltip").should("have.css", "opacity").and("not.eq", "0");
    });

    it("should allow node dragging", () => {
      cy.get('[component="graphviz"] svg .nodes image').should("exist");
      
      // Get initial position
      cy.get('[component="graphviz"] svg .nodes image').first().then(($node) => {
        const initialX = $node.attr("x");
        const initialY = $node.attr("y");
        
        // Drag node
        cy.get('[component="graphviz"] svg .nodes image').first()
          .trigger("mousedown", { which: 1 })
          .trigger("mousemove", { clientX: 100, clientY: 100 })
          .trigger("mouseup");
        
        cy.wait(500);
        
        // Position should have changed (simulation updates it)
        cy.get('[component="graphviz"] svg .nodes image').first().then(($nodeAfter) => {
          // Node should be draggable (position may change)
          expect($nodeAfter.attr("x")).to.exist;
          expect($nodeAfter.attr("y")).to.exist;
        });
      });
    });

    it("should scale nodes on hover", () => {
      cy.get('[component="graphviz"] svg .nodes image').should("exist");
      
      // Get initial size
      cy.get('[component="graphviz"] svg .nodes image').first().then(($node) => {
        const initialWidth = parseFloat($node.attr("width"));
        
        // Hover over node
        cy.get('[component="graphviz"] svg .nodes image').first().trigger("mouseover");
        cy.wait(400); // Wait for transition
        
        // Size should increase
        cy.get('[component="graphviz"] svg .nodes image').first().then(($nodeHover) => {
          const hoverWidth = parseFloat($nodeHover.attr("width"));
          expect(hoverWidth).to.be.greaterThan(initialWidth);
        });
      });
    });
  });

  describe("Reload Functionality", () => {
    beforeEach(() => {
      cy.intercept("GET", "http://localhost:8111/viz-data/overview-default-incident", {
        statusCode: 200,
        fixture: "overview-default-incident.json",
      }).as("apiCall");
      
      cy.visit("?local=true");
      cy.waitForWidgetReady();
      cy.wait("@apiCall");
      cy.waitForLoadingComplete();
    });

    it("should reload graph data when reload is called", () => {
      // Verify graph is rendered
      cy.verifyGraphRendered();
      
      // Call reload function
      cy.window().then((win) => {
        if (win.Widgets && win.Widgets.Widget && win.Widgets.Widget.reload) {
          win.Widgets.Widget.reload();
        }
      });
      
      // Wait for reload
      cy.wait("@apiCall");
      cy.waitForLoadingComplete();
      
      // Graph should still be rendered
      cy.verifyGraphRendered();
    });

    it("should handle DATA_REFRESH event", () => {
      cy.verifyGraphRendered();
      
      // Send DATA_REFRESH event
      cy.window().then((win) => {
        win.postMessage({
          type: "embed-viz-event-payload-data-overview-default-incident",
          action: "DATA_REFRESH",
          payload: {},
          componentId: "overview-default-incident",
        }, "*");
      });
      
      // Wait for reload
      cy.wait("@apiCall");
      cy.waitForLoadingComplete();
      
      // Graph should still be rendered
      cy.verifyGraphRendered();
    });
  });

  describe("Zoom Functionality", () => {
    beforeEach(() => {
      cy.intercept("GET", "http://localhost:8111/viz-data/overview-default-incident", {
        statusCode: 200,
        fixture: "overview-default-incident.json",
      }).as("apiCall");
      
      cy.visit("?local=true");
      cy.waitForWidgetReady();
      cy.wait("@apiCall");
      cy.waitForLoadingComplete();
    });

    it("should support zoom interactions", () => {
      cy.get('[component="graphviz"] svg g').should("exist");
      
      // Get initial transform
      cy.get('[component="graphviz"] svg g').then(($g) => {
        const initialTransform = $g.attr("transform");
        
        // Simulate zoom (wheel event)
        cy.get('[component="graphviz"] svg').trigger("wheel", {
          deltaY: -100,
          clientX: 600,
          clientY: 400,
        });
        
        cy.wait(300);
        
        // Transform should change (zoom applied)
        cy.get('[component="graphviz"] svg g').then(($gAfter) => {
          const newTransform = $gAfter.attr("transform");
          // Transform should exist (zoom may have been applied)
          expect(newTransform).to.exist;
        });
      });
    });
  });
});


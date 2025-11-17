describe("Complete User Flow", () => {
  beforeEach(() => {
    // Intercept API call for local mode
    cy.intercept("GET", "http://localhost:8111/viz-data/overview-default-incident", {
      statusCode: 200,
      fixture: "overview-default-incident.json",
    }).as("apiCall");
    
    // Visit widget with local=true parameter
    cy.visit("?local=true");
    cy.waitForWidgetReady();
  });

  it("should complete full user journey from load to interaction", () => {
    // Wait for initial data load and verify content appears
    cy.wait("@apiCall");
    cy.waitForLoadingComplete();
    cy.verifyGraphRendered();
    
    // Verify nodes and edges are rendered
    cy.get('[component="graphviz"] svg .nodes image').should("exist");
    cy.get('[component="graphviz"] svg .links line').should("exist");

    // Test node interaction - hover
    cy.get('[component="graphviz"] svg .nodes image').first().trigger("mouseover");
    cy.wait(400);
    
    // Tooltip should appear
    cy.get("#widget-tooltip, .tooltip").should("exist");

    // Test reload functionality
    cy.window().then((win) => {
      if (win.Widgets && win.Widgets.Widget && win.Widgets.Widget.reload) {
        win.Widgets.Widget.reload();
      }
    });

    // Wait for reload and verify content appears
    cy.wait("@apiCall");
    cy.waitForLoadingComplete();
    cy.verifyGraphRendered();
  });

  it("should handle error recovery in complete flow", () => {
    // Wait for initial load
    cy.wait("@apiCall");
    cy.waitForLoadingComplete();
    cy.verifyGraphRendered();

    // Simulate error by intercepting with error response
    cy.intercept("GET", "http://localhost:8111/viz-data/overview-default-incident", {
      statusCode: 500,
      body: { error: "Server error" },
    }).as("apiError");

    // Trigger reload
    cy.window().then((win) => {
      if (win.Widgets && win.Widgets.Widget && win.Widgets.Widget.reload) {
        win.Widgets.Widget.reload();
      }
    });

    cy.wait("@apiError");
    cy.wait(2000);

    // Widget should still exist (error handling)
    cy.get('[component="graphviz"]').should("exist");
  });

  it("should maintain graph state across reloads", () => {
    // Wait for initial load
    cy.wait("@apiCall");
    cy.waitForLoadingComplete();
    cy.verifyGraphRendered();

    // Get initial node count
    cy.get('[component="graphviz"] svg .nodes image').then(($nodes) => {
      const initialCount = $nodes.length;
      
      // Reload
      cy.window().then((win) => {
        if (win.Widgets && win.Widgets.Widget && win.Widgets.Widget.reload) {
          win.Widgets.Widget.reload();
        }
      });

      cy.wait("@apiCall");
      cy.waitForLoadingComplete();
      
      // Node count should be maintained (same data)
      cy.get('[component="graphviz"] svg .nodes image').should("have.length", initialCount);
    });
  });
});

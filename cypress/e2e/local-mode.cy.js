describe("Local Mode Data Loading", () => {
  beforeEach(() => {
    // Set up API interception for overview endpoint
    cy.intercept("GET", "http://localhost:8111/viz-data/overview-default-incident", {
      statusCode: 200,
      fixture: "overview-default-incident.json",
    }).as("apiCall");
    
    // Visit widget with local=true parameter
    cy.visit("?local=true");
    cy.waitForWidgetReady();
  });

  it("should detect local mode and load from API", () => {
    // Wait for API call and verify response
    cy.wait("@apiCall");

    // Verify loading completes
    cy.waitForLoadingComplete();

    // Verify graph is rendered
    cy.verifyGraphRendered();
  });

  it("should load graph data from API when local=true", () => {
    // Wait for API call
    cy.wait("@apiCall");

    // Verify loading completes
    cy.waitForLoadingComplete();

    // Verify graph is rendered with nodes and edges
    cy.verifyGraphRendered();
    
    // Check for nodes and links
    cy.get('[component="graphviz"] svg .nodes image').should("exist");
    cy.get('[component="graphviz"] svg .links line').should("exist");
  });

  it("should handle API errors gracefully", () => {
    // Mock API failure
    cy.intercept("GET", "http://localhost:8111/viz-data/overview-default-incident", {
      statusCode: 404,
      body: { error: "Not found" },
    }).as("apiError");

    // Visit widget with local=true parameter
    cy.visit("?local=true");
    cy.waitForWidgetReady();

    // Wait for API call and verify it was made
    cy.wait("@apiError").then((interception) => {
      expect(interception.response.statusCode).to.equal(404);
    });

    // Wait a moment for error processing
    cy.wait(2000);

    // Widget should still exist (error handling should not crash widget)
    cy.get('[component="graphviz"]').should("exist");
  });

  it("should not retry failed API requests", () => {
    // Mock API to fail
    cy.intercept("GET", "http://localhost:8111/viz-data/overview-default-incident", {
      statusCode: 500,
      body: { error: "Server error" },
    }).as("apiFailure");

    // Visit widget with local=true parameter
    cy.visit("?local=true");
    cy.waitForWidgetReady();

    cy.wait("@apiFailure");

    // Wait a moment for error processing
    cy.wait(2000);

    // Verify only one call was made (no retry)
    cy.get("@apiFailure").should("have.been.calledOnce");
  });

  it("should show error when API is unavailable", () => {
    // Mock network error
    cy.intercept("GET", "http://localhost:8111/viz-data/overview-default-incident", {
      forceNetworkError: true,
    }).as("networkError");

    // Visit widget with local=true parameter
    cy.visit("?local=true");
    cy.waitForWidgetReady();

    // Wait for error
    cy.wait(3000);

    // Widget should still exist
    cy.get('[component="graphviz"]').should("exist");
  });
});

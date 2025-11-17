/* eslint-disable no-undef */
// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Custom command to wait for widget to be ready
Cypress.Commands.add("waitForWidgetReady", () => {
  // Check if we're in workbench context (iframe)
  cy.get("body").then(($body) => {
    if ($body.find("#widgetFrame").length > 0) {
      // We're in workbench, check iframe
      cy.get("#widgetFrame", { timeout: 10000 }).should("exist");
      cy.get("#widgetFrame").then(($iframe) => {
        const doc = $iframe[0].contentDocument || $iframe[0].contentWindow.document;
        cy.wrap(doc.body).find('[component="graphviz"]', { timeout: 10000 }).should("be.visible");
        cy.wrap(doc.body).find('[component="graphviz"] svg', { timeout: 10000 }).should("exist");
      });
    } else {
      // We're in direct widget context
      cy.get('[component="graphviz"]', { timeout: 10000 }).should("be.visible");
      cy.get('[component="graphviz"] svg', { timeout: 10000 }).should("exist");
    }
  });
});

// Custom command to mock API responses
Cypress.Commands.add("mockApiResponse", (endpoint, fixture, statusCode = 200) => {
  const alias = endpoint.replace(/[^a-zA-Z0-9]/g, "-");
  cy.intercept("GET", endpoint, {
    statusCode,
    fixture,
  }).as(alias);
});

// Custom command to simulate parent app message
Cypress.Commands.add("simulateParentMessage", (message) => {
  cy.window().then((win) => {
    win.postMessage(message, "*");
  });
});

// Custom command to check for toast notifications
Cypress.Commands.add("checkToast", (type, message) => {
  cy.get(".toastify").should("contain", message);
  if (type) {
    cy.get(".toastify").should("have.class", `toast-${type}`);
  }
});

// Custom command to wait for loading state to complete
Cypress.Commands.add("waitForLoadingComplete", () => {
  // Wait for SVG to be rendered (indicates graph is loaded)
  cy.get('[component="graphviz"] svg', { timeout: 15000 }).should("exist");
  cy.get('[component="graphviz"] svg g', { timeout: 5000 }).should("exist");
  // Dismiss any loading toasts
  cy.get(".toastify").then(($toasts) => {
    if ($toasts.length > 0) {
      $toasts.each((index, toast) => {
        if (toast.textContent && toast.textContent.includes("Loading")) {
          cy.wrap(toast).find(".toast-close").click({ force: true });
        }
      });
    }
  });
});

// Custom command to click filter and wait for data load
Cypress.Commands.add("clickFilterAndWait", (filterId) => {
  cy.get(`#${filterId}`).click();
  cy.waitForLoadingComplete();
});

// Custom command to verify force-directed graph is rendered
Cypress.Commands.add("verifyGraphRendered", () => {
  cy.get('[component="graphviz"] svg').should("exist");
  cy.get('[component="graphviz"] svg g').should("exist");
  // Check for nodes (images) and links (lines)
  cy.get('[component="graphviz"] svg .nodes').should("exist");
  cy.get('[component="graphviz"] svg .links').should("exist");
});

// Legacy alias for backward compatibility
Cypress.Commands.add("verifyTreeRendered", () => {
  cy.verifyGraphRendered();
});

// Custom command to get the iframe's body for widget assertions
Cypress.Commands.add("getWidgetIframeBody", () => {
  // Get the iframe, its document, and body, and wrap it for Cypress
  return cy
    .get("#widgetFrame", { timeout: 10000 })
    .should("exist")
    .then(($iframe) => {
      const doc = $iframe[0].contentDocument || $iframe[0].contentWindow.document;
      return cy.wrap(doc.body);
    });
}); 
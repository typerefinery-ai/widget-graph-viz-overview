/* global describe, it, cy, beforeEach */
describe("Widget Mode Communication", () => {
  let fixtureData;

  beforeEach(() => {
    // Pre-load fixture data before setting up event listeners
    cy.fixture("overview-default-incident.json").then((data) => {
      fixtureData = data;
    });

    cy.visit("/");
    cy.waitForWidgetReady();
    
    // Listen for DATA_REQUEST and respond with fixture
    cy.window().then((win) => {
      win.addEventListener("message", (event) => {
        let eventData = event.data;
        
        // Handle both string and object payloads
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

  it("should load widget in widget mode", () => {
    // Test that widget loads without local parameter
    cy.get('[component="graphviz"]').should("be.visible");
    cy.get('[component="graphviz"] svg').should("exist");
    
    // Widget should be in widget mode (no local parameter)
    cy.url().should("not.include", "local=true");
  });

  it("should request data from parent on load", () => {
    cy.window().then((win) => {
      cy.spy(win.parent, "postMessage").as("postMessage");
    });
    
    // Wait for widget to request data
    cy.wait(2000);
    
    // Widget should have requested data
    cy.get("@postMessage").should("have.been.called");
  });

  it("should render graph after receiving data from parent", () => {
    // Wait for data to be received and processed
    cy.wait(3000);
    cy.waitForLoadingComplete();
    
    // Verify graph is rendered
    cy.verifyGraphRendered();
  });

  it("should handle parent app errors", () => {
    cy.window().then((win) => {
      win.postMessage(
        {
          type: "embed-viz-event-payload-data-overview-default-incident",
          action: "DATA_REQUEST",
          error: "Parent app error",
        },
        "*"
      );
    });
    
    // Widget should handle error gracefully
    cy.wait(2000);
    cy.get('[component="graphviz"]').should("exist");
  });

  it("should handle missing data from parent", () => {
    cy.window().then((win) => {
      win.postMessage(
        {
          type: "embed-viz-event-payload-data-overview-default-incident",
          action: "DATA_REQUEST",
          // No data provided
        },
        "*"
      );
    });
    
    // Widget should handle missing data gracefully
    cy.wait(2000);
    cy.get('[component="graphviz"]').should("exist");
  });

  it("should handle DATA_REFRESH event", () => {
    // Wait for initial load
    cy.wait(2000);
    
    // Send DATA_REFRESH event
    cy.window().then((win) => {
      win.postMessage({
        type: "embed-viz-event-payload-data-overview-default-incident",
        action: "DATA_REFRESH",
        payload: {},
        componentId: "overview-default-incident",
      }, "*");
    });
    
    // Widget should reload data
    cy.wait(2000);
    cy.get('[component="graphviz"]').should("exist");
  });
}); 

describe("Widget Mode - Event Listener Management", () => {
    it("should only load data once per trigger (no event listener leak)", () => {
        cy.visit("/");
        cy.waitForWidgetReady();
        
        cy.window().then((win) => {
            const widget = win.Widgets && win.Widgets.Widget;
            if (widget && widget.loadFromData) {
                cy.spy(widget, "loadFromData").as("loadFromDataSpy");
            }
        });
        
        // Trigger a data load by sending a postMessage
        cy.window().then((win) => {
            cy.fixture("overview-default-incident.json").then((data) => {
                win.postMessage({
                    type: "embed-viz-event-payload-data-overview-default-incident",
                    action: "DATA_REQUEST",
                    payload: {
                        id: "overview-default-incident",
                        type: "load"
                    },
                    data: data
                }, "*");
            });
        });
        
        cy.wait(1000); // Wait for the data load to process
        cy.get("@loadFromDataSpy").should("have.been.calledOnce");
    });
});

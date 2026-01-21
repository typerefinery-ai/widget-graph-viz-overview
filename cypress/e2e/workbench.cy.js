/* eslint-disable no-undef */
/// <reference types="cypress" />

describe('Workbench Communication - Force-Directed Graph', () => {
  let fixtureData;

  beforeEach(() => {
    // Pre-load fixture data before setting up event listeners
    cy.fixture("overview-default-incident.json").then((data) => {
      fixtureData = data;
    });

    cy.visit('/workbench');
    
    // Wait for workbench to load and iframe to be ready
    cy.get('.workbench').should('be.visible');
    cy.get('#widgetFrame').should('be.visible');
    
    // Wait for iframe to load the widget (port 4008)
    cy.get('#widgetFrame').should('have.attr', 'src', 'http://localhost:4008/');
    
    // Wait for iframe to load completely
    cy.wait(2000);
    
    // Listen for DATA_REQUEST from widget iframe and respond with fixture
    cy.window().then((win) => {
      win.addEventListener('message', (event) => {
        let eventData = event.data;
        
        // Handle both string and object payloads
        if (typeof eventData === 'string') {
          try {
            eventData = JSON.parse(eventData);
          } catch (e) {
            console.warn('Failed to parse event data as JSON:', eventData);
            return;
          }
        }
        
        if (
          eventData &&
          eventData.action === 'DATA_REQUEST' &&
          (eventData.type === 'embed-viz-event-payload-data-overview-default-incident' ||
           eventData.type?.includes('overview-default-incident'))
        ) {
          win.postMessage({
            ...eventData,
            target: 'iframe-embed_BD8EU3LCD',
            topicName: 'embed-viz-event-payload-data-overview-default-incident',
            eventName: 'readaction',
            endpointConfig: {
              method: 'GET',
              url: 'http://localhost:8111/viz-data/overview-default-incident'
            },
            url: 'http://localhost:8111/viz-data/overview-default-incident',
            method: 'GET',
            payloadType: 'application/json',
            body: null,
            ok: true,
            data: fixtureData
          }, '*');
        }
      });
    });
  });

  it('should load the workbench and the widget iframe', () => {
    cy.get('.workbench').should('exist');
    cy.get('#widgetFrame').should('exist');
    cy.get('#status').should('contain', 'Connected');
    cy.get('.console').should('contain', 'Workbench Started');
    cy.get('.console').should('contain', 'Force-Directed Graph Visualization');
  });

  it('should have Load Data button (not Load Overview Data)', () => {
    cy.get('button').contains('📊 Load Data').should('exist');
    cy.get('button').contains('Load Overview Data').should('not.exist');
  });

  it('should load data when Load Data button is clicked', () => {
    cy.get('button').contains('📊 Load Data').click();
    cy.wait(2000);
    
    // Check console for successful data loading
    cy.get('.console').should('contain', 'sent to iframe');
    cy.get('.console').should('contain', 'overview-default-incident');
    
    // Verify iframe receives data and renders graph
    cy.get('#widgetFrame').then(($iframe) => {
      const iframe = $iframe[0];
      cy.wrap(iframe.contentDocument.body).find('[component="graphviz"]').should('be.visible');
      cy.wrap(iframe.contentDocument.body).find('[component="graphviz"] svg').should('exist');
    });
  });

  it('should automatically load data when widget initializes after reload', () => {
    // Click reload widget button
    cy.get('button').contains('🔄 Reload Widget').click();
    
    // Wait for iframe to reload
    cy.wait(3000);
    
    // Widget should automatically request data on init
    cy.get('.console').should('contain', 'received from iframe');
    cy.get('.console').should('contain', 'DATA_REQUEST');
    cy.get('.console').should('contain', 'overview-default-incident');
    
    // Workbench should respond with data
    cy.get('.console').should('contain', 'Sent overview-default-incident fixture data to widget');
    
    // Verify graph is rendered in iframe
    cy.get('#widgetFrame').then(($iframe) => {
      const iframe = $iframe[0];
      cy.wrap(iframe.contentDocument.body).find('[component="graphviz"] svg').should('exist');
      cy.wrap(iframe.contentDocument.body).find('[component="graphviz"] svg .nodes').should('exist');
      cy.wrap(iframe.contentDocument.body).find('[component="graphviz"] svg .links').should('exist');
    });
  });

  it('should send Data Refresh event when Send Data Refresh button is clicked', () => {
    cy.get('button').contains('🔄 Send Data Refresh').click();
    cy.wait(1000);
    
    // Check console for DATA_REFRESH event
    cy.get('.console').should('contain', 'sent to iframe');
    cy.get('.console').should('contain', 'DATA_REFRESH');
  });

  it('should send a custom message from workbench to widget and log it', () => {
    cy.get('#messageType').clear().type('embed-viz-event-payload-data-overview-default-incident');
    cy.get('#messageData').clear().type('{"action": "DATA_REFRESH", "payload": {}}', { parseSpecialCharSequences: false });
    cy.get('.btn.success').contains('Send').click();
    cy.get('.console').should('contain', 'sent to iframe');
    cy.get('.console').should('contain', 'embed-viz-event-payload-data-overview-default-incident');
  });

  it('should receive a DATA_REQUEST message from the widget and respond', () => {
    // Wait for the widget to load and send a DATA_REQUEST
    cy.wait(3000);
    
    // Check if the workbench received and responded to a DATA_REQUEST
    cy.get('.console').should('contain', 'received from iframe');
    cy.get('.console').should('contain', 'DATA_REQUEST');
    cy.get('.console').should('contain', 'overview-default-incident');
  });

  it('should display correct event info in sidebar', () => {
    cy.get('input[value="embed-viz-event-payload-data-overview-default-incident"]').should('exist');
    cy.get('input[value="/viz-data/overview-default-incident"]').should('exist');
  });

  it('should use correct iframe URL (port 4008)', () => {
    cy.get('#iframeUrl').should('have.value', 'http://localhost:4008/');
    cy.get('#widgetFrame').should('have.attr', 'src', 'http://localhost:4008/');
  });

  it('should simulate error and log it', () => {
    cy.get('button').contains('❌ Simulate Error').click();
    cy.wait(1000);
    cy.get('.console').should('contain', 'sent to iframe');
    cy.get('.console').should('contain', 'Simulated error');
  });

  it('should simulate timeout and log it', () => {
    cy.get('button').contains('⏰ Simulate Timeout').click();
    cy.wait(1000);
    cy.get('.console').should('contain', 'sent to iframe');
    cy.get('.console').should('contain', 'Simulated timeout');
  });

  it('should simulate crash and log it', () => {
    cy.get('button').contains('💥 Simulate Crash').click();
    cy.wait(1000);
    cy.get('.console').should('contain', 'sent to iframe');
    cy.get('.console').should('contain', 'Simulated crash');
  });

  it('should clear console when Clear Console button is clicked', () => {
    // Generate some console output first
    cy.get('button').contains('📊 Load Data').click();
    cy.wait(1000);
    cy.get('.console').should('not.be.empty');
    
    // Clear console
    cy.get('button').contains('🧹 Clear Console').click();
    cy.get('.console').should('contain', 'Console cleared');
  });

  it('should reload iframe when Reload Iframe button is clicked', () => {
    cy.get('button').contains('🔄 Reload Iframe').click();
    cy.wait(2000);
    cy.get('#widgetFrame').should('be.visible');
    cy.get('.console').should('contain', 'Reloading iframe');
  });
});

describe('Workbench - Data Loading Flow', () => {
  let fixtureData;

  beforeEach(() => {
    cy.fixture("overview-default-incident.json").then((data) => {
      fixtureData = data;
    });

    cy.visit('/workbench');
    cy.get('.workbench').should('be.visible');
    cy.get('#widgetFrame').should('be.visible');
    cy.wait(2000);
    
    // Set up message listener
    cy.window().then((win) => {
      win.addEventListener('message', (event) => {
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
          eventData.action === 'DATA_REQUEST' &&
          (eventData.type === 'embed-viz-event-payload-data-overview-default-incident' ||
           eventData.type?.includes('overview-default-incident'))
        ) {
          win.postMessage({
            ...eventData,
            target: 'iframe-embed_BD8EU3LCD',
            topicName: 'embed-viz-event-payload-data-overview-default-incident',
            eventName: 'readaction',
            endpointConfig: {
              method: 'GET',
              url: 'http://localhost:8111/viz-data/overview-default-incident'
            },
            url: 'http://localhost:8111/viz-data/overview-default-incident',
            method: 'GET',
            payloadType: 'application/json',
            body: null,
            ok: true,
            data: fixtureData
          }, '*');
        }
      });
    });
  });

  it('should load overview data and render force-directed graph', () => {
    // Click Load Data button
    cy.get('button').contains('📊 Load Data').click();
    cy.wait(3000);
    
    // Verify data was sent
    cy.get('.console').should('contain', 'Sent overview-default-incident fixture data to widget');
    cy.get('.console').should('contain', 'nodes and');
    cy.get('.console').should('contain', 'edges');
    
    // Verify graph is rendered
    cy.get('#widgetFrame').then(($iframe) => {
      const iframe = $iframe[0];
      cy.wrap(iframe.contentDocument.body).find('[component="graphviz"] svg').should('exist');
      cy.wrap(iframe.contentDocument.body).find('[component="graphviz"] svg .nodes image').should('exist');
      cy.wrap(iframe.contentDocument.body).find('[component="graphviz"] svg .links line').should('exist');
    });
  });

  it('should handle DATA_REFRESH event and reload graph', () => {
    // First load data
    cy.get('button').contains('📊 Load Data').click();
    cy.wait(2000);
    
    // Then send refresh
    cy.get('button').contains('🔄 Send Data Refresh').click();
    cy.wait(2000);
    
    // Verify refresh was sent
    cy.get('.console').should('contain', 'DATA_REFRESH');
    cy.get('.console').should('contain', 'sent to iframe');
  });
});

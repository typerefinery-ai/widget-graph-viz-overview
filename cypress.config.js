const { defineConfig } = require("cypress");
require("dotenv").config();

module.exports = defineConfig({
  e2e: {
    baseUrl: `http://localhost:${process.env.PORT || 4005}`,
    viewportWidth: 1200,
    viewportHeight: 800,
    video: true,
    screenshot: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    setupNodeEvents(on, config) {
      // Configure for widget testing
      on("task", {
        log(message) {
          console.log(message);
          return null;
        },
      });
    },
    specPattern: "cypress/e2e/**/*.cy.js",
    supportFile: "cypress/support/e2e.js",
    fixturesFolder: "cypress/fixtures",
    downloadsFolder: "cypress/downloads",
    videosFolder: "cypress/videos",
    screenshotsFolder: "cypress/screenshots",
  },
}); 
# HTML Notes

These files processed as templates see docs [here](https://github.com/jantimon/html-webpack-plugin?tab=readme-ov-file#options)

## Add new content

To add new content create new HTML in `content.html`. This will be injected into final template.

# Widget Graph Viz - Workbench Documentation

## Overview

The **Workbench** is a comprehensive testing and development environment for the Widget Graph Viz application. It simulates a parent application that communicates with the widget via postMessage, enabling full E2E testing of widget functionality without cross-origin iframe limitations.

## Key Features

### 🎯 **Automatic Event Capture**
- Captures all `DATA_REQUEST` events from the widget
- Automatically maps event types to appropriate fixture data
- Responds with realistic API response structures

### 📊 **Fixture Data Integration**
- Loads real fixture data from `cypress/fixtures/src/assets/data/tree-`
- Supports all data types: sighting, task, impact, event, user, company
- Provides fallback data for missing fixtures

### 🎛️ **Manual Data Controls**
- Buttons for each data type with proper event formatting
- Custom message sending with JSON payload support
- Error simulation and timeout testing

### 🔍 **Real-time Monitoring**
- Live console showing all message traffic
- Message counter and timestamp tracking
- Status indicators for connection health

## Event Flow

### 1. Widget → Workbench (DATA_REQUEST)
```json
{
    "type": "embed-viz-event-payload-data-tree-sighting",
    "payload": {
        "action": "load_data",
        "id": "sighting",
        "type": "load"
    },
    "action": "DATA_REQUEST",
    "componentId": "sighting-embed-viz-event-payload-data-tree-sighting-load_data",
    "config": "",
    "target": "parent"
}
```

### 2. Workbench → Widget (Response)
```json
{
    "type": "embed-viz-event-payload-data-tree-sighting",
    "payload": {
        "action": "load_data",
        "id": "sighting",
        "type": "load"
    },
    "action": "DATA_REQUEST",
    "componentId": "sighting-embed-viz-event-payload-data-tree-sighting-load_data",
    "config": "",
    "target": "iframe-embed_BD8EU3LCD",
    "topicName": "embed-viz-event-payload-data-tree-sighting",
    "eventName": "readaction",
    "endpointConfig": {
        "method": "GET",
        "url": "https://flow.typerefinery.localhost:8101/viz-data/tree-sighting"
    },
    "url": "https://flow.typerefinery.localhost:8101/viz-data/tree-sighting",
    "method": "GET",
    "payloadType": "application/json",
    "body": null,
    "ok": true,
    "data": { /* fixture data */ }
}
```

## Event Type Mapping

| Widget Event Type | Fixture Data | API Endpoint |
|------------------|--------------|--------------|
| `embed-viz-event-payload-data-tree-sighting` | `sighting.json` | `/viz-data/tree-sighting` |
| `embed-viz-event-payload-data-tree-task` | `task.json` | `/viz-data/tree-task` |
| `embed-viz-event-payload-data-tree-impact` | `impact.json` | `/viz-data/tree-impact` |
| `embed-viz-event-payload-data-tree-event` | `event.json` | `/viz-data/tree-event` |
| `embed-viz-event-payload-data-tree-user` | `user.json` | `/viz-data/tree-user` |
| `embed-viz-event-payload-data-tree-company` | `company.json` | `/viz-data/tree-company` |
| `embed-viz-event-payload-data-unattached-force-graph` | `sighting.json` | `/viz-data/unattached-force-graph` |

## Usage

### Starting the Workbench
```bash
npm run start
# Navigate to http://localhost:4008/workbench
```

### Manual Testing
1. **Load Data Types**: Click the data type buttons (👁️ Sighting Data, 📋 Task Data, etc.)
2. **Monitor Console**: Watch the real-time message traffic in the console
3. **Custom Messages**: Use the custom message panel to send specific events
4. **Error Testing**: Use error simulation buttons to test error handling

### Automated Testing
```bash
# Run workbench E2E tests
npm run test:e2e -- --spec "cypress/e2e/workbench.cy.js"

# Run specific test suite
npm run test:e2e -- --spec "cypress/e2e/workbench.cy.js" --grep "Automatic Event Capture"
```

## Test Coverage

### ✅ **Automatic Event Capture Tests**
- Captures `tree-sighting` DATA_REQUEST events
- Captures `tree-task` DATA_REQUEST events  
- Captures `tree-impact` DATA_REQUEST events
- Captures `unattached-force-graph` DATA_REQUEST events

### ✅ **Manual Data Request Tests**
- Sighting data button functionality
- Task data button functionality
- Impact data button functionality
- Event data button functionality
- User data button functionality
- Company data button functionality

### ✅ **Error Handling Tests**
- Missing fixture data handling
- Network timeout handling
- Invalid response handling

### ✅ **Event Flow Validation Tests**
- Complete widget → workbench → widget flow
- Message structure validation
- Response data validation

## Fixture Data Structure

All fixture files should follow this structure:

```json
{
    "name": "Evidence List",
    "icon": "sighting-generic",
    "type": "",
    "heading": "Evidence List",
    "description": "The list of sightings for this Incident",
    "edge": "",
    "id": "",
    "children": [
        {
            "id": "sighting--6c836ab4-803d-4c66-a426-0efcd2bfe24b",
            "type": "sighting",
            "icon": "sighting-alert",
            "name": "Sighting-Alert",
            "heading": "Sighting-Alert",
            "description": "Sighting of indicator<br>Where Sighted -> identity",
            "object_form": "sighting",
            "object_group": "sro-forms",
            "object_family": "stix-forms",
            "edge": "other_object_refs",
            "children": [ /* nested objects */ ]
        }
    ]
}
```

## Development

### Adding New Event Types
1. Add the event type mapping in `handleIncomingMessage()`
2. Create corresponding fixture data file
3. Add manual button if needed
4. Create E2E tests for the new event type

### Modifying Response Structure
The workbench response structure mirrors the production API response. To modify:
1. Update the response object in `handleIncomingMessage()`
2. Update corresponding E2E tests
3. Verify fixture data compatibility

### Debugging
- **Console Logs**: All message traffic is logged with timestamps
- **Network Tab**: Monitor actual HTTP requests (if any)
- **Widget Console**: Check widget-side console for errors
- **Workbench Console**: Real-time message monitoring

## Troubleshooting

### Common Issues

**Widget not receiving responses:**
- Check iframe URL is correct
- Verify workbench is listening for messages
- Check console for error messages

**Fixture data not loading:**
- Verify fixture file exists in `cypress/fixtures/src/assets/data/tree-`
- Check file permissions and JSON syntax
- Review network tab for 404 errors

**Event type not recognized:**
- Add event type mapping in `handleIncomingMessage()`
- Verify event type string matches exactly
- Check widget event generation

**Tests failing:**
- Ensure workbench is accessible at test URL
- Verify fixture data structure matches expectations
- Check for timing issues in async operations

## Best Practices

1. **Always use fixture data** instead of hardcoded mock data
2. **Test all event types** to ensure complete coverage
3. **Validate response structures** match production expectations
4. **Monitor console output** during development and testing
5. **Use descriptive test names** that explain the scenario being tested
6. **Handle errors gracefully** in both manual and automated tests

## Integration with CI/CD

The workbench is designed to work seamlessly with CI/CD pipelines:

```yaml
# Example GitHub Actions step
- name: Run Workbench Tests
  run: npm run test:e2e -- --spec "cypress/e2e/workbench.cy.js"
  env:
    CYPRESS_baseUrl: http://localhost:4008
```

This ensures that all widget functionality is thoroughly tested before deployment.
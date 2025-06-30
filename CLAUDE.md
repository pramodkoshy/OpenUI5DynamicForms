# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an OpenUI5 application connected to Supabase, providing dynamic form generation and CRUD operations for various business entities. The application uses a metadata-driven approach to automatically generate UI components based on table schemas.

## Key Commands

### Development
- `npm start` - Run the app locally in development mode (http://localhost:8080)
- `npm run start-cdn` - Run the app using CDN resources

### Build
- `npm run build` - Quick build to dist folder
- `npm run build:opt` - Optimized self-contained build with UI5 resources
- `npm run start:dist` - Serve the built application

### Testing & Quality
- `npm run lint` - Run ESLint on webapp directory
- `npm test` - Run lint and Karma tests with coverage
- `npm run karma` - Run Karma tests only
- `npm run karma-ci` - Run Karma tests in CI mode
- `npm run karma-ci-cov` - Run Karma tests with coverage in CI mode

## Architecture Overview

### Core Components

1. **Component.js** - Main application component that:
   - Initializes Supabase client connection
   - Manages entity cache via EntityCacheManager
   - Provides table metadata for dynamic form generation
   - Handles theme management and responsive design

2. **BaseController.js** - Base controller providing common functionality:
   - Supabase client access
   - Router navigation helpers
   - Message handling (error/success)
   - Table metadata access

3. **EntityCacheManager** - Manages caching of entity data:
   - Provides cache checking and retrieval
   - Handles cache invalidation
   - Tracks cache statistics

4. **SchemaDetectionService** - Automatically detects table schemas:
   - Analyzes sample data to infer field types
   - Detects relationships between tables
   - Provides fallback schemas when detection fails

### Dynamic Form System

The application generates forms dynamically based on table metadata:
- **EntityDetail.controller.js** - Handles entity viewing and editing
- **EntityCreate.controller.js** - Handles new entity creation
- **EntityList.controller.js** - Displays entity lists with filtering/sorting

Form generation considers:
- Field types (string, number, date, boolean, relation, etc.)
- Validation rules (required, editable, visible)
- Relationships between tables

### Table Metadata Structure

Each table's metadata defines:
```javascript
{
    primaryKey: "field_name",
    titleField: "display_field",
    subtitleField: "secondary_display_field",
    columns: [
        {
            name: "field_name",
            label: "Display Label",
            type: "string|number|date|boolean|relation|text|email|url",
            visible: true,
            editable: true,
            required: false,
            relation: "related_table_name" // for relation type
        }
    ],
    relations: [
        {
            table: "related_table",
            foreignKey: "field_name",
            condition: { /* optional filter */ }
        }
    ]
}
```

### Supported Tables

The application includes predefined metadata for:
- **entities** - Base polymorphic entity table
- **customers** - Customer records
- **products** - Product catalog
- **orders** & **order_items** - Order management
- **lead** & **lead_status** - Lead tracking
- **contacts** - Contact management
- **activities** - Activity tracking
- **campaigns** - Marketing campaigns
- **notes**, **files**, **tags** - Supporting data

### Key Patterns

1. **Polymorphic Relationships**: The `entities` table serves as a base for polymorphic relationships, allowing notes, files, and tags to be attached to any entity type.

2. **Cache Management**: EntityCacheManager is used throughout to minimize API calls and improve performance.

3. **Dynamic Routing**: Routes follow the pattern `/entity/{table}`, `/entity/{table}/detail/{id}`, `/entity/{table}/create`.

4. **Responsive Design**: The app adapts between phone, tablet, and desktop layouts using SplitApp.

5. **Theme Support**: Supports multiple SAP Horizon themes with persistence in localStorage.

## Important Considerations

- The Supabase connection is hardcoded in Component.js - update credentials for different environments
- Table metadata is currently defined in Component.js but can be extended or overridden
- The SchemaDetectionService can automatically detect schemas but predefined metadata takes precedence
- Cache is not enforced by age by default (enforceMaxAge: false in EntityCacheManager)
- Forms automatically handle relations by showing dropdown selections for related entities
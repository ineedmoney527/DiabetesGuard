# Monitoring, Logging, and Scaling Documentation

This document outlines the comprehensive monitoring, logging, and scaling setup for the Diabetes Guard application deployed on Google Cloud Platform (GCP) using Cloud Run.

## Table of Contents

1. [Monitoring](#monitoring)
2. [Logging](#logging)
3. [Scaling](#scaling)
4. [Integration Overview](#integration-overview)

## Monitoring

### Cloud Monitoring (Formerly Stackdriver)

The application utilizes Google Cloud Monitoring for comprehensive performance tracking. Cloud Monitoring automatically collects metrics from Cloud Run services without requiring any additional setup.

#### Key Metrics Tracked

- **Request Count**: Number of HTTP requests handled by the service
- **Request Latencies**: Distribution of request processing times
- **Container CPU Utilization**: CPU usage of container instances
- **Container Memory Utilization**: Memory consumption of container instances
- **Instance Count**: Number of container instances running (key for observing scaling)

#### Custom Application Metrics

In addition to the built-in Cloud Run metrics, we've implemented custom application metrics:

1. **API Endpoint Performance**: Tracking response times for each API endpoint

   ```javascript
   // Implemented via performanceMiddleware in backend/src/utils/performance.js
   logger.performance(`API:${req.method}:${req.path}`, durationMs, { ... });
   ```

2. **Memory Usage Monitoring**: Regular capturing of application memory consumption

   ```javascript
   // Implemented in backend/src/utils/performance.js
   logger.performance('system:memory', 0, { rss, heapTotal, heapUsed, ... });
   ```

3. **CPU Usage Monitoring**: Regular capturing of application CPU consumption

   ```javascript
   // Implemented in backend/src/utils/performance.js
   logger.performance("system:cpu", 0, { user, system, cpuUsageTotal });
   ```

4. **Frontend Page Render Times**: Tracking how quickly pages render on the client

   ```javascript
   // Implemented in frontend/src/utils/navigationTracker.js
   const pageTimer = logger.startTimer("page_render");
   ```

5. **API Request/Response Times**: Tracking API call performance from the frontend
   ```javascript
   // Implemented in frontend/src/utils/api.js
   config.timer = logger.startTimer(
     `API Request: ${config.method.toUpperCase()} ${config.url}`
   );
   ```

#### Alerting

Cloud Monitoring allows setting up alerting policies based on these metrics. Recommended alerts:

- **High Error Rate**: Alert when error rate exceeds 5% over 5 minutes
- **High Latency**: Alert when 95th percentile latency exceeds 1000ms over 10 minutes
- **Instance Count**: Alert when instance count approaches the configured maximum

#### Dashboard

A custom dashboard can be created in Cloud Monitoring to visualize these metrics. Key components:

- Request volume and latency charts
- Error rate chart
- Instance count chart
- Memory and CPU utilization charts
- Custom performance metric charts

## Logging

### Structured Logging Architecture

We've implemented a comprehensive structured logging system that spans both backend and frontend:

#### Backend Logging (Winston + Cloud Logging)

The backend uses Winston with the Google Cloud Logging integration:

```javascript
// backend/src/utils/logger.js
const winston = require("winston");
const { LoggingWinston } = require("@google-cloud/logging-winston");
```

Key features:

1. **Structured JSON Format**: All logs are in structured JSON format with consistent fields

   ```javascript
   winston.format.printf((info) => {
     return JSON.stringify({
       timestamp: info.timestamp,
       level: info.level,
       message: info.message,
       trace_id: info.trace_id,
       // Additional fields...
     });
   });
   ```

2. **Request/Response Logging**: Automatic logging of all HTTP requests and responses

   ```javascript
   // backend/src/utils/logger.js - requestLogger middleware
   logger.http('Incoming request', { requestId, path, method, ... });
   res.on('finish', () => { logger[logLevel]('Request completed', { ... }); });
   ```

3. **Error Tracking**: Detailed error logging with stack traces

   ```javascript
   logger.error("Error message", error, metadata);
   ```

4. **User Action Logging**: Specific logging of user actions

   ```javascript
   logger.userAction(userId, "profile_created", { metadata });
   ```

5. **Performance Metrics**: Logging of performance data
   ```javascript
   logger.performance("operation_name", durationMs, metadata);
   ```

#### Frontend Logging

The frontend implements a structured logger with similar capabilities:

```javascript
// frontend/src/utils/logger.js
const logger = { debug, info, warn, error, userAction, performance, ... };
```

Features:

1. **Client-Side Error Capturing**: Using Error Boundary component

   ```javascript
   // frontend/src/components/ErrorBoundary.jsx
   logger.error("React component error", error, { componentStack });
   ```

2. **API Request/Response Logging**: Automatic logging via Axios interceptors

   ```javascript
   // frontend/src/utils/api.js
   logger.debug(`API Request: ${config.method.toUpperCase()} ${config.url}`, { ... });
   ```

3. **Navigation Tracking**: Logging route changes

   ```javascript
   // frontend/src/utils/navigationTracker.js
   logger.navigation(previousPath, currentPath, { ... });
   ```

4. **Performance Timing**: Using timer utility

   ```javascript
   const timer = logger.startTimer("operation");
   // ... operation completes
   timer.stop({ metadata });
   ```

5. **Batched Server Submission**: Logs are batched and sent to backend
   ```javascript
   // Automatically flushes when queue reaches batchSize
   // Also flushes on page unload
   ```

#### Log Types Tracked

Our structured logging captures:

1. **System Logs**: Application startup, shutdown, configuration changes
2. **API Request/Response Logs**: HTTP method, path, status code, duration
3. **Error Logs**: Detailed error information with stack traces
4. **Performance Metrics**: Timing of key operations
5. **User Action Logs**: Specific user activities (login, profile update, etc.)
6. **Security Events**: Authentication attempts, authorization failures

#### Log Storage and Analysis

Logs are centrally stored in Cloud Logging, where they can be:

- Filtered and searched using the Logs Explorer
- Exported to BigQuery for advanced analysis
- Used to create custom metrics and alerts
- Retained according to configured retention policies

## Scaling

### Cloud Run Autoscaling

Cloud Run provides built-in autoscaling capabilities based on incoming request volume:

#### Scaling Configuration

Key configuration parameters:

1. **Minimum Instances**: Set to 0 (scales to zero when idle) or 1+ (keeps warm instances)
2. **Maximum Instances**: Upper limit on scaling (default 100)
3. **Concurrency**: Number of simultaneous requests per instance (default 80)

#### Scaling Behavior

Cloud Run scales based on the target concurrency:

- **Scale Out**: When (request_count) > (current_instances × concurrency)
- **Scale In**: When instances are underutilized (automatic)

#### Cold Start Mitigation

Strategies implemented:

1. **Optimized Container**: Small, efficient Docker images
2. **Minimum Instance Count**: Can be set > 0 to prevent cold starts
3. **Dependency Optimization**: Minimal dependencies to reduce startup time

## Integration Overview

The diagram below illustrates how monitoring, logging, and scaling are integrated:

```
┌───────────────────────────────────────────────────────────────────────┐
│                  Google Cloud Platform (GCP)                           │
│                                                                        │
│  ┌─────────────┐    ┌───────────────┐    ┌──────────────────────┐     │
│  │             │    │               │    │                      │     │
│  │  Cloud Run  │───▶│ Cloud Logging │───▶│ Cloud Monitoring     │     │
│  │  Service    │    │               │    │                      │     │
│  │             │    └───────┬───────┘    └──────────────────────┘     │
│  └─────────────┘            │                                          │
│         ▲                   │                                          │
│         │                   │                                          │
│         │                   ▼                                          │
│  ┌─────────────┐    ┌───────────────┐                                  │
│  │             │    │               │                                  │
│  │  Cloud Run  │    │  BigQuery     │                                  │
│  │  Autoscaling│    │  (Optional)   │                                  │
│  │             │    │               │                                  │
│  └─────────────┘    └───────────────┘                                  │
│                                                                        │
└───────────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │
                                 │
                                 │
┌────────────────────────────────┴──────────────────────────────────────┐
│                         Diabetes Guard App                             │
│                                                                        │
│   ┌────────────────┐                       ┌─────────────────────┐     │
│   │                │                       │                     │     │
│   │  Backend       │◀──────────────────────│  Frontend           │     │
│   │  (Node.js)     │    API requests       │  (React)            │     │
│   │                │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─▶│                     │     │
│   └────────┬───────┘    API responses      └─────────┬───────────┘     │
│            │                                         │                  │
│            ▼                                         ▼                  │
│   ┌────────────────┐                       ┌─────────────────────┐     │
│   │ Winston Logger │                       │ Frontend Logger     │     │
│   │ + Cloud        │◀──────────────────────│ (Sends logs to      │     │
│   │ Logging        │                       │  backend)           │     │
│   └────────────────┘                       └─────────────────────┘     │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Implementation Details

1. **Backend**:

   - Winston logger with Cloud Logging integration
   - Performance tracking middleware
   - System resource monitoring
   - Automatic request/response logging

2. **Frontend**:

   - Structured logger with batched server submission
   - Error boundary component
   - Navigation tracking
   - API call monitoring

3. **Cloud Integration**:
   - Cloud Run with autoscaling
   - Cloud Logging for centralized log storage
   - Cloud Monitoring for metrics and alerting

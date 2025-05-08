# Implementation Guide: Monitoring, Logging, and Scaling

This guide provides step-by-step instructions on how to implement the monitoring, logging, and scaling features for the Diabetes Guard application deployed on Google Cloud Platform using Cloud Run.

## Prerequisites

- Google Cloud Platform account with billing enabled
- Google Cloud SDK installed and configured
- Basic knowledge of Node.js and React
- Docker installed for building container images

## 1. Implementing Structured Logging

### Backend (Node.js/Express)

1. **Install required packages**:

   ```bash
   cd backend
   npm install winston winston-transport @google-cloud/logging-winston
   ```

2. **Create logger utility**:
   Create `backend/src/utils/logger.js` with Winston and Cloud Logging integration.

   ```javascript
   const winston = require("winston");
   const { LoggingWinston } = require("@google-cloud/logging-winston");

   // Implementation as shown in the file
   ```

3. **Create performance monitoring utility**:
   Create `backend/src/utils/performance.js` for tracking API performance, CPU and memory usage.

   ```javascript
   const { logger } = require("./logger");

   // Implementation as shown in the file
   ```

4. **Integrate with Express application**:

   - Add request logger middleware
   - Add performance middleware
   - Update error handling middleware
   - Start CPU and memory monitoring

5. **Create logs API endpoint**:
   Create `backend/src/routes/logs.js` to receive frontend logs.

   ```javascript
   const express = require("express");
   const router = express.Router();

   // Implementation as shown in the file
   ```

6. **Add logs route to main application**:

   ```javascript
   // Add to backend/src/index.js
   const logsRoutes = require("./routes/logs");
   app.use("/api/logs", logsRoutes);
   ```

7. **Update authentication routes** to use structured logging.

### Frontend (React)

1. **Create frontend logger utility**:
   Create `frontend/src/utils/logger.js` with support for batching and sending logs to backend.

   ```javascript
   // Frontend structured logger implementation
   ```

2. **Create error boundary component**:
   Create `frontend/src/components/ErrorBoundary.jsx` to catch and log React errors.

   ```javascript
   import React, { Component } from "react";
   import logger from "../utils/logger";

   // Implementation as shown in the file
   ```

3. **Create API utility with logging**:
   Create `frontend/src/utils/api.js` to log API requests and responses.

   ```javascript
   import axios from "axios";
   import logger from "./logger";

   // Implementation as shown in the file
   ```

4. **Create navigation tracker**:
   Create `frontend/src/utils/navigationTracker.js` to log route changes.

   ```javascript
   import { useEffect, useRef } from "react";
   import { useLocation, useNavigationType } from "react-router-dom";

   // Implementation as shown in the file
   ```

5. **Integrate with React application**:
   - Wrap the app with the error boundary
   - Add the navigation tracker component
   - Use the API utility for backend calls

## 2. Setting Up Cloud Monitoring

1. **Enable required GCP APIs**:

   ```bash
   gcloud services enable monitoring.googleapis.com
   gcloud services enable logging.googleapis.com
   ```

2. **Grant necessary IAM permissions**:

   ```bash
   # Grant Logs Writer role
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member=serviceAccount:SERVICE_ACCOUNT_EMAIL \
     --role=roles/logging.logWriter

   # Grant Monitoring Metric Writer role
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member=serviceAccount:SERVICE_ACCOUNT_EMAIL \
     --role=roles/monitoring.metricWriter
   ```

3. **Create custom Cloud Monitoring dashboard**:

   - Go to Google Cloud Console -> Monitoring -> Dashboards
   - Create a new dashboard with the following charts:
     - Request count
     - Request latency (50th, 95th, 99th percentiles)
     - Error rate
     - Instance count
     - Memory and CPU usage
     - Custom metrics from our application

4. **Set up alerting policies**:
   - Go to Google Cloud Console -> Monitoring -> Alerting
   - Create alerts for:
     - High error rate (>5% for 5+ minutes)
     - High latency (95th percentile >1000ms for 10+ minutes)
     - Instance count near maximum
     - Memory usage exceeding 85%

## 3. Configuring Cloud Run Scaling

1. **Configure autoscaling parameters**:

   ```bash
   gcloud run services update SERVICE_NAME \
     --min-instances=1 \
     --max-instances=10 \
     --concurrency=80
   ```

2. **Optimize container image** for faster startup:

   - Use multi-stage Docker builds
   - Minimize dependencies
   - Use production builds for frontend

3. **Update Dockerfile** to optimize build:

   ```dockerfile
   # Example optimized Dockerfile for backend
   FROM node:16-alpine as build
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .

   # Use smaller runtime image
   FROM node:16-alpine
   WORKDIR /app
   COPY --from=build /app .
   EXPOSE 8080
   CMD ["node", "src/index.js"]
   ```

4. **Deploy to Cloud Run**:

   ```bash
   # Build container
   gcloud builds submit --tag gcr.io/PROJECT_ID/diabetes-guard-backend

   # Deploy to Cloud Run
   gcloud run deploy diabetes-guard-backend \
     --image gcr.io/PROJECT_ID/diabetes-guard-backend \
     --platform managed \
     --min-instances=1 \
     --max-instances=10 \
     --memory=512Mi \
     --concurrency=80 \
     --region=us-central1 \
     --allow-unauthenticated
   ```

## 4. Testing the Implementation

1. **Test backend logging**:

   ```bash
   # Generate some traffic to the API
   curl https://YOUR_SERVICE_URL/api/some-endpoint

   # Check logs in Cloud Logging
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=diabetes-guard-backend"
   ```

2. **Test frontend logging**:

   - Open the application in a browser
   - Navigate between pages
   - Perform various actions
   - Check logs in Cloud Logging for frontend entries

3. **Test scaling**:

   ```bash
   # Use a load testing tool like hey
   hey -n 1000 -c 100 https://YOUR_SERVICE_URL/api/some-endpoint

   # Monitor instance count in Cloud Console
   ```

4. **Verify logs are properly structured**:
   - Go to Cloud Logging Explorer
   - Use structured queries like:
     ```
     resource.type="cloud_run_revision"
     resource.labels.service_name="diabetes-guard-backend"
     jsonPayload.level="error"
     ```

## 5. Next Steps

1. **Set up log exports to BigQuery** for advanced analytics:

   ```bash
   # Create a log sink to BigQuery
   gcloud logging sinks create diabetes-guard-logs \
     bigquery.googleapis.com/projects/PROJECT_ID/datasets/diabetes_guard_logs \
     --log-filter="resource.type=cloud_run_revision AND resource.labels.service_name=diabetes-guard-backend"
   ```

2. **Create custom metrics** from logs:

   - Go to Cloud Monitoring -> Metrics Explorer
   - Create metrics based on log entries, such as:
     - Count of user actions by type
     - Count of errors by category
     - Average response time by endpoint

3. **Implement distributed tracing** for more detailed request tracking:
   - Add the OpenTelemetry library to the application
   - Configure it to send traces to Cloud Trace

## Troubleshooting

1. **Logger not sending to Cloud Logging**:

   - Verify service account has proper permissions
   - Check for credential errors in local logs
   - Verify environment variables are set correctly

2. **Scaling issues**:

   - Check for memory leaks that might cause containers to restart
   - Verify container is properly handling requests
   - Check CPU/memory limits are appropriate

3. **High latency**:
   - Check database query performance
   - Look for long-running operations in performance logs
   - Consider optimizing resource-intensive operations

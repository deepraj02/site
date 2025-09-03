---
author: Deepraj Baidya
pubDatetime: 2025-08-27T15:22:00Z
title: Build your own Posthog - PART 2
slug: build-your-own-posthog-part-2
featured: true
draft: false
tags:
  - analytics
  - flutter
  - microservices
  - production
  - server
  - proxy
  - api-gateway
  - python
  - nextjs
  - typescript

description: File Strucuture configuration and getting started with coding the entire infra of SmolHog.
---

Welcome to Part 2 of this series. In this installment, we'll dive deep into the infrastructure setup, Docker containerization, and the critical *API Gateway* implementation that serves as the backbone of our analytics system. We'll walk through the complete file structure and explain every component in detail.

Now before we start I gotta tell you what exactly is an *API-Gateway* and why it is required in this project.

### What ?
An *API Gatewa*y is a server that acts as an intermediary layer between client applications and backend services. Think of it as a "traffic controller" or "front door" that sits between clients (like mobile apps, web applications, or third-party integrations) and internal microservices.


### Why ?
In SmolHog's architecture, the *API Gateway* serves as the single entry point for all analytics requests, handling the complexity of routing requests to appropriate backend services while providing essential cross-cutting functionalities like:

1. Centalized Requests : Without an API Gateway,the Dashboard & the Flutter SDK would need to know about multiple backend services and their individual endpoints.

2. Cross-Origin Resource Sharing (CORS) Management : Handles browser security restrictions in one place, allowing web-based analytics dashboard and Flutter web apps to make cross-origin requests safely.

3. Request / Response Logging : Track response times for all requests

Now that we have a good idea of what an API Gateway really is, let's now move forward and setup our project.

## Project Structure :

We've opted for a well-organized monorepo structure that separates concerns while making it easy for development workflows. Let's examine the complete directory structure:

```bash
.
├── docker-compose.yml
├── Makefile
├── infra
│   ├── backend
│   │   ├── api-gateway
│   │   ├── event-processor  
│   │   └── workers
│   └── frontend
│       ├── app
│       └── node_modules
├── migrations
└── smolhog_flutter
    ├── example
    └── lib
```

## Setting up our Docker Images :

SmolHog depends on various different tools like **PostgreSQL** & **RabbitMQ** and to have them integrated with our project we will use Docker and set up the images.

The **docker-compose.yml** file is the orchestration masterpiece that brings together all our services. Let's break it down section by section:

`docker-compose.yml`

``` yml
postgres:
  image: postgres:latest
  environment:
    POSTGRES_DB: smolhog_analytics
    POSTGRES_USER: user
    POSTGRES_PASSWORD: password
  ports:
    - "5432:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./migrations:/docker-entrypoint-initdb.d/
  networks:
    - smolhog-network

rabbitmq:
  image: rabbitmq:4.0-management
  ports:
    - "5672:5672"    # AMQP protocol port
    - "15672:15672"  # Management UI port
  networks:
    - smolhog-network

volumes:
  postgres_data

networks:
  smolhog-network:
    driver: bridge
```

- **./migrations:/docker-entrypoint-initdb.d/** automatically runs SQL migration scripts when the container first starts, perfect for setting up event tables, indexes, and initial schema

- **postgres_data** creates a Docker-managed volume that persists independently of container lifecycles. This means the analytics data remains intact even during development container rebuilds.

- **smolhog-network** creates an isolated bridge network where all SmolHog services can communicate using service names as hostnames.

- **RabbitMQ** 4.0 with management plugin provides both messaging capabilities and a web-based monitoring interface

It's time to create our API-Gateway, for this we'll use Typescript and Express.js

## API Gateway :

Install the required dependencies using any of your favourite JavaScript/TypeScript runtimes and configure the dependencies like this.

`infra/backend/api-gateway/index.ts` is where we're writing the code for our API Gateway.

```ts
import cors from 'cors';
import express from "express";
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.PORT || 3001;
const API_URL = process.env.EVENT_PROCESSOR_URL || 'http://localhost:8000';

```

Adding the CORS Configuration

```ts
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', "OPTIONS"],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
```

Proxy Helper creates reusable proxy configuration with error handling and request/response logging.

```ts
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: "Welcome to SmolHog API Gateway" });
});

const createProxyOptions = (pathRewrite: { [key: string]: string }) => ({
    target: API_URL,
    changeOrigin: true,
    pathRewrite,
    onError: (err: Error, req: express.Request, res: express.Response) => {
        console.error('Proxy Error:', err.message);
        console.error('Target URL:', API_URL);
        console.error('Request URL:', req.url);
        res.status(500).json({ error: 'Proxy error', message: err.message });
    },
    onProxyReq: (proxyReq: any, req: express.Request, res: express.Response) => {
        Object.keys(req.headers).forEach(key => {
            proxyReq.setHeader(key, req.headers[key]);
        });
        console.log(`Proxying ${req.method} ${req.url} to ${API_URL}${proxyReq.path}`);
    }
});
```

Request Logging Middleware to log the incoming requests and outgoing responses for us to be able to track and monitor the Service.

```ts

app.use((req, res, next) => {
    const startTime = Date.now();

    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log(`Headers: ${JSON.stringify(req.headers, null, 2)}`);
    console.log(`Query: ${JSON.stringify(req.query, null, 2)}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log(`Body: ${JSON.stringify(req.body, null, 2)}`);
    }

    const originalEnd = res.end;
    res.end = function (chunk, encoding, cb) {
        const duration = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);

        if (res.statusCode >= 400) {
            console.error(`Error Response: Status ${res.statusCode}`);
            if (chunk) {
                console.error(`Error Body: ${chunk.toString()}`);
            }
        }

        return originalEnd.call(this, chunk, encoding, cb);
    };

    next();
});
```

Now we'll be adding the last part(code) of our API Gateway, which is mapping ports and configuring the routing. Our Event Processor has 3 routes `/events`, `/analytics/events` and `analytics/stats` , we're gonna map them to `/api/*` so that when someone hits the API Gateway's api endpoint we can redirect the request to our original Event Processor's endpoint.

```ts
app.use('/api/events', createProxyMiddleware(createProxyOptions({
    '^/': '/events'
})));

app.use('/api/analytics/events', createProxyMiddleware(createProxyOptions({
    '^/': '/analytics/events'
})));

app.use('/api/analytics/stats', createProxyMiddleware(createProxyOptions({
    '^/': '/analytics/stats'
})));

app.listen(PORT, () => {
    console.log(`SmolHog Gateway listening on http://localhost:${PORT}`);
    console.log(`Proxying requests to: ${API_URL}`);
});
```

We've completed the creation of our API Gateway and now it's time to containerise it, for this we'll create a `Dockerfile` in our `infra/backend/api-gateway` directory.

`infra/backend/api-gateway/Dockerfile`

```Dockerfile
FROM oven/bun:1.2.18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN bun install

FROM base
COPY . .
EXPOSE 3001
CMD ["bun", "run", "dev"]
```

And finally we'll add the `api-gateway` service to our `docker-compose.yml` file present at the very front, so that we can spawn every service at once with just one single command.

`docker-compose.yml`

```yml
postgres:
  image: postgres:latest
  environment:
    POSTGRES_DB: smolhog_analytics
    POSTGRES_USER: user
    POSTGRES_PASSWORD: password
  ports:
    - "5432:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./migrations:/docker-entrypoint-initdb.d/
  networks:
    - smolhog-network

rabbitmq:
  image: rabbitmq:4.0-management
  ports:
    - "5672:5672"    # AMQP protocol port
    - "15672:15672"  # Management UI port
  networks:
    - smolhog-network

  api-gateway:
    build:
      context: ./infra/backend/api-gateway
    ports:
      - "3001:3001"
    volumes:
      - ./infra/backend/api-gateway:/app
      - /app/node_modules
    environment:
      - EVENT_PROCESSOR_URL=http://event-processor:8000
    depends_on:
      - event-processor
    networks:
      - smolhog-network

volumes:
  postgres_data

networks:
  smolhog-network:
    driver: bridge
```

As you can tell our API Gateway service depends on the Event Processor, which we'll configure in the next part of this blog.




---
author: Deepraj Baidya
pubDatetime: 2025-09-02T15:22:00Z
title: Build your own Posthog - PART 3
slug: build-your-own-posthog-part-3
featured: false
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

description: Deep dive into the Event Processor and Worker architecture.
---

Welcome back to Part 3 of the SmolHog series! In this installment, we'll explore the **Event Processor** and **Workers** - the core data processing engines that transform raw analytics events into structured, queryable data.

If you missed the previous parts, we've already covered the [Project Overview](http://infms.dev/posts/build-your-own-posthog-part-1/) and [API Gateway](http://infms.dev/posts/build-your-own-posthog-part-2/) setup. Now, let's dive into the Python-powered backend services.

### The Event Processing Pipeline

Before we jump into code, let's understand how events flow through our system:

- API Gateway receives events from Flutter SDK
- Event Processor validates and queues events to RabbitMQ
- Workers consume queued events and persist them to PostgreSQL
- Analytics endpoints serve processed data to the dashboard

This decoupled architecture ensures high throughput and fault tolerance.


### Event Processor - FastAPI Service

The Event Processor is a FastAPI service that acts as the primary data ingestion point. 
Let's build it step by step.

#### Setting Up the FastAPI Application

- First, let's create our Event Processor in `infra/backend/event-processor/main.py`:

``` python
import json
import logging
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncpg
import aio_pika

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS configuration for web dashboard access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)

# Database and message broker configuration
DATABASE_URL = 'postgresql://user:password@postgres:5432/smolhog_analytics'
RABBITMQ_URL = 'amqp://guest:guest@rabbitmq:5672/'
```

- Data Models with `Pydantic`
These models ensure that incoming events have the correct structure and types, automatically rejecting malformed data.

``` python
class Event(BaseModel):
    event_id: str
    event_name: str
    user_id: str
    properties: Dict[str, Any] = {}
    timestamp: str
    session_id: Optional[str] = None
    
class EventBatch(BaseModel):
    events: List[Event]
```

- Event Ingestion Endpoint : The core functionality - receiving and queuing events.

``` python
@app.post("/events")
async def receive_events(
    event_batch: EventBatch,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    logger.info(f"Received {len(event_batch.events)} events")
    
    # Queue events for asynchronous processing
    background_tasks.add_task(queue_events, event_batch.events)
    
    return {
        "status": "success",
        "events_received": len(event_batch.events),
        "message": "Events queued for processing"
    }

```

- Key Design Decisions:

    - [x] Background Tasks: Events are queued asynchronously to avoid blocking the HTTP response
    - [x] Batch Processing: Accept multiple events in a single request for efficiency
    - [x] Fast Response: Return immediately after queuing, not after processing

- Analytics Query Endpoints : We also provide endpoints for the dashboard to query processed data.

``` python
@app.get('/analytics/stats')
async def get_stats() -> Dict[str, Any]:
    try:
        logger.info("Fetching analytics stats")
        conn = await asyncpg.connect(DATABASE_URL)
        
        total_events = await conn.fetchval("SELECT COUNT(*) FROM events")
        unique_users = await conn.fetchval("SELECT COUNT(DISTINCT user_id) FROM events")
        
        top_events = await conn.fetch(
            """
            SELECT event_name, COUNT(*) as event_count
            FROM events
            GROUP BY event_name
            ORDER BY event_count DESC
            LIMIT 10
            """
        )
        
        await conn.close()
        
        return {
            "total_events": total_events or 0,
            "unique_users": unique_users or 0,
            "top_events": [{"event": row['event_name'], "count": row['event_count']} for row in top_events]
        }
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/analytics/events')
async def get_recent_events(limit: int = 100) -> Dict[str, Any]:
    try:
        logger.info(f"Fetching {limit} recent events")
        conn = await asyncpg.connect(DATABASE_URL)
        
        events = await conn.fetch("""
            SELECT event_name, user_id, properties, timestamp, session_id
            FROM events 
            ORDER BY timestamp DESC 
            LIMIT $1
        """, limit)
        
        await conn.close()
        
        processed_events = []
        for row in events:
            processed_event = {
                "event_name": row['event_name'],
                "user_id": row['user_id'],
                "properties": json.loads(row['properties']) if isinstance(row['properties'], str) else row['properties'],
                "timestamp": row['timestamp'],
                "session_id": row['session_id']
            }
            processed_events.append(processed_event)
            
        return {"events": processed_events}
    except Exception as e:
        logger.error(f"Error getting events: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

- Message Queue Integration : Asynchronous processing - queuing events to RabbitMQ

``` python
async def queue_events(events: List[Event]):
    try:
        logger.info(f"Queuing {len(events)} events to RabbitMQ")
        conn = await aio_pika.connect_robust(RABBITMQ_URL)
        chan = await conn.channel()
        queue = await chan.declare_queue('events', durable=True)
        
        for event in events:
            message = aio_pika.Message(
                json.dumps(event.dict()).encode(),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT
            )
            await chan.default_exchange.publish(message, routing_key="events")
        
        await conn.close()
        logger.info(f"Successfully queued {len(events)} events")
        
    except Exception as e:
        logger.error(f"Error queuing events: {e}")
```

- Important Features:
 - [x]Durable Queues: Events survive RabbitMQ restarts
 - [x]Persistent Messages: Individual messages are persisted to disk
 - [x]Robust Connection: Automatic reconnection on network failures


### Worker Service - Background Event Processing
Now let's create the Worker service that consumes events from RabbitMQ and persists them to PostgreSQL.

#### Worker Architecture

- Create `infra/backend/workers/worker.py`:

``` python
import asyncio
import json
import asyncpg
import aio_pika
from aio_pika.abc import AbstractIncomingMessage 
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = "postgresql://user:password@postgres:5432/smolhog_analytics"
RABBITMQ_URL = "amqp://guest:guest@rabbitmq:5672/"
```

- Main Processing Loop:

``` python
async def process_events():
    logger.info("Worker starting...")
    
    try:
        # Connect to RabbitMQ
        logger.info("Connecting to RabbitMQ...")
        conn = await aio_pika.connect_robust(RABBITMQ_URL)
        chan = await conn.channel()
        queue = await chan.declare_queue("events", durable=True)
        logger.info("Connected to RabbitMQ successfully")
        
        # Connect to PostgreSQL
        logger.info("Connecting to PostgreSQL...")
        db_conn = await asyncpg.connect(DATABASE_URL)
        logger.info("Connected to PostgreSQL successfully")
        
        async def handle_message(message: AbstractIncomingMessage) -> None:  
            async with message.process():
                try:
                    event_data = json.loads(message.body.decode())
                    logger.info(f"Processing event: {event_data['event_name']}")
                    
                    await db_conn.execute("""
                        INSERT INTO events (event_id, event_name, user_id, properties, timestamp, session_id)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT (event_id) DO NOTHING
                    """, 
                        event_data['event_id'],
                        event_data['event_name'],
                        event_data['user_id'],
                        json.dumps(event_data['properties']),
                        datetime.fromisoformat(event_data['timestamp'].replace('Z', '+00:00')),
                        event_data.get('session_id')
                    )
                    
                    logger.info(f"Successfully processed event: {event_data['event_name']}")
                    
                except Exception as e:
                    logger.error(f"Error processing event: {e}")
                    raise
        
        # Start consuming messages
        await queue.consume(handle_message)
        logger.info("Worker started successfully, waiting for events...")
        
        try:
            await asyncio.Future()  # Run forever
        finally:
            await db_conn.close()
            await conn.close()
            
    except Exception as e:
        logger.error(f"Worker failed to start: {e}")
        await asyncio.sleep(5)
        raise
```

- Key Worker Features:
    - [x] Message Acknowledgment: Only acknowledge messages after successful database insertion
    - [x] Idempotent Processing: ON CONFLICT DO NOTHING prevents duplicate events
    - [x] Connection Management: Robust connection handling for both RabbitMQ and PostgreSQL
    - [x] Error Handling: Proper error propagation and retry logic
    
    
### Containerization :

- Event Processor Dockerfile (`infra/backend/event-processor/Dockerfile`)
``` Dockerfile
FROM python:3.11-alpine AS base
RUN apk add --no-cache gcc musl-dev libffi-dev
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir --disable-pip-version-check \
    -r requirements.txt

FROM base
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
```

- Worker Dockerfile (`infra/backend/workers/Dockerfile`)

``` Dockerfile
FROM python:3.11-alpine AS base
RUN apk add --no-cache gcc musl-dev libffi-dev
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir --disable-pip-version-check \
    -r requirements.txt && \
    pip install --no-cache-dir watchdog celery[redis]

FROM base
COPY . .
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV C_FORCE_ROOT=1
CMD ["python", "worker.py"]
```


### PostgreSQL Schema

- `migrations/001_initial_schema.py`
``` sql
-- migrations/001_initial_schema.sql
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    properties JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL,
    session_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- Analytics view for common queries
CREATE OR REPLACE VIEW event_summary AS
SELECT 
    event_name,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users,
    DATE_TRUNC('day', timestamp) as day
FROM events 
GROUP BY event_name, DATE_TRUNC('day', timestamp)
ORDER BY day DESC;
```


### docker-compose.yml
Update your docker-compose.yml to include the new services:

``` yml 
event-processor:
  build: 
    context: ./infra/backend/event-processor
  ports:
    - "8000:8000"
  volumes:
    - ./infra/backend/event-processor:/app
    - /app/__pycache__
  depends_on:
    postgres:
      condition: service_healthy
    rabbitmq:
      condition: service_healthy
  networks:
    - smolhog-network

worker:
  build: 
    context: ./infra/backend/workers
    target: development
  volumes:
    - ./infra/backend/workers:/app
    - /app/__pycache__
  environment:
    - PYTHONUNBUFFERED=1
    - WATCHDOG_USE_POLLING=true
  depends_on:
    postgres:
      condition: service_healthy
    rabbitmq:
      condition: service_healthy
  networks:
    - smolhog-network
```


### Start the Service

``` bash
docker compose up -d 
sqlx migrate run --database-url "postgresql://user:password@localhost:5432/smolhog_analytics"
```

Your Event Processor should now be running on port 8000, ready to receive events from the API Gateway and process them through the worker pipeline.

In Part 4, we'll build the Flutter SDK that clients use to send events, and in Part 5, we'll create the analytics dashboard. Stay tuned!

Till then, Happy Coding! 🚀
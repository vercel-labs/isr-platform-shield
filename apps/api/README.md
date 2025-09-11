# API Service

A simple Next.js API that serves blog posts for the durable ISR proof of concept.

## What it does

- Serves blog posts from a JSON data file
- Provides two endpoints for the core app

## API Endpoints

### Get Post by ID
```
GET /posts?id={id}
```
Returns a specific blog post with author information.

### Get Random Posts
```
GET /posts?random=true
```
Returns 5 random blog posts with author information.

## Development

```bash
npm run dev
```

The API runs on port 3000 by default.
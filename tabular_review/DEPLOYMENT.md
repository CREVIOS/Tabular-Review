# Deployment Guide

## Prerequisites

1. **Docker & Docker Compose** installed
2. **Environment variables** configured (see `.env` file)
3. **API Keys** for AI services (Gemini/OpenAI)
4. **Supabase project** (or PostgreSQL database)

## Environment Configuration

The application uses a comprehensive `.env` file for configuration. Copy and customize the provided `.env` file:

```bash
cp .env.example .env  # If you have an example file
# OR use the provided .env file and customize as needed
```

### Key Environment Variables

```env
# =============================================================================
# CORE APPLICATION SETTINGS
# =============================================================================
ENVIRONMENT=development  # or 'production'
DEBUG=true              # Set to 'false' in production
PORT=8000

# =============================================================================
# SECURITY CONFIGURATION
# =============================================================================
SECRET_KEY=your-very-secure-secret-key-minimum-32-characters
JWT_SECRET=your-very-secure-secret-key-minimum-32-characters

# =============================================================================
# SUPABASE CONFIGURATION
# =============================================================================
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# =============================================================================
# AI SERVICE CONFIGURATION
# =============================================================================
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key

# =============================================================================
# FRONTEND CONFIGURATION
# =============================================================================
NEXT_PUBLIC_API_URL=http://localhost:8000  # or your production URL
USE_NGINX_PROXY=false                       # Set to 'true' when using nginx
```

## Development Setup

### Basic Development (Recommended)

```bash
# Start core services
docker-compose up -d

# Services will be available at:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:8000
# - Redis: localhost:6379
```

### Development with Monitoring

```bash
# Start with Celery Flower monitoring
docker-compose --profile monitoring up -d

# Additional service:
# - Celery Flower: http://localhost:5555
```

### Development with Scheduler

```bash
# Start with Celery Beat scheduler for periodic tasks
docker-compose --profile with-scheduler up -d
```

### Development with Local PostgreSQL

```bash
# Start with local PostgreSQL instead of Supabase
docker-compose --profile with-postgres up -d

# Additional service:
# - PostgreSQL: localhost:5432
```

## Production Setup

### Production with Nginx Reverse Proxy

```bash
# Start with nginx reverse proxy
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile production up -d

# Services will be available at:
# - Application: http://localhost (nginx proxy)
# - Direct backend: http://localhost:8000 (if needed)
```

### Full Production Stack

```bash
# Start all production services with monitoring and scheduling
docker-compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --profile production \
  --profile monitoring \
  --profile with-scheduler \
  up -d
```

## Service Profiles

The application uses Docker Compose profiles for different deployment scenarios:

- **Default**: Core services (redis, backend, celery-worker, frontend)
- **`monitoring`**: Adds Celery Flower for task monitoring
- **`with-scheduler`**: Adds Celery Beat for periodic tasks
- **`with-postgres`**: Adds local PostgreSQL database
- **`production`**: Adds nginx reverse proxy

## Health Checks

All services include comprehensive health checks:

- **Frontend**: `GET /api/health`
- **Backend**: `GET /docs` (FastAPI documentation)
- **Redis**: Redis ping command
- **PostgreSQL**: `pg_isready` command

## Environment-Specific Configurations

### Development Environment

```env
ENVIRONMENT=development
DEBUG=true
NEXT_PUBLIC_API_URL=http://localhost:8000
USE_NGINX_PROXY=false
```

### Production Environment

```env
ENVIRONMENT=production
DEBUG=false
NEXT_PUBLIC_API_URL=https://your-domain.com  # or http://localhost if using nginx
USE_NGINX_PROXY=true
```

## Performance Settings

Adjust these based on your server capacity:

```env
MAX_CONCURRENT_EXTRACTIONS=20
MAX_UPLOAD_SIZE_MB=50
CHUNK_SIZE_TOKENS=800
EMBEDDING_BATCH_SIZE=20
```

## SSL Configuration (Production)

For HTTPS in production:

1. Place SSL certificates in `./nginx/ssl/`
2. Update `nginx/nginx.conf` with SSL configuration:

```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    # ... rest of configuration
}
```

## Scaling Services

Scale individual services based on load:

```bash
# Scale celery workers
docker-compose up -d --scale celery-worker=3

# Scale frontend instances (behind nginx)
docker-compose up -d --scale frontend=2
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 8000, 6379, 5432, 5555 are available
2. **Environment variables**: Verify all required variables are set in `.env`
3. **API keys**: Ensure Gemini/OpenAI keys are valid and have sufficient quota
4. **Supabase**: Verify Supabase URL and keys are correct

### Logs

View service logs:

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f celery-worker
docker-compose logs -f frontend
```

### Service Status

Check service health:

```bash
# Service status
docker-compose ps

# Health check status
docker-compose exec backend curl -f http://localhost:8000/docs
docker-compose exec frontend curl -f http://localhost:3000/api/health
```

## Backup and Maintenance

### Database Backup (if using PostgreSQL)

```bash
# Backup
docker-compose exec postgres pg_dump -U postgres tabular_review > backup.sql

# Restore
docker-compose exec -T postgres psql -U postgres tabular_review < backup.sql
```

### Volume Management

```bash
# List volumes
docker volume ls

# Backup uploads
docker run --rm -v tabular_review_backend-uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads-backup.tar.gz -C /data .

# Restore uploads
docker run --rm -v tabular_review_backend-uploads:/data -v $(pwd):/backup alpine tar xzf /backup/uploads-backup.tar.gz -C /data
```

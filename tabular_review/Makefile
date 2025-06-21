.PHONY: help build up down logs dev prod clean backup

# Default target
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Development
dev: ## Start development environment
	docker compose up -d redis postgres backend celery-worker frontend
	@echo "Services started! Frontend: http://localhost:3000, Backend: http://localhost:8000"

dev-logs: ## Follow development logs
	docker compose logs -f backend celery-worker frontend

# Production
prod: ## Start production environment with nginx
	docker compose --profile production up -d
	@echo "Production environment started! Access: http://localhost"

prod-monitoring: ## Start production with monitoring (Flower)
	docker compose --profile production --profile monitoring up -d
	@echo "Production + monitoring started! App: http://localhost, Monitoring: http://localhost:5555"

# Build
build: ## Build all Docker images
	docker compose build

build-clean: ## Build all images without cache
	docker compose build --no-cache

# Control
up: ## Start all core services
	docker compose up -d

down: ## Stop all services
	docker compose down

stop: ## Stop services without removing containers
	docker compose stop

restart: ## Restart all services
	docker compose restart

# Logs and monitoring
logs: ## Show logs from all services
	docker compose logs

logs-follow: ## Follow logs from all services
	docker compose logs -f

logs-backend: ## Show backend logs
	docker compose logs backend

logs-celery: ## Show celery worker logs
	docker compose logs celery-worker

status: ## Show status of all services
	docker compose ps

# Database operations
db-backup: ## Backup PostgreSQL database
	@mkdir -p backups
	docker compose exec -T postgres pg_dump -U postgres tabular_review > backups/backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "Database backup created in backups/ directory"

db-restore: ## Restore database from backup (usage: make db-restore BACKUP=backup_file.sql)
	@if [ -z "$(BACKUP)" ]; then echo "Usage: make db-restore BACKUP=backup_file.sql"; exit 1; fi
	docker compose exec -T postgres psql -U postgres tabular_review < $(BACKUP)
	@echo "Database restored from $(BACKUP)"

db-shell: ## Connect to PostgreSQL shell
	docker compose exec postgres psql -U postgres tabular_review

# Redis operations
redis-shell: ## Connect to Redis CLI
	docker compose exec redis redis-cli

redis-monitor: ## Monitor Redis commands
	docker compose exec redis redis-cli monitor

# Application operations
backend-shell: ## Open shell in backend container
	docker compose exec backend bash

frontend-shell: ## Open shell in frontend container
	docker compose exec frontend sh

celery-status: ## Check Celery worker status
	docker compose exec celery-worker celery -A celery_app inspect active

celery-purge: ## Purge all Celery tasks
	docker compose exec celery-worker celery -A celery_app purge

# Maintenance
clean: ## Remove stopped containers and unused images
	docker system prune -f

clean-all: ## Remove everything including volumes (⚠️  DELETES DATA)
	docker compose down -v
	docker system prune -a -f

update: ## Pull latest images and restart
	docker compose pull
	docker compose up -d

# Environment setup
setup: ## Initial setup - copy env file and build images
	@if [ ! -f .env ]; then cp env.example .env; echo "Created .env file - please edit with your configuration"; fi
	$(MAKE) build
	@echo "Setup complete! Edit .env file and run 'make dev' to start"

# Testing
test-backend: ## Run backend tests
	docker compose exec backend python -m pytest

test-frontend: ## Run frontend tests
	docker compose exec frontend npm test

# Security scan
security-scan: ## Scan images for vulnerabilities
	@which trivy > /dev/null || (echo "Install trivy first: https://github.com/aquasecurity/trivy" && exit 1)
	trivy image tabular_review-backend
	trivy image tabular_review-frontend

# Performance
scale-workers: ## Scale Celery workers (usage: make scale-workers WORKERS=3)
	@if [ -z "$(WORKERS)" ]; then echo "Usage: make scale-workers WORKERS=3"; exit 1; fi
	docker compose up -d --scale celery-worker=$(WORKERS)
	@echo "Scaled Celery workers to $(WORKERS) instances"

# Documentation
docs: ## Open API documentation
	@echo "Opening API documentation..."
	@python -c "import webbrowser; webbrowser.open('http://localhost:8000/docs')" 2>/dev/null || echo "API docs: http://localhost:8000/docs" 
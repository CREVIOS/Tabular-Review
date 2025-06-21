#!/bin/bash

# Tabular Review - Quick Deployment Script
set -e

echo "🚀 Tabular Review - Docker Deployment"
echo "======================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📋 Creating environment file..."
    cp env.example .env
    echo "✅ Created .env file from template"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env file with your configuration:"
    echo "   - GEMINI_API_KEY: Your Google Gemini API key"
    echo "   - SUPABASE_URL: Your Supabase project URL"
    echo "   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key"
    echo "   - JWT_SECRET: A secure random string for JWT signing"
    echo "   - POSTGRES_PASSWORD: A secure password for PostgreSQL"
    echo ""
    read -p "Press Enter to continue after editing .env file..."
fi

# Function to check if a service is healthy
check_service() {
    local service=$1
    local max_attempts=30
    local attempt=1
    
    echo "Checking $service health..."
    while [ $attempt -le $max_attempts ]; do
        if docker compose ps $service | grep -q "healthy\|Up"; then
            echo "✅ $service is healthy"
            return 0
        fi
        echo "⏳ Waiting for $service... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    echo "❌ $service failed to start properly"
    return 1
}

# Parse command line arguments
MODE="dev"
MONITORING=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --prod|--production)
            MODE="prod"
            shift
            ;;
        --monitoring)
            MONITORING=true
            shift
            ;;
        --clean)
            echo "🧹 Cleaning up existing containers and images..."
            docker compose down -v 2>/dev/null || true
            docker system prune -f
            echo "✅ Cleanup complete"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --prod, --production  Deploy in production mode with nginx"
            echo "  --monitoring          Include Celery Flower monitoring"
            echo "  --clean              Clean up before deployment"
            echo "  --help, -h           Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                   # Development mode"
            echo "  $0 --prod            # Production mode"
            echo "  $0 --prod --monitoring  # Production with monitoring"
            echo "  $0 --clean --prod    # Clean and deploy production"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🔧 Building Docker images..."
docker compose build

echo "🚀 Starting services in $MODE mode..."

if [ "$MODE" = "prod" ]; then
    if [ "$MONITORING" = true ]; then
        docker compose --profile production --profile monitoring up -d
        echo "🎯 Production mode with monitoring enabled"
    else
        docker compose --profile production up -d
        echo "🎯 Production mode enabled"
    fi
else
    docker compose up -d redis postgres backend celery-worker frontend
    echo "🛠️  Development mode enabled"
fi

echo ""
echo "⏳ Waiting for services to start..."

# Check core services
check_service "redis"
# check_service "postgres"
check_service "backend"
check_service "celery-worker"
check_service "frontend"

if [ "$MODE" = "prod" ]; then
    check_service "nginx"
fi

if [ "$MONITORING" = true ]; then
    check_service "celery-flower"
fi

echo ""
echo "🎉 Deployment complete!"
echo "===================="

if [ "$MODE" = "prod" ]; then
    echo "🌐 Application: http://localhost"
    echo "📚 API Documentation: http://localhost/docs"
    if [ "$MONITORING" = true ]; then
        echo "📊 Task Monitoring: http://localhost:5555"
    fi
else
    echo "🌐 Frontend: http://localhost:3000"
    echo "🔧 Backend API: http://localhost:8000"
    echo "📚 API Documentation: http://localhost:8000/docs"
fi

echo ""
echo "📋 Useful commands:"
echo "  docker compose logs -f          # Follow all logs"
echo "  docker compose ps               # Check service status"
echo "  docker compose down             # Stop all services"
echo "  make help                       # Show all available commands"

echo ""
echo "🔍 To view logs:"
echo "  docker compose logs -f backend celery-worker"

# Show service status
echo ""
echo "📊 Service Status:"
docker compose ps

echo ""
echo "✅ All services are running! Your Tabular Review application is ready." 
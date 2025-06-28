#!/bin/bash

echo "🚀 Starting Tabular Review in Development Mode..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file with your configuration."
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running!"
    echo "Please start Docker and try again."
    exit 1
fi

echo "📋 Starting core services..."
echo "   - Redis (Message Broker)"
echo "   - Backend API (FastAPI)"
echo "   - Celery Worker (Task Processing)"
echo "   - Frontend (Next.js)"
echo ""

# Start the services
docker-compose up -d

# Check if services started successfully
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Services started successfully!"
    echo ""
    echo "🌐 Access your application:"
    echo "   - Frontend: http://localhost:3000"
    echo "   - Backend API: http://localhost:8000"
    echo "   - API Docs: http://localhost:8000/docs"
    echo ""
    echo "📊 Optional monitoring (run separately):"
    echo "   docker-compose --profile monitoring up -d"
    echo "   - Celery Flower: http://localhost:5555"
    echo ""
    echo "📝 View logs:"
    echo "   docker-compose logs -f"
    echo ""
    echo "🛑 Stop services:"
    echo "   docker-compose down"
else
    echo ""
    echo "❌ Failed to start services!"
    echo "Check the error messages above."
    exit 1
fi

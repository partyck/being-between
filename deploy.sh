#!/bin/bash
# deploy.sh - Production deployment script for Being, Between

echo "🚀 Deploying Being, Between Avatar System"
echo "=========================================="

# Confirmation
read -p "�� Deploy to production? This will stop any running containers. (y/N): " confirm
if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

echo ""
echo "🛑 Stopping existing containers..."
docker-compose down

echo ""
echo "🧹 Cleaning up old images..."
docker-compose down --remove-orphans

echo ""
echo "🏗️  Building fresh production images..."
if docker-compose build --no-cache; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "🚀 Starting production deployment..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 15

echo ""
echo "🏥 Health check..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services are running"
    docker-compose ps
else
    echo "❌ Some services failed to start"
    docker-compose ps
    echo ""
    echo "📋 Logs:"
    docker-compose logs
    exit 1
fi

echo ""
echo "🌐 Testing endpoints..."
sleep 5

# Test main server
if curl -f -s http://localhost:8080/?deviceid=1 > /dev/null; then
    echo "✅ Main server is responding"
else
    echo "⚠️  Main server not responding yet (may still be starting)"
fi

echo ""
echo "🎭 Production deployment complete!"
echo ""
echo "🌐 System endpoints:"
echo "  Device 1: http://localhost:8080/?deviceid=1"
echo "  Device 2: http://localhost:8080/?deviceid=2"
echo ""
echo "📊 Monitor with:"
echo "  docker-compose logs -f          # Follow logs"
echo "  docker-compose ps               # Check status"
echo "  ./troubleshoot.sh               # Run diagnostics"
echo ""
echo "🛑 Stop with:"
echo "  docker-compose down"
echo ""
echo "💡 Tip: Use 'docker-compose logs -f' to monitor the system"

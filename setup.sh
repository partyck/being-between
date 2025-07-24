#!/bin/bash
# setup.sh - Initial setup script for Being, Between Avatar Integration

echo "🎭 Being, Between - Avatar Integration Setup"
echo "=================================================="

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p avatar_system/avatar_videos
mkdir -p logs
mkdir -p nginx

# Create logs directory with proper permissions
chmod 755 logs 2>/dev/null || true

echo "✅ Directory structure created"

# Check for required files
echo "🔍 Checking avatar videos..."
video_count=$(find avatar_system/avatar_videos -name "*.mp4" 2>/dev/null | wc -l)
if [ "$video_count" -lt 6 ]; then
    echo "⚠️  Avatar videos not found ($video_count/6)!"
    echo "Please add your avatar videos to avatar_system/avatar_videos/:"
    echo "  - device1_neutral.mp4"
    echo "  - device1_wave.mp4" 
    echo "  - device1_smile.mp4"
    echo "  - device2_neutral.mp4"
    echo "  - device2_wave.mp4"
    echo "  - device2_smile.mp4"
else
    echo "✅ Found $video_count avatar videos"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found! Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found! Please install Docker Compose first."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose found"

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running! Please start Docker Desktop."
    exit 1
fi

echo "✅ Docker is running"

echo ""
echo "🚀 Setup complete! Next steps:"
echo "1. Add your avatar videos to avatar_system/avatar_videos/"
echo "2. Run: ./test.sh (to test the system)"
echo "3. If tests pass, run: ./deploy.sh"
echo ""
echo "📁 Current project structure:"
ls -la


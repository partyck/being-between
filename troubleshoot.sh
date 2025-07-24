#!/bin/bash
# troubleshoot.sh - Troubleshooting script for Being, Between

echo "🔧 Being, Between Troubleshooting"
echo "=================================="

echo "📅 Current time: $(date)"
echo ""

echo "📊 Docker System Status:"
echo "------------------------"
docker --version
docker-compose --version
echo ""

echo "🐳 Container Status:"
echo "-------------------"
if docker-compose ps 2>/dev/null; then
    docker-compose ps
else
    echo "❌ No containers found or docker-compose.yml missing"
fi
echo ""

echo "🔌 Network Connectivity:"
echo "------------------------"
echo "Testing main server port (8080)..."
if nc -z localhost 8080 2>/dev/null; then
    echo "✅ Port 8080 is accessible"
else
    echo "❌ Port 8080 is not accessible"
    echo "Checking what's using port 8080:"
    lsof -i :8080 2>/dev/null || echo "Nothing found on port 8080"
fi

echo ""
echo "Testing avatar server port (8765)..."
if nc -z localhost 8765 2>/dev/null; then
    echo "✅ Port 8765 is accessible"
else
    echo "❌ Port 8765 is not accessible"
    echo "Checking what's using port 8765:"
    lsof -i :8765 2>/dev/null || echo "Nothing found on port 8765"
fi

echo ""
echo "📋 Recent Logs:"
echo "--------------"
echo "=== Main Server (last 20 lines) ==="
docker-compose logs --tail=20 main-server 2>/dev/null || echo "Main server logs not available"

echo ""
echo "=== Avatar Server (last 20 lines) ==="
docker-compose logs --tail=20 avatar-server 2>/dev/null || echo "Avatar server logs not available"

echo ""
echo "💾 Disk Usage:"
echo "-------------"
df -h . 2>/dev/null || echo "Disk usage check failed"

echo ""
echo "🐳 Docker Resources:"
echo "-------------------"
docker system df 2>/dev/null || echo "Docker system info not available"

echo ""
echo "📹 Avatar Videos:"
echo "----------------"
if [ -d "avatar_system/avatar_videos" ]; then
    video_count=$(find avatar_system/avatar_videos -name "*.mp4" 2>/dev/null | wc -l)
    echo "Found $video_count video files:"
    find avatar_system/avatar_videos -name "*.mp4" -exec ls -lh {} \; 2>/dev/null || echo "No videos found"
else
    echo "❌ avatar_system/avatar_videos directory not found"
fi

echo ""
echo "📁 Project Structure:"
echo "--------------------"
echo "Current directory: $(pwd)"
echo "Files in project root:"
ls -la . 2>/dev/null | head -20

echo ""
echo "🔧 Common Solutions:"
echo "==================="
echo ""
echo "🚨 If containers won't start:"
echo "   1. Check if ports 8080/8765 are in use:"
echo "      lsof -i :8080"
echo "      lsof -i :8765"
echo "   2. Restart Docker Desktop"
echo "   3. Clean Docker system:"
echo "      docker system prune"
echo "   4. Rebuild containers:"
echo "      docker-compose build --no-cache"
echo ""
echo "🚨 If avatar server connection fails:"
echo "   1. Check avatar server is running:"
echo "      docker-compose ps"
echo "   2. Check avatar server logs:"
echo "      docker-compose logs avatar-server"
echo "   3. Restart just avatar server:"
echo "      docker-compose restart avatar-server"
echo ""
echo "🚨 If browser shows errors:"
echo "   1. Open browser console (F12) and check for errors"
echo "   2. Try different browser or incognito mode"
echo "   3. Clear browser cache"
echo "   4. Check if JavaScript is enabled"
echo ""
echo "🚨 If videos don't work:"
echo "   1. Check static videos exist:"
echo "      ls -la static/*.mp4"
echo "   2. Check avatar videos:"
echo "      ls -la avatar_system/avatar_videos/*.mp4"
echo "   3. Verify video formats are supported (MP4 recommended)"
echo ""
echo "📞 Emergency commands:"
echo "   Stop everything:     docker-compose down"
echo "   View all logs:       docker-compose logs"
echo "   Restart service:     docker-compose restart [service-name]"
echo "   Force rebuild:       docker-compose build --no-cache"
echo ""
echo "🔧 Troubleshooting complete!"
echo ""
echo "💡 If you're still having issues:"
echo "   1. Run: docker-compose logs"
echo "   2. Check the console in your browser (F12)"
echo "   3. Verify all files are in the correct locations"

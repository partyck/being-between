#!/bin/bash
# test.sh - Test script for Being, Between Avatar Integration

echo "🧪 Testing Being, Between Avatar Integration"
echo "=============================================="

# Test 1: Check if required files exist
echo "📋 Test 1: Checking required files..."
required_files=("main.py" "static/index.html" "static/script.js" "Dockerfile" "requirements.txt")
all_files_exist=true

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ Found: $file"
    else
        echo "❌ Missing: $file"
        all_files_exist=false
    fi
done

if [ "$all_files_exist" = false ]; then
    echo "❌ Some required files are missing. Please check your project structure."
    exit 1
fi

# Test 2: Check avatar system files
echo ""
echo "🤖 Test 2: Checking avatar system files..."
avatar_files=("avatar_system/avatar_server.py" "avatar_system/requirements_avatar.txt" "avatar_system/Dockerfile.avatar")
avatar_files_exist=true

for file in "${avatar_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ Found: $file"
    else
        echo "❌ Missing: $file"
        echo "   Please create this file as described in the setup guide"
        avatar_files_exist=false
    fi
done

# Test 3: Check Docker Compose file
echo ""
echo "🐳 Test 3: Checking Docker Compose..."
if [ -f "docker-compose.yml" ]; then
    echo "✅ Found: docker-compose.yml"
    
    # Validate Docker Compose syntax
    if docker-compose config > /dev/null 2>&1; then
        echo "✅ Docker Compose syntax is valid"
    else
        echo "❌ Docker Compose syntax error:"
        docker-compose config
        exit 1
    fi
else
    echo "❌ Missing: docker-compose.yml"
    echo "   Please create this file as described in the setup guide"
    exit 1
fi

# Test 4: Check avatar videos (optional)
echo ""
echo "📹 Test 4: Checking avatar videos..."
video_count=$(find avatar_system/avatar_videos -name "*.mp4" 2>/dev/null | wc -l)
if [ "$video_count" -ge 6 ]; then
    echo "✅ Found $video_count avatar videos"
    find avatar_system/avatar_videos -name "*.mp4" -exec echo "  - {}" \;
elif [ "$video_count" -gt 0 ]; then
    echo "⚠️  Found $video_count avatar videos (expected 6)"
    echo "   System will create placeholders for missing videos"
    find avatar_system/avatar_videos -name "*.mp4" -exec echo "  - {}" \;
else
    echo "⚠️  No avatar videos found"
    echo "   System will create placeholder videos for testing"
fi

# Test 5: Try building containers (if avatar files exist)
if [ "$avatar_files_exist" = true ]; then
    echo ""
    echo "🏗️  Test 5: Building containers..."
    
    echo "Building main server..."
    if docker-compose build main-server > /dev/null 2>&1; then
        echo "✅ Main server build successful"
    else
        echo "❌ Main server build failed"
        echo "Showing build logs:"
        docker-compose build main-server
        exit 1
    fi
    
    echo "Building avatar server..."
    if docker-compose build avatar-server > /dev/null 2>&1; then
        echo "✅ Avatar server build successful"
    else
        echo "❌ Avatar server build failed"
        echo "Showing build logs:"
        docker-compose build avatar-server
        exit 1
    fi
    
    # Test 6: Quick start test
    echo ""
    echo "🚀 Test 6: Quick system test..."
    echo "Starting containers..."
    docker-compose up -d
    
    echo "Waiting for services to start..."
    sleep 10
    
    # Check if containers are running
    if docker-compose ps | grep -q "Up"; then
        echo "✅ Containers are running"
        docker-compose ps
    else
        echo "❌ Containers failed to start"
        docker-compose ps
        echo ""
        echo "Showing logs:"
        docker-compose logs
        exit 1
    fi
    
    # Test HTTP endpoints
    echo ""
    echo "🌐 Testing HTTP endpoints..."
    
    # Wait a bit more for services to be ready
    sleep 5
    
    if curl -f -s http://localhost:8080/?deviceid=1 > /dev/null; then
        echo "✅ Main server HTTP endpoint working"
    else
        echo "❌ Main server HTTP endpoint not responding"
        echo "Checking if port is in use..."
        if lsof -i :8080; then
            echo "Port 8080 is in use by another process"
        fi
    fi
    
    echo "✅ All tests completed!"
    
    echo ""
    echo "🌐 Your system is running at:"
    echo "  Device 1: http://localhost:8080/?deviceid=1"
    echo "  Device 2: http://localhost:8080/?deviceid=2"
    echo ""
    echo "📋 System status:"
    docker-compose ps
    
    echo ""
    echo "🛑 To stop the test environment:"
    echo "  docker-compose down"
    
else
    echo ""
    echo "⚠️  Skipping container tests - avatar system files not ready"
    echo "   Please create the missing avatar system files first"
fi

echo ""
echo "🎉 Testing complete!"


# avatar_system/avatar_server.py - Production-ready avatar server

import asyncio
import websockets
import json
import cv2
import base64
import numpy as np
import os
import time
import logging
import random
from pathlib import Path

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MinimalAvatarServer:
    def __init__(self):
        # Configuration
        self.video_folder = Path("avatar_videos")
        self.port = 8765
        self.host = "0.0.0.0"
        
        # Device-specific video mapping
        self.device_videos = {
            1: {
                "neutral": "device1_neutral.mp4",
                "wave": "device1_wave.mp4", 
                "smile": "device1_smile.mp4"
            },
            2: {
                "neutral": "device2_neutral.mp4",
                "wave": "device2_wave.mp4",
                "smile": "device2_smile.mp4"
            }
        }
        
        # Runtime state
        self.connected_clients = {}
        self.device_states = {1: "neutral", 2: "neutral"}
        self.video_frames = {}
        self.frame_indices = {}
        
        # Load all videos into memory
        self.load_all_videos()
        
        logger.info("🤖 Minimal Avatar Server initialized")
    
    def load_all_videos(self):
        """Load all avatar videos into memory for instant access"""
        logger.info("📹 Loading avatar videos...")
        
        for device_id, videos in self.device_videos.items():
            self.video_frames[device_id] = {}
            self.frame_indices[device_id] = {}
            
            for reaction, filename in videos.items():
                video_path = self.video_folder / filename
                
                if video_path.exists():
                    frames = self.load_video_frames(video_path)
                    if frames:
                        self.video_frames[device_id][reaction] = frames
                        self.frame_indices[device_id][reaction] = 0
                        logger.info(f"✅ Loaded {len(frames)} frames: {filename}")
                    else:
                        logger.warning(f"⚠️ Failed to load frames from: {filename}")
                        self.create_placeholder_video(device_id, reaction)
                else:
                    logger.warning(f"❌ Video not found: {video_path}")
                    self.create_placeholder_video(device_id, reaction)
        
        logger.info(f"📹 Video loading complete. Devices: {list(self.video_frames.keys())}")
    
    def load_video_frames(self, video_path):
        """Load video frames into memory"""
        try:
            frames = []
            cap = cv2.VideoCapture(str(video_path))
            
            if not cap.isOpened():
                logger.error(f"Cannot open video: {video_path}")
                return None
            
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            logger.info(f"Loading {frame_count} frames from {video_path.name}")
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Resize frame for performance (optional)
                # frame = cv2.resize(frame, (640, 480))
                frames.append(frame)
            
            cap.release()
            return frames
            
        except Exception as e:
            logger.error(f"Error loading video {video_path}: {e}")
            return None
    
    def create_placeholder_video(self, device_id, reaction):
        """Create placeholder frames if video is missing"""
        logger.info(f"Creating placeholder for device {device_id} {reaction}")
        
        frames = []
        colors = {
            "neutral": (80, 80, 80),
            "wave": (100, 150, 255),
            "smile": (255, 200, 100)
        }
        
        color = colors.get(reaction, (80, 80, 80))
        
        # Create 3 seconds of frames at 30fps
        for i in range(90):
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            frame[:] = color
            
            # Add text
            text = f"Device {device_id} - {reaction.title()}"
            cv2.putText(frame, text, (150, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
            cv2.putText(frame, f"Frame {i}", (150, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 1)
            
            # Add animation
            pulse = int(50 * (1 + 0.3 * np.sin(i * 0.2)))
            cv2.circle(frame, (320, 300), pulse, (255, 255, 255), 2)
            
            frames.append(frame)
        
        # Store placeholder
        if device_id not in self.video_frames:
            self.video_frames[device_id] = {}
            self.frame_indices[device_id] = {}
        
        self.video_frames[device_id][reaction] = frames
        self.frame_indices[device_id][reaction] = 0
    
    async def handle_client(self, websocket, path):
        """Handle WebSocket connections from main system"""
        client_address = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        client_id = f"client_{len(self.connected_clients)}_{int(time.time())}"
        
        self.connected_clients[client_id] = {
            "websocket": websocket,
            "address": client_address,
            "connected_at": time.time(),
            "device_id": None
        }
        
        logger.info(f"👤 Avatar client connected: {client_id} from {client_address}")
        
        try:
            # Send welcome message
            await websocket.send(json.dumps({
                "type": "welcome",
                "client_id": client_id,
                "server_status": "ready",
                "available_devices": list(self.device_videos.keys())
            }))
            
            # Process messages
            async for message in websocket:
                await self.process_message(message, client_id)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"👤 Avatar client disconnected: {client_id}")
        except Exception as e:
            logger.error(f"❌ Client error: {e}")
        finally:
            if client_id in self.connected_clients:
                del self.connected_clients[client_id]
    
    async def process_message(self, message, client_id):
        """Process incoming messages from main system"""
        try:
            data = json.loads(message)
            message_type = data.get('type')
            
            logger.debug(f"📨 Message from {client_id}: {message_type}")
            
            if message_type == 'start_session':
                await self.handle_start_session(data, client_id)
            elif message_type == 'gesture_frame':
                await self.handle_gesture_frame(data, client_id)
            elif message_type == 'get_current_frame':
                await self.handle_get_current_frame(data, client_id)
            elif message_type == 'end_session':
                await self.handle_end_session(data, client_id)
            else:
                logger.warning(f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON from {client_id}")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            await self.send_error(client_id, str(e))
    
    async def handle_start_session(self, data, client_id):
        """Handle session start"""
        device_id = data.get('deviceId', 1)
        self.connected_clients[client_id]['device_id'] = device_id
        
        logger.info(f"🎬 Starting avatar session for device {device_id}")
        
        # Reset to neutral state
        self.device_states[device_id] = "neutral"
        if device_id in self.frame_indices:
            for reaction in self.frame_indices[device_id]:
                self.frame_indices[device_id][reaction] = 0
        
        await self.send_to_client(client_id, {
            "type": "session_started",
            "deviceId": device_id,
            "status": "ready"
        })
    
    async def handle_gesture_frame(self, data, client_id):
        """Process gesture detection frame"""
        device_id = data.get('deviceId', 1)
        frame_data = data.get('frame', '')
        
        # Decode and analyze frame
        frame = self.decode_frame(frame_data)
        if frame is None:
            return
        
        # Simple gesture detection
        gesture = self.detect_simple_gesture(frame, device_id)
        
        if gesture and gesture != self.device_states[device_id]:
            logger.info(f"🎭 Gesture detected: {gesture} for device {device_id}")
            self.device_states[device_id] = gesture
            
            # Reset frame index for new gesture
            if device_id in self.frame_indices and gesture in self.frame_indices[device_id]:
                self.frame_indices[device_id][gesture] = 0
            
            # Notify client
            await self.send_to_client(client_id, {
                "type": "gesture_detected",
                "deviceId": device_id,
                "gesture": gesture
            })
    
    async def handle_get_current_frame(self, data, client_id):
        """Send current avatar frame"""
        device_id = data.get('deviceId', 1)
        
        frame = self.get_current_avatar_frame(device_id)
        if frame is not None:
            frame_b64 = self.encode_frame(frame)
            
            await self.send_to_client(client_id, {
                "type": "avatar_frame",
                "deviceId": device_id,
                "frame": frame_b64,
                "state": self.device_states[device_id],
                "timestamp": time.time()
            })
    
    async def handle_end_session(self, data, client_id):
        """Handle session end"""
        device_id = data.get('deviceId', 1)
        
        logger.info(f"🏁 Ending avatar session for device {device_id}")
        
        # Reset state
        self.device_states[device_id] = "neutral"
        
        await self.send_to_client(client_id, {
            "type": "session_ended",
            "deviceId": device_id
        })
    
    def decode_frame(self, frame_data):
        """Decode base64 frame from browser"""
        try:
            # Remove data URL prefix
            if ',' in frame_data:
                frame_data = frame_data.split(',')[1]
            
            # Decode base64
            img_data = base64.b64decode(frame_data)
            nparr = np.frombuffer(img_data, np.uint8)
            
            # Decode image
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return frame
            
        except Exception as e:
            logger.error(f"Frame decode error: {e}")
            return None
    
    def encode_frame(self, frame):
        """Encode frame as base64 for browser"""
        try:
            # Encode as JPEG
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            return f"data:image/jpeg;base64,{frame_base64}"
            
        except Exception as e:
            logger.error(f"Frame encode error: {e}")
            return ""
    
    def detect_simple_gesture(self, frame, device_id):
        """Simple gesture detection - replace with MediaPipe later"""
        
        # For now, use random gesture detection for testing
        # Replace this with actual computer vision later
        
        current_time = time.time()
        
        # Simple motion-based detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Calculate frame statistics
        brightness = np.mean(gray)
        contrast = np.std(gray)
        
        # Simple heuristics for gesture detection
        if brightness > 120 and contrast > 30:
            # High activity detected
            if random.random() < 0.1:  # 10% chance per frame
                return random.choice(['wave', 'smile'])
        
        # Return to neutral after gesture
        if self.device_states[device_id] != "neutral":
            if random.random() < 0.05:  # 5% chance to return to neutral
                return "neutral"
        
        return None  # No gesture change
    
    def get_current_avatar_frame(self, device_id):
        """Get current frame for avatar state"""
        current_state = self.device_states[device_id]
        
        if (device_id not in self.video_frames or 
            current_state not in self.video_frames[device_id]):
            logger.warning(f"No frames for device {device_id} state {current_state}")
            return None
        
        frames = self.video_frames[device_id][current_state]
        current_index = self.frame_indices[device_id][current_state]
        
        # Get frame
        frame = frames[current_index]
        
        # Advance frame index
        self.frame_indices[device_id][current_state] = (current_index + 1) % len(frames)
        
        return frame
    
    async def send_to_client(self, client_id, data):
        """Send data to specific client"""
        if client_id in self.connected_clients:
            try:
                websocket = self.connected_clients[client_id]["websocket"]
                await websocket.send(json.dumps(data))
            except Exception as e:
                logger.error(f"Error sending to client {client_id}: {e}")
    
    async def send_error(self, client_id, error_message):
        """Send error message to client"""
        await self.send_to_client(client_id, {
            "type": "error",
            "message": error_message,
            "timestamp": time.time()
        })

# Server startup
async def main():
    # Create video folder if it doesn't exist
    video_folder = Path("avatar_videos")
    video_folder.mkdir(exist_ok=True)
    
    if not any(video_folder.glob("*.mp4")):
        logger.warning("⚠️ No avatar videos found!")
        logger.info("📁 Place your avatar videos in: avatar_videos/")
        logger.info("Expected files:")
        for device_id in [1, 2]:
            for reaction in ["neutral", "wave", "smile"]:
                logger.info(f"   device{device_id}_{reaction}.mp4")
    
    # Start server
    server = MinimalAvatarServer()
    
    logger.info(f"🚀 Starting Avatar Server on {server.host}:{server.port}")
    
    async with websockets.serve(server.handle_client, server.host, server.port):
        logger.info("✅ Avatar Server running! Waiting for connections...")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\n👋 Avatar server stopped")
    except Exception as e:
        logger.error(f"❌ Server error: {e}")
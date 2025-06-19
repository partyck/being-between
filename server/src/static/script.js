const socket = io();
const connectScreen = document.getElementById('connect-screen');
const videoInterface = document.getElementById('video-interface');
const connectBtn = document.getElementById('connect-btn');
const connectingScreen = document.getElementById('connecting-screen');
const videoContainer = document.getElementById('video-container');
const remoteVideo = document.getElementById('remote-video');

// constants
let params = new URLSearchParams(document.location.search);
const DEVICE_ID = parseInt(params.get("deviceid"), 10);
const room = 'video-room';
const searchDuration = 20;
const sessionDuration = 180;
const espDuration = 60;
const connectingAudioFile = 'connecting-audio1.mp3';
const sessionAudioFile = 'session-audio1.mp3';
const videoFiles = [
  'https://storage.googleapis.com/being-between-fake-videos/fake1.mp4',
  'https://storage.googleapis.com/being-between-fake-videos/fake2.mp4',
];

// variables
let audioPlayer = null;
let isConnected = false;
let localStream;
let peerConnection;
let iceCandidateQueue = [];
const config = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302',
    },
  ],
};


connectBtn.addEventListener('click', async () => {
  connectBtn.disabled = true;
  connectBtn.style.opacity = '0.7';

  connectScreen.style.display = 'none';
  videoInterface.style.display = 'block';

  console.log('joining...');
  socket.emit('join', { room: room });

  await startAudio(connectingAudioFile);
  await startSearchTimeout();
});

async function startAudio(audio) {
  if (audioPlayer) {
    console.log('⚠️ Connecting audio already playing, not starting duplicate');
    return;
  }

  try {
    console.log('🎵 Starting audio:', audio);
    audioPlayer = new Audio(audio);
    audioPlayer.loop = false;
    audioPlayer.volume = 0.6;

    audioPlayer.onended = () => {
      console.log('✅ Audio finished naturally');
      audioPlayer = null;
    };

    audioPlayer.play().catch(error => {
      console.log('⚠️ Audio autoplay prevented:', error);
    });

  } catch (error) {
    console.error('❌ Error starting audio:', error);
  }
}

async function startSearchTimeout() {
  console.log(`⏰ Starting search timeout: ${searchDuration} seconds`);
  setTimeout(() => {
    console.log(`⏰ Search timeout reached. isConnected: ${isConnected}`);
    if (isConnected) {
      console.log('startExperience');
      startExperience();
    }
    else {
      console.log('leaving room..');
      socket.emit('leave', { room: room });
      console.log('start fake Experience');
      startFakeExperience();
    }
  }, searchDuration * 1000);
}

function startExperience() {
  console.log('started experience');
  startAudio(sessionAudioFile);
  connectingScreen.style.display = 'none';
  videoContainer.style.display = 'block';
  startSessionTimer();
  startEspTimmer();
}

function startFakeExperience() {
  console.log('started fake experience');
  let videoIndex = Math.floor(Math.random() * videoFiles.length);
  const selectedVideo = videoFiles[videoIndex];
  console.log('📺 Using video:', selectedVideo, 'Index:', videoIndex);

  remoteVideo.srcObject = null;
  remoteVideo.src = selectedVideo;
  remoteVideo.autoplay = true;
  remoteVideo.loop = true;
  remoteVideo.muted = true;

  remoteVideo.onloadeddata = function () {
    console.log('✅ Video loaded successfully');
    connectingScreen.style.display = 'none';
    videoContainer.style.display = 'block';
    startAudio(sessionAudioFile);
    startSessionTimer();
  };

  remoteVideo.onerror = function (error) {
    console.log('❌ Video failed to load:', error);
  };
}

function startEspTimmer() {
  console.log(`⏰ Starting esp timeout: ${espDuration} seconds`);
  setTimeout(() => {
    console.log(`⏰ Esp timeout reached.`);
    socket.emit('start-beat', { deviceId: DEVICE_ID });
  }, sessionDuration * 1000);
}

function startSessionTimer() {
  console.log(`⏰ Starting session timeout: ${sessionDuration} seconds`);
  setTimeout(() => {
    console.log(`⏰ Session timeout reached.`);
    endSession();
  }, sessionDuration * 1000);
}

function endSession() {
  console.log(`End session.`);
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }

  if (peerConnection) {
    peerConnection.close();
  }

  remoteVideo.srcObject = null;
  remoteVideo.src = '';
  remoteVideo.pause();
  remoteVideo.currentTime = 0;
  remoteVideo.onloadeddata = null;
  remoteVideo.onerror = null;


  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    audioPlayer = null;
  }

  socket.emit('stop-beat', { deviceId: DEVICE_ID });
  socket.emit('leave', { room: room });

  setTimeout(() => {
    videoInterface.style.display = 'none';
    connectScreen.style.display = 'flex';
    connectBtn.disabled = false;
    connectBtn.style.opacity = '1';

    isConnected = false;
    localStream = null;
    peerConnection = null;

    connectingScreen.style.display = 'flex';
    videoContainer.style.display = 'none';
  }, 500);
}



// --- Socket.IO Signaling ---
socket.on('connect', () => {
  console.log('socket connected');
});

socket.on('peer_joined', (data) => {
  console.log('A new peer has joined the room.');
  // When a new peer joins, the existing peer will create and send an offer
  createPeerConnection();
  isConnected = true;

  navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then(stream => {
      localStream = stream;
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
      return peerConnection.createOffer();
    })
    .then(offer => {
      return peerConnection.setLocalDescription(offer);
    })
    .then(() => {
      socket.emit('signal', { room: room, desc: peerConnection.localDescription });
    })
    .catch(e => console.error(e));
});

socket.on('peer_left', (data) => {
  console.log('A peer has left the room.');
  remoteVideo.srcObject = null;
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  iceCandidateQueue = [];
});


socket.on('signal', (data) => {
  console.log('on signal.');
  if (data.desc) {
    if (data.desc.type === 'offer' && !peerConnection) {
      createPeerConnection();
      isConnected = true;
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
          localStream = stream;
          localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
          return peerConnection.setRemoteDescription(new RTCSessionDescription(data.desc));
        })
        .then(() => {
          // FIX: Process any queued candidates now that the remote description is set
          processIceCandidateQueue();
          return peerConnection.createAnswer();
        })
        .then(answer => {
          return peerConnection.setLocalDescription(answer);
        })
        .then(() => {
          socket.emit('signal', { room: room, desc: peerConnection.localDescription });
        })
        .catch(e => console.error(e));
    } else if (data.desc.type === 'answer') {
      peerConnection.setRemoteDescription(new RTCSessionDescription(data.desc))
        .then(() => {
          // FIX: Process any queued candidates now that the remote description is set
          processIceCandidateQueue();
        })
        .catch(e => console.error(e));
    }
  } else if (data.candidate) {
    // FIX: Queue candidates if remote description isn't set yet
    if (peerConnection && peerConnection.remoteDescription) {
      peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => console.error(e));
    } else {
      console.log('Queueing ICE candidate');
      iceCandidateQueue.push(data.candidate);
    }
  }
});

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { room: room, candidate: event.candidate });
    }
  };

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  // When connection is closed, clean up
  peerConnection.onconnectionstatechange = (event) => {
    if (peerConnection.connectionState === 'closed' || peerConnection.connectionState === 'failed') {
      remoteVideo.srcObject = null;
    }
  };
}

// FIX: New function to process the ICE candidate queue
function processIceCandidateQueue() {
  while (iceCandidateQueue.length > 0 && peerConnection && peerConnection.remoteDescription) {
    console.log('Processing queued ICE candidate');
    const candidate = iceCandidateQueue.shift();
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error(e));
  }
}

navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  .then(stream => {
    localStream = stream;
  })
  .catch(e => console.error(e));

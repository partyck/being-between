const socket = io();
const homeScreen = document.getElementById('home');
const videoInterface = document.getElementById('video-interface');
const connectingScreen = document.getElementById('connecting-screen');
const videoContainer = document.getElementById('video-container');
const remoteVideo = document.getElementById('remote-video');
const fakeVideoContainer = document.getElementById('fake-video-container');
const fakeVideo = document.getElementById('fake-video');
const fingerMisplaced = document.getElementById('finger-misplaced');
const connectDeviceButton = document.getElementById('connect-device');

// constants
const params = new URLSearchParams(document.location.search);
const DEVICE_ID = parseInt(params.get("deviceid"), 10);
const room = 'video-room';
const searchDuration = 20;
const sessionDuration = 100;
const espDuration = 43;
const connectingAudioFile = 'connecting-audio1.mp3';
const sessionAudioFile = 'session-audio1.mp3';
const fakeVideos1 = [
  'videos/fake-video-1.mp4',
  'videos/fake-video-2.mp4',
];
const fakeVideos2 = [
  'videos/fake-video-3.mp4',
];

// variables
let audioPlayer = null;
let isStarted = false;
let isOtherConnected = false;
let isExperience = false;
let isSendingBeats = false;
let deviceWriter = null;
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
      // console.log('✅ Audio finished naturally');
      audioPlayer = null;
    };

    audioPlayer.play().catch(error => {
      console.log('⚠️ Audio autoplay prevented:', error);
    });

  } catch (error) {
    console.error('❌ Error starting audio:', error);
  }
}

async function startSession() {
  console.log('👆 finger placed, starting session');
  isStarted = true;
  socket.emit('start', { deviceId: DEVICE_ID });
  homeScreen.style.display = 'none';
  videoInterface.style.display = 'block';
  await startAudio(connectingAudioFile);
  await startSearchTimeout();
}

async function startSearchTimeout() {
  console.log(`⏰ Starting search timeout: ${searchDuration} seconds`);
  setTimeout(() => {
    console.log(`⏰ Search timeout reached. is other connected? ${isOtherConnected}`);
    if (isOtherConnected) {
      console.log('📞 Start Experience');
      startExperience();
    }
    else {
      console.log('📞🥸 Start fake Experience');
      startFakeExperience();
    }
  }, searchDuration * 1000);
}

function startExperience() {
  console.log('started experience');
  startAudio(sessionAudioFile);
  connectingScreen.style.display = 'none';
  videoContainer.style.display = 'block';
  isExperience = true;
  startSessionTimer();
  startEspTimmer();
}

function startFakeExperience() {
  console.log('started fake experience');
  const videos = DEVICE_ID === 1 ? fakeVideos1 : fakeVideos2;
  const videoIndex = Math.floor(Math.random() * videos.length);
  const selectedVideo = videos[videoIndex];
  console.log('📺 Using video:', selectedVideo, 'Index:', videoIndex);

  fakeVideo.srcObject = null;
  fakeVideo.src = selectedVideo;
  fakeVideo.autoplay = true;
  fakeVideo.loop = true;
  fakeVideo.muted = true;

  fakeVideo.onloadeddata = function () {
    console.log('✅ Video loaded successfully');
    connectingScreen.style.display = 'none';
    fakeVideoContainer.style.display = 'block';
    isExperience = true;
    socket.emit('experience-started', { deviceId: DEVICE_ID });
    startAudio(sessionAudioFile);
    startSessionTimer();
    startFakeEspTimmer();
  };

  fakeVideo.onerror = function (error) {
    console.log('❌ Video failed to load:', error);
  };
}

function startEspTimmer() {
  console.log(`⏰ Starting esp timeout: ${espDuration} seconds`);
  setTimeout(() => {
    console.log(`⏰ Esp timeout reached.`);
    isSendingBeats = true;
  }, espDuration * 1000);
}

function startFakeEspTimmer() {
  console.log(`⏰ Starting esp fake timeout: ${espDuration} seconds`);
  setTimeout(() => {
    console.log(`⏰ Esp fake timeout reached.`);
    sendFakeBeat();
  }, espDuration * 1000);
}

const sendFakeBeat = () => {
  if (isExperience) {
    console.log(`❤️ beat!`);
    vibrate();
    setTimeout(() => sendFakeBeat(), 1000);
  }
};

function startSessionTimer() {
  console.log(`⏰ Starting session timeout: ${sessionDuration} seconds`);
  setTimeout(() => {
    console.log(`⏰ Session timeout reached.`);
    endSession();
  }, sessionDuration * 1000);
}

function endSession() {
  console.log(`End session.`);

  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    audioPlayer = null;
  }

  isSendingBeats = false;

  setTimeout(() => {
    videoInterface.style.display = 'none';
    homeScreen.style.display = 'flex';
    fingerMisplaced.style.display = 'none';
    connectingScreen.style.display = 'flex';
    videoContainer.style.display = 'none';
    fakeVideoContainer.style.display = 'none';

    isStarted = false;
    isExperience = false;
    isOtherConnected = false;

  }, 500);
}



// --- Socket.IO Signaling ---
socket.on('connect', () => {
  console.log('socket connected');
  socket.emit('join', { room: room });
});

socket.on('experience-started', (data) => {
  console.log(`Fake experience started from: ${data.deviceId}`);
  if (!isExperience && data.deviceId !== DEVICE_ID) {
    isOtherConnected = false;

    homeScreen.style.display = 'flex';
    connectingScreen.style.display = 'flex';
    fingerMisplaced.style.display = 'none';
    videoInterface.style.display = 'none';
    videoContainer.style.display = 'none';
    fakeVideoContainer.style.display = 'none';
  }
});

socket.on('start', (data) => {
  if (data.deviceId === DEVICE_ID) return;
  console.log(`start ${data.deviceId}`);
  isOtherConnected = !isExperience;
  connectingScreen.style.display = 'none';
  videoContainer.style.display = 'block';
  videoInterface.style.display = 'block';
});

socket.on('motor', (data) => {
  if (data.deviceId === DEVICE_ID) return;
  vibrate();
});

socket.on('peer_joined', (data) => {
  console.log('A new peer has joined the room.');
  // When a new peer joins, the existing peer will create and send an offer
  createPeerConnection();

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


// --- Device (esp32 over Web Serial) ---
// one message per line: "finger-on", "finger-off" and "beat" from the esp32, "vibrate" to it.
function onDeviceMessage(message) {
  switch (message) {
    case 'finger-on':
      fingerMisplaced.style.display = 'none';
      if (!isStarted) startSession();
      break;
    case 'finger-off':
      if (isStarted) fingerMisplaced.style.display = 'block';
      break;
    case 'beat':
      if (isSendingBeats) socket.emit('beat', { deviceId: DEVICE_ID });
      break;
    default:
      console.log('📟 device:', message);
  }
}

function vibrate() {
  if (!deviceWriter) return;
  deviceWriter.write(new TextEncoder().encode('vibrate\n')).catch(e => console.error(e));
}

async function connectDevice(port) {
  if (deviceWriter) return;
  try {
    await port.open({ baudRate: 115200 });
  } catch (error) {
    console.error('❌ Could not open device:', error);
    return;
  }
  console.log('🔌 Device connected');
  deviceWriter = port.writable.getWriter();
  connectDeviceButton.style.display = 'none';

  const decoder = new TextDecoder();
  let buffer = '';
  while (port.readable) {
    const reader = port.readable.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        lines.map(line => line.trim()).filter(Boolean).forEach(onDeviceMessage);
      }
    } catch (error) {
      console.error('❌ Device read error:', error);
    } finally {
      reader.releaseLock();
    }
  }

  console.log('🔌 Device disconnected');
  deviceWriter.releaseLock();
  deviceWriter = null;
  await port.close().catch(() => {});
  connectDeviceButton.style.display = '';
}

if ('serial' in navigator) {
  // Previously paired devices reconnect on their own: on page load and when plugged back in.
  navigator.serial.getPorts().then(([port]) => port && connectDevice(port));
  navigator.serial.addEventListener('connect', (event) => connectDevice(event.target));
  connectDeviceButton.addEventListener('click', () => {
    navigator.serial.requestPort().then(connectDevice).catch(e => console.error(e));
  });
}
else {
  console.error('❌ Web Serial is not supported in this browser, use Chrome or Edge.');
}

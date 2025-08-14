const socket = io();
const homeScreen = document.getElementById('home');
const videoInterface = document.getElementById('video-interface');
const connectingScreen = document.getElementById('connecting-screen');
const videoContainer = document.getElementById('video-container');
const remoteVideo = document.getElementById('remote-video');
const fakeVideoContainer = document.getElementById('fake-video-container');
const fakeVideo = document.getElementById('fake-video');
const fingerMisplaced = document.getElementById('finger-misplaced');

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

const Status = Object.freeze({
  STAND_BY: 'STAND_BY',
  WAITING_FOR_OTHER: 'WAITING_FOR_OTHER',
  WAITING_FOR_USER: 'WAITING_FOR_USER',
  EXPERIENCE: 'EXPERIENCE',
  EXPERIENCE_BEAT: 'EXPERIENCE_BEAT',
});
let currentStatus = Status.STAND_BY;

// variables
let audioPlayer = null;
let isStarted = false;
let isOtherConnected = false;
let isExperience = false;
let isBeatOn = false;
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
    socket.emit('start-beat', { deviceId: DEVICE_ID });
    isBeatOn = true;
  }, espDuration * 1000);
}

function startFakeEspTimmer() {
  console.log(`⏰ Starting esp fake timeout: ${espDuration} seconds`);
  setTimeout(() => {
    console.log(`⏰ Esp fake timeout reached.`);
    isBeatOn = true;
    sendFakeBeat();
  }, espDuration * 1000);
}

const sendFakeBeat = () => {
  if (isExperience) {
    console.log(`❤️ beat!`);
    // const other_device = DEVICE_ID === 1 ? 2 : 1;
    socket.emit('beat', { deviceId: DEVICE_ID });
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

  // socket.emit('stop', { deviceId: DEVICE_ID });

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
    isBeatOn = false;

  }, 500);
}



// --- Socket.IO Signaling ---
socket.on('connect', () => {
  console.log('socket connected');
  socket.emit('join', { room: room });
});

socket.on('esp-joined', (data) => {
  console.log(`esp joined: ${data.deviceId}`);
});

socket.on('beat', (data) => {
  console.log(`beat from: ${data.deviceId}`);
  if (data.deviceId !== DEVICE_ID) {
    if (isBeatOn) {
      const other_device = DEVICE_ID === 1 ? 2 : 1;
      socket.emit('motor', { deviceId: other_device });
    }
  }
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

socket.on('start', async (data) => {
  console.log(`start ${data.deviceId}`);
  if (data.deviceId !== DEVICE_ID) {
    isOtherConnected = !isExperience;
    connectingScreen.style.display = 'none';
    videoContainer.style.display = 'block';
    videoInterface.style.display = 'block';
  }
  else {
    isStarted = true;
    homeScreen.style.display = 'none';
    videoInterface.style.display = 'block';
    await startAudio(connectingAudioFile);
    await startSearchTimeout();
  }
});

socket.on('finger-misplaced', async (data) => {
  console.log(`👆 finger-misplaced: ${data.fingerMisplaced}`);
  if (data.deviceId === DEVICE_ID && data.fingerMisplaced) {
    switch (currentStatus) {
      case Status.STAND_BY:
        isStarted = true;
        homeScreen.style.display = 'none';
        videoInterface.style.display = 'block';
        await startAudio(connectingAudioFile);
        await startSearchTimeout();
        break;
      case Status.WAITING_FOR_USER:
        // Add logic for WAITING_FOR_USER if needed
        break;
      default:
        // Handle unknown status if necessary
        break;
    }
    if (currentStatus === Status.STAND_BY) {

    }
    if (currentStatus == Status.WAITING_FOR_USER) {

    }
  }

  if (data.fingerMisplaced) {
    fingerMisplaced.style.display = 'block';
  }
  else {
    fingerMisplaced.style.display = 'none';
  }
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

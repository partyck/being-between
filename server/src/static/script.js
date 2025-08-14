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
const sessionDuration = 93;
const espDuration = 43;
const breakDuration = 5;
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
  WAITING_TO_START: 'WAITING_TO_START',
  EXPERIENCE: 'EXPERIENCE',
  EXPERIENCE_BEAT: 'EXPERIENCE_BEAT',
  BREAK: 'BREAK',
});
let currentStatus = Status.STAND_BY;

// variables
let audioPlayer = null;
let isOtherConnected = false;
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

    socket.emit('start-experience', { deviceId: DEVICE_ID });
    videoInterface.style.display = 'block';
    currentStatus = Status.EXPERIENCE;

    if (isOtherConnected) {
      startExperience();
    }
    else {
      startFakeExperience();
    }
  }, searchDuration * 1000);
}

function startExperience() {
  console.log('📞 Start Experience');
  startAudio(sessionAudioFile);
  connectingScreen.style.display = 'none';
  videoContainer.style.display = 'block';
  startSessionTimer();
  startFakeEspTimmer();
}

function startFakeExperience() {
  console.log('📞🥸 Start fake Experience');
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
    startAudio(sessionAudioFile);
    startSessionTimer();
    startFakeEspTimmer();
  };

  fakeVideo.onerror = function (error) {
    console.log('❌ Video failed to load:', error);
  };
}

function startFakeEspTimmer() {
  console.log(`⏰ Starting esp fake timeout: ${espDuration} seconds`);
  setTimeout(() => {
    console.log(`⏰ Esp fake timeout reached.`);
    currentStatus = Status.EXPERIENCE_BEAT;
    sendFakeBeat();
  }, espDuration * 1000);
}

const sendFakeBeat = () => {
  if (currentStatus === Status.EXPERIENCE_BEAT) {
    console.log(`❤️ beat!`);
    socket.emit('motor', { deviceId: DEVICE_ID });
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

  setTimeout(() => {
    videoInterface.style.display = 'none';
    homeScreen.style.display = 'flex';
    fingerMisplaced.style.display = 'none';
    connectingScreen.style.display = 'none';
    videoContainer.style.display = 'none';
    fakeVideoContainer.style.display = 'none';

    isOtherConnected = false;
    currentStatus = Status.BREAK;
    breakTimer();

  }, 500);
}

function breakTimer() {
  console.log(`⏰ break timeout: ${breakDuration} seconds`);
  setTimeout(() => {
    console.log(`⏰ break reached.`);
    currentStatus = Status.STAND_BY;
  }, breakDuration * 1000);
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
});

socket.on('waiting', (data) => {
  if (data.deviceId !== DEVICE_ID && currentStatus == Status.STAND_BY) {
    console.log(`Waiting coming from ${data.deviceId}`);
    currentStatus = Status.WAITING_FOR_USER;
    homeScreen.style.display = 'flex';
    connectingScreen.style.display = 'none';
    videoContainer.style.display = 'block';
    videoInterface.style.display = 'block';
  }
});

socket.on('other-connected', (data) => {
  if (data.deviceId !== DEVICE_ID && currentStatus == Status.WAITING_FOR_OTHER) {
    console.log(`other connected from: ${data.deviceId}`);
    isOtherConnected = true;
  }
});

socket.on('start-experience', (data) => {
  if (data.deviceId !== DEVICE_ID) {
    if (currentStatus === Status.WAITING_TO_START) {
      console.log(`start experience from: ${data.deviceId}`);
      homeScreen.style.display = 'none';
      videoInterface.style.display = 'block';
      startExperience();
    }
    if (currentStatus === Status.WAITING_FOR_USER) {
      isOtherConnected = false;
      currentStatus = Status.STAND_BY;
      homeScreen.style.display = 'flex';
      connectingScreen.style.display = 'none';
      fingerMisplaced.style.display = 'none';
      videoInterface.style.display = 'none';
      videoContainer.style.display = 'none';
      fakeVideoContainer.style.display = 'none';
    }
  }
});

socket.on('finger', async (data) => {
  console.log(`👆 finger-misplaced: ${data.fingerDerected}`);
  if (data.deviceId === DEVICE_ID) {
    if (data.fingerDerected) {

      switch (currentStatus) {
        case Status.STAND_BY:
          currentStatus = Status.WAITING_FOR_OTHER;
          homeScreen.style.display = 'none';
          connectingScreen.style.display = 'flex';
          socket.emit('waiting', { deviceId: DEVICE_ID });
          await startAudio(connectingAudioFile);
          await startSearchTimeout();
          break;
        case Status.WAITING_FOR_USER:
          console.log('📞 Start Experience');
          currentStatus = Status.WAITING_TO_START;
          homeScreen.style.display = 'none';
          videoInterface.style.display = 'block';
          connectingScreen.style.display = 'flex';
          socket.emit('other-connected', { deviceId: DEVICE_ID });
          break;
        default:
          fingerMisplaced.style.display = 'none';
          break;
      }
    }
    else {
      if ([Status.WAITING_TO_START, Status.WAITING_FOR_OTHER, Status.EXPERIENCE, Status.EXPERIENCE_BEAT].includes(currentStatus)) {
        fingerMisplaced.style.display = 'block';
      }
    }
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

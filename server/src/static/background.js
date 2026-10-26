// --- Moving background ---
// Perlin noise between the two colours of the old static gradient (still on the body, until p5 has loaded).
// While the connecting screen is shown, the purple slowly gathers into misty concentric rings around its message,
// which breathe in and out, and it drifts apart again when the screen is gone.
// It's drawn on a small canvas that the browser stretches and smooths to the whole screen,
// so only a few thousand pixels are computed per frame.
new p5((p) => {
  const columns = 96;        // canvas pixels across the screen
  const scale = 2;           // noise units across the screen: about two blobs of colour
  const speed = 0.05;        // noise units per second
  const ringSpacing = 0.22;  // distance between two rings, in screen widths
  const ringStrength = 0.05; // how much the rings win over the mist, 0 is only mist
  const ringWobble = 0.25;   // how much the mist bends the rings
  const gatherTime = 3;      // seconds: the rings are about 2/3 formed after this, and fully after 3 times this
  const breathTime = 6;      // seconds for one breath: the rings spread out and come back together
  const breathDepth = 0.2;   // how much the spacing changes while breathing: 0.2 is up to 20% wider and 20% narrower
  const from = [0x66, 0x7e, 0xea];
  const to = [0x76, 0x4b, 0xa2];
  const videoContainers = document.querySelectorAll('.video-container');
  const connectingScreen = document.getElementById('connecting-screen');
  const connectingMessage = connectingScreen.querySelector('.connecting-message');

  let rings = 0;  // 0 is only mist, 1 is fully gathered rings
  // centre of the rings in canvas pixels, kept after the connecting screen is gone so the rings fade where they were
  let centerX = 0;
  let centerY = 0;

  const rows = () => Math.round(columns * p.windowHeight / p.windowWidth);

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(columns, rows());
    p.frameRate(30);
  };

  p.windowResized = () => p.resizeCanvas(columns, rows());

  p.draw = () => {
    // a video covers the whole screen, leave the cpu to it
    if ([...videoContainers].some(container => container.checkVisibility())) return;

    const connecting = connectingScreen.checkVisibility();
    rings += ((connecting ? 1 : 0) - rings) * (1 - Math.exp(-p.deltaTime / 1000 / gatherTime));
    if (connecting) {
      const message = connectingMessage.getBoundingClientRect();
      centerX = (message.left + message.width / 2) / p.windowWidth * p.width;
      centerY = (message.top + message.height / 2) / p.windowHeight * p.height;
    }

    const seconds = p.millis() / 1000;
    const z = seconds * speed;
    const spacing = ringSpacing * (1 + breathDepth * Math.sin(seconds / breathTime * p.TWO_PI));
    p.loadPixels();
    for (let y = 0; y < p.height; y++) {
      for (let x = 0; x < p.width; x++) {
        const n = p.noise(x / columns * scale, y / columns * scale, z);
        // distance to the centre in screen widths, bent by the mist so the rings aren't perfect circles
        const distance = Math.hypot(x - centerX, y - centerY) / columns + (n - 0.5) * ringWobble;
        // 1 on a ring (purple), -1 between two rings (blue)
        const ring = Math.cos(distance / spacing * p.TWO_PI);
        // noise() stays mostly between 0.3 and 0.7, stretch that to the whole gradient
        const amount = p.constrain(p.map(n + ring * ringStrength * rings, 0.3, 0.7, 0, 1), 0, 1);
        const i = (y * p.width + x) * 4;
        for (let c = 0; c < 3; c++) p.pixels[i + c] = p.lerp(from[c], to[c], amount);
        p.pixels[i + 3] = 255;
      }
    }
    p.updatePixels();
  };
}, document.getElementById('background'));

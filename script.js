const canvas = document.querySelector("#attention-canvas");
const context = canvas.getContext("2d", { alpha: true });
const settledCanvas = document.createElement("canvas");
const settledContext = settledCanvas.getContext("2d", { alpha: true });
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const mobilePointer = window.matchMedia("(max-width: 640px), (pointer: coarse)");

const colorFields = [
  ["#FFF12B", "#FF5A1F"],
  ["#FFE600", "#FF3D5A"],
  ["#FFC400", "#FF6A00"],
  ["#FFB000", "#FF3B30"],
  ["#FF62C7", "#F0008B"],
  ["#52E5FF", "#146CFF"],
  ["#C47BFF", "#713BFF"],
  ["#B9FF45", "#00C98D"],
];
const stillnessDelay = 220;
const stampCooldown = 280;
const ambientGrowthDuration = 18000;
const mobileGrowthAmount = 1;
const desktopGrowthAmount = 1.75;
const blooms = [];
const settledBlooms = [];

let pixelRatio = 1;
let stillnessTimer = 0;
let activeBloom = null;
let animationFrame = 0;
let pointer = null;
let lastStampAt = -Infinity;
let lastColorFieldIndex = -1;
let nextColorTemperature = "warm";
let lastShapeIndex = -1;
let lastScrollStampY = window.scrollY;
let nextScrollDistance = randomScrollDistance();
let touchTapStart = null;
let mobileTopBloomSeeded = false;
let warmColorQueue = [];
let coolColorQueue = [];

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function resizeCanvas() {
  const maxPixelRatio = mobilePointer.matches ? 1.25 : 1.5;
  pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
  const canvasHeight = mobilePointer.matches
    ? Math.max(document.documentElement.scrollHeight, window.innerHeight)
    : window.innerHeight;
  canvas.width = Math.round(window.innerWidth * pixelRatio);
  canvas.height = Math.round(canvasHeight * pixelRatio);
  settledCanvas.width = canvas.width;
  settledCanvas.height = canvas.height;
  canvas.style.height = `${canvasHeight}px`;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  settledContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  rebuildSettledLayer();
  render();
}

function randomScrollDistance() {
  return 250 + Math.random() * 150;
}

function shuffledColorQueue(indices) {
  const queue = [...indices];

  for (let index = queue.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [queue[index], queue[swapIndex]] = [queue[swapIndex], queue[index]];
  }

  return queue;
}

function nextColorFieldIndex() {
  const isWarm = nextColorTemperature === "warm";
  let queue = isWarm ? warmColorQueue : coolColorQueue;

  if (queue.length === 0) {
    queue = shuffledColorQueue(isWarm ? [0, 1, 2, 3] : [4, 5, 6, 7]);
    if (isWarm) warmColorQueue = queue;
    else coolColorQueue = queue;
  }

  let fieldIndex = queue.shift();

  if (fieldIndex === lastColorFieldIndex && queue.length > 0) {
    queue.push(fieldIndex);
    fieldIndex = queue.shift();
  }

  lastColorFieldIndex = fieldIndex;
  nextColorTemperature = isWarm ? "cool" : "warm";
  return fieldIndex;
}

function seedMobileTopBloom() {
  if (!mobilePointer.matches || mobileTopBloomSeeded) return;

  mobileTopBloomSeeded = true;
  window.setTimeout(() => {
    makeBloom(
      window.innerWidth * (0.68 + Math.random() * 0.18),
      48 + Math.random() * 54,
    );
  }, 250);
}

function makeBloom(x, y) {
  const now = performance.now();
  if (now - lastStampAt < stampCooldown) return;

  const desktopSizeMultiplier = mobilePointer.matches ? 1 : 1.2;
  const radius = (50 + Math.random() * 16) * desktopSizeMultiplier;
  const opacity = 0.28 + Math.random() * 0.06;
  const fieldIndex = nextColorFieldIndex();
  const colors = colorFields[fieldIndex];
  const shapeFamilies = [
    { lobes: 1, streak: false, x: [0.88, 1.12], y: [0.88, 1.12] },
    { lobes: 1, streak: false, x: [1.45, 2.1], y: [0.62, 0.88] },
    { lobes: 2, streak: true, x: [1.9, 2.8], y: [0.42, 0.68] },
    { lobes: 3, streak: false, x: [0.75, 1.35], y: [0.7, 1.25] },
    { lobes: 4, streak: false, x: [0.62, 1.55], y: [0.58, 1.4] },
  ];
  const shapeChoices = shapeFamilies
    .map((_, index) => index)
    .filter((index) => index !== lastShapeIndex);
  const shapeIndex =
    shapeChoices[Math.floor(Math.random() * shapeChoices.length)];
  const shape = shapeFamilies[shapeIndex];
  lastShapeIndex = shapeIndex;
  const lobeCount = shape.lobes;
  const isStreak = shape.streak;
  const randomBetween = ([minimum, maximum]) =>
    minimum + Math.random() * (maximum - minimum);
  const lobes = Array.from({ length: lobeCount }, (_, index) => ({
    offsetX:
      index === 0
        ? 0
        : (Math.random() - 0.5) * radius * (isStreak ? 1.45 : 1.05),
    offsetY:
      index === 0
        ? 0
        : (Math.random() - 0.5) * radius * (isStreak ? 0.32 : 1.05),
    radiusScale: index === 0 ? 1 : 0.38 + Math.random() * 0.5,
    opacityScale: index === 0 ? 1 : 0.42 + Math.random() * 0.4,
    scaleX: randomBetween(shape.x) * (index === 0 ? 1 : 0.72 + Math.random() * 0.4),
    scaleY: randomBetween(shape.y) * (index === 0 ? 1 : 0.72 + Math.random() * 0.4),
  }));
  const bloom = {
    x,
    y,
    colors: colors.map(hexToRgb),
    rotation: Math.random() * Math.PI,
    lobes,
    baseRadius: radius,
    radius,
    baseOpacity: opacity,
    opacity,
    startedAt: now,
    createdAt: now,
    active: !reducedMotion.matches,
  };

  blooms.push(bloom);
  lastStampAt = now;
  activeBloom = bloom;
  render();

  if (!reducedMotion.matches) requestRender();
}

function drawBloom(bloom, now, targetContext = context) {
  const [outer, inner] = bloom.colors;
  const age = Math.min((now - bloom.createdAt) / ambientGrowthDuration, 1);
  const growthAmount = mobilePointer.matches
    ? mobileGrowthAmount
    : desktopGrowthAmount;
  const ambientScale = reducedMotion.matches
    ? 1
    : 1 + age * growthAmount;

  targetContext.save();
  targetContext.translate(bloom.x, bloom.y);
  targetContext.rotate(bloom.rotation);
  targetContext.translate(-bloom.x, -bloom.y);

  bloom.lobes.forEach((lobe) => {
    const x = bloom.x + lobe.offsetX;
    const y = bloom.y + lobe.offsetY;
    const radius = bloom.radius * lobe.radiusScale * ambientScale;
    const opacity = bloom.opacity * lobe.opacityScale;

    targetContext.save();
    targetContext.translate(x, y);
    targetContext.scale(lobe.scaleX, lobe.scaleY);
    targetContext.translate(-x, -y);

    const gradient = targetContext.createRadialGradient(
      x,
      y,
      radius * 0.02,
      x,
      y,
      radius,
    );

    gradient.addColorStop(
      0,
      `rgba(${inner.r}, ${inner.g}, ${inner.b}, ${opacity})`,
    );
    gradient.addColorStop(
      0.3,
      `rgba(${inner.r}, ${inner.g}, ${inner.b}, ${opacity * 0.82})`,
    );
    gradient.addColorStop(
      0.62,
      `rgba(${outer.r}, ${outer.g}, ${outer.b}, ${opacity * 0.58})`,
    );
    gradient.addColorStop(
      0.84,
      `rgba(${outer.r}, ${outer.g}, ${outer.b}, ${opacity * 0.1})`,
    );
    gradient.addColorStop(1, `rgba(${outer.r}, ${outer.g}, ${outer.b}, 0)`);

    targetContext.filter = "blur(12px)";
    targetContext.fillStyle = gradient;
    targetContext.fillRect(
      x - radius * 1.8,
      y - radius * 1.8,
      radius * 3.6,
      radius * 3.6,
    );
    targetContext.restore();
  });

  targetContext.restore();
}

function rebuildSettledLayer(now = performance.now()) {
  settledContext.clearRect(
    0,
    0,
    settledCanvas.width / pixelRatio,
    settledCanvas.height / pixelRatio,
  );
  settledContext.globalCompositeOperation = "multiply";
  settledBlooms.forEach((bloom) => drawBloom(bloom, now, settledContext));
}

function archiveSettledBlooms(now) {
  const stillGrowing = [];

  blooms.forEach((bloom) => {
    const isSettled =
      bloom !== activeBloom &&
      (reducedMotion.matches || now - bloom.createdAt >= ambientGrowthDuration);

    if (isSettled) {
      settledBlooms.push(bloom);
      drawBloom(bloom, now, settledContext);
    } else {
      stillGrowing.push(bloom);
    }
  });

  blooms.length = 0;
  blooms.push(...stillGrowing);
}

function render(now = performance.now()) {
  if (activeBloom?.active && !reducedMotion.matches) {
    const holdProgress = Math.min(
      (now - activeBloom.startedAt) / ambientGrowthDuration,
      1,
    );
    const organicEase = 1 - Math.pow(1 - holdProgress, 2);
    activeBloom.radius = activeBloom.baseRadius + organicEase * 15;
    activeBloom.opacity =
      activeBloom.baseOpacity + organicEase * (0.38 - activeBloom.baseOpacity);
  }

  archiveSettledBlooms(now);
  context.clearRect(
    0,
    0,
    window.innerWidth,
    canvas.height / pixelRatio,
  );
  context.globalCompositeOperation = "multiply";
  context.drawImage(
    settledCanvas,
    0,
    0,
    settledCanvas.width / pixelRatio,
    settledCanvas.height / pixelRatio,
  );
  blooms.forEach((bloom) => drawBloom(bloom, now));
}

function animate(now) {
  animationFrame = 0;
  render(now);
  const hasGrowingBlooms = blooms.some(
    (bloom) => now - bloom.createdAt < ambientGrowthDuration,
  );
  const activeBloomIsGrowing =
    activeBloom?.active && now - activeBloom.startedAt < ambientGrowthDuration;
  if (activeBloomIsGrowing || hasGrowingBlooms) requestRender();
}

function requestRender() {
  if (!animationFrame) animationFrame = requestAnimationFrame(animate);
}

function stopActiveBloom() {
  clearTimeout(stillnessTimer);
  stillnessTimer = 0;

  if (activeBloom) {
    activeBloom.active = false;
    activeBloom = null;
  }
}

function scheduleBloom(x, y) {
  clearTimeout(stillnessTimer);
  stillnessTimer = window.setTimeout(() => makeBloom(x, y), stillnessDelay);
}

function startTouchTap(x, y) {
  stopActiveBloom();
  touchTapStart = { x, y, time: performance.now() };
}

function finishTouchTap(x, y, target) {
  const tap = touchTapStart;
  touchTapStart = null;
  if (!tap) return;

  const duration = performance.now() - tap.time;
  const distance = Math.hypot(x - tap.x, y - tap.y);
  if (duration > 350 || distance > 12) return;
  if (target instanceof Element && target.closest("a")) return;
  makeBloom(x, y + window.scrollY);
}

window.addEventListener(
  "pointermove",
  (event) => {
    if (event.pointerType === "touch" || mobilePointer.matches) return;

    stopActiveBloom();
    pointer = { x: event.clientX, y: event.clientY };
    scheduleBloom(pointer.x, pointer.y);
  },
  { passive: true },
);

window.addEventListener(
  "pointerdown",
  (event) => {
    if (event.pointerType !== "touch" && !mobilePointer.matches) return;
    startTouchTap(event.clientX, event.clientY);
  },
  { passive: true },
);

window.addEventListener(
  "touchstart",
  (event) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    startTouchTap(touch.clientX, touch.clientY);
  },
  { passive: true },
);

window.addEventListener(
  "touchend",
  (event) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    finishTouchTap(touch.clientX, touch.clientY, event.target);
  },
  { passive: true },
);

window.addEventListener(
  "click",
  (event) => {
    if (event.pointerType === "touch" || mobilePointer.matches) {
      if (event.target.closest("a")) return;
      if (performance.now() - lastStampAt < stampCooldown) return;
      stopActiveBloom();
      makeBloom(event.clientX, event.clientY + window.scrollY);
      return;
    }

    stopActiveBloom();
    makeBloom(event.clientX, event.clientY);
  },
  { passive: true },
);

function findOpenViewportPoint() {
  const margin = 34;

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const x = margin + Math.random() * (window.innerWidth - margin * 2);
    const y = margin + Math.random() * (window.innerHeight - margin * 2);
    const element = document.elementFromPoint(x, y);

    if (!element?.closest("h1, nav")) {
      return { x, y: y + window.scrollY };
    }
  }

  return {
    x: window.innerWidth * (0.18 + Math.random() * 0.64),
    y: window.scrollY + window.innerHeight * (0.72 + Math.random() * 0.16),
  };
}

window.addEventListener(
  "pointerup",
  (event) => {
    if (event.pointerType !== "touch" && !mobilePointer.matches) return;
    finishTouchTap(event.clientX, event.clientY, event.target);
  },
  { passive: true },
);

window.addEventListener(
  "scroll",
  () => {
    if (!mobilePointer.matches) return;
    touchTapStart = null;

    const distance = Math.abs(window.scrollY - lastScrollStampY);
    if (distance < nextScrollDistance) return;

    const point = findOpenViewportPoint();
    makeBloom(point.x, point.y);
    lastScrollStampY = window.scrollY;
    nextScrollDistance = randomScrollDistance();
  },
  { passive: true },
);

window.addEventListener(
  "pointercancel",
  () => {
    touchTapStart = null;
    stopActiveBloom();
  },
  { passive: true },
);

window.addEventListener(
  "touchcancel",
  () => {
    touchTapStart = null;
    stopActiveBloom();
  },
  { passive: true },
);

window.addEventListener("blur", stopActiveBloom);
window.addEventListener("resize", () => {
  resizeCanvas();
  lastScrollStampY = window.scrollY;
});

mobilePointer.addEventListener("change", () => {
  stopActiveBloom();
  lastScrollStampY = window.scrollY;
  nextScrollDistance = randomScrollDistance();
  resizeCanvas();
  seedMobileTopBloom();
});

reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) stopActiveBloom();
  rebuildSettledLayer();
  render();
});

resizeCanvas();
seedMobileTopBloom();


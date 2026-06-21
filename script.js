const canvas = document.querySelector("#attention-canvas");
const context = canvas.getContext("2d", { alpha: true });
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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
const stillnessDelay = 500;
const stampCooldown = 500;
const ambientGrowthDuration = 60000;
const ambientGrowthAmount = 1;
const blooms = [];

let pixelRatio = 1;
let stillnessTimer = 0;
let activeBloom = null;
let animationFrame = 0;
let pointer = null;
let touchOrigin = null;
let lastStampAt = -Infinity;
let lastColorFieldIndex = -1;
let nextColorTemperature = "warm";
let lastShapeIndex = -1;

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function resizeCanvas() {
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * pixelRatio);
  canvas.height = Math.round(window.innerHeight * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  render();
}

function makeBloom(x, y) {
  const now = performance.now();
  if (now - lastStampAt < stampCooldown) return;

  const radius = 50 + Math.random() * 16;
  const opacity = 0.28 + Math.random() * 0.06;
  const colorRange =
    nextColorTemperature === "warm" ? [0, 1, 2, 3] : [4, 5, 6, 7];
  let fieldIndex = colorRange[Math.floor(Math.random() * colorRange.length)];
  if (fieldIndex === lastColorFieldIndex) {
    const alternatives = colorRange.filter(
      (index) => index !== lastColorFieldIndex,
    );
    fieldIndex = alternatives[Math.floor(Math.random() * alternatives.length)];
  }
  lastColorFieldIndex = fieldIndex;
  nextColorTemperature =
    nextColorTemperature === "warm" ? "cool" : "warm";
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

function drawBloom(bloom, now) {
  const [outer, inner] = bloom.colors;
  const age = Math.min((now - bloom.createdAt) / ambientGrowthDuration, 1);
  const ambientScale = reducedMotion.matches
    ? 1
    : 1 + age * ambientGrowthAmount;

  context.save();
  context.translate(bloom.x, bloom.y);
  context.rotate(bloom.rotation);
  context.translate(-bloom.x, -bloom.y);

  bloom.lobes.forEach((lobe) => {
    const x = bloom.x + lobe.offsetX;
    const y = bloom.y + lobe.offsetY;
    const radius = bloom.radius * lobe.radiusScale * ambientScale;
    const opacity = bloom.opacity * lobe.opacityScale;

    context.save();
    context.translate(x, y);
    context.scale(lobe.scaleX, lobe.scaleY);
    context.translate(-x, -y);

    const gradient = context.createRadialGradient(
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

    context.filter = "blur(12px)";
    context.fillStyle = gradient;
    context.fillRect(
      x - radius * 1.8,
      y - radius * 1.8,
      radius * 3.6,
      radius * 3.6,
    );
    context.restore();
  });

  context.restore();
}

function render(now = performance.now()) {
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  context.globalCompositeOperation = "multiply";

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

  blooms.forEach((bloom) => drawBloom(bloom, now));
}

function animate(now) {
  animationFrame = 0;
  render(now);
  const hasGrowingBlooms = blooms.some(
    (bloom) => now - bloom.createdAt < ambientGrowthDuration,
  );
  if (activeBloom?.active || hasGrowingBlooms) requestRender();
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

window.addEventListener(
  "pointermove",
  (event) => {
    if (event.pointerType === "touch") {
      if (
        touchOrigin &&
        Math.hypot(event.clientX - touchOrigin.x, event.clientY - touchOrigin.y) > 12
      ) {
        stopActiveBloom();
      }
      return;
    }

    stopActiveBloom();
    pointer = { x: event.clientX, y: event.clientY };
    scheduleBloom(pointer.x, pointer.y);
  },
  { passive: true },
);

window.addEventListener(
  "pointerdown",
  (event) => {
    if (event.pointerType !== "touch") return;
    stopActiveBloom();
    touchOrigin = { x: event.clientX, y: event.clientY };
    scheduleBloom(touchOrigin.x, touchOrigin.y);
  },
  { passive: true },
);

window.addEventListener(
  "click",
  (event) => {
    if (event.pointerType === "touch") return;
    stopActiveBloom();
    makeBloom(event.clientX, event.clientY);
  },
  { passive: true },
);

window.addEventListener(
  "pointerup",
  (event) => {
    if (event.pointerType !== "touch") return;
    stopActiveBloom();
    touchOrigin = null;
  },
  { passive: true },
);

window.addEventListener(
  "pointercancel",
  () => {
    stopActiveBloom();
    touchOrigin = null;
  },
  { passive: true },
);

window.addEventListener("blur", stopActiveBloom);
window.addEventListener("resize", resizeCanvas);

reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) stopActiveBloom();
  render();
});

resizeCanvas();

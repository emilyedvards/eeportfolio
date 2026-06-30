const canvas = document.querySelector("#corner-bloom-canvas");
const context = canvas.getContext("2d", { alpha: true });
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let pixelRatio = 1;
let animationFrame = 0;
let currentProgress = 0;
let targetProgress = 0;

const colors = {
  ice: { r: 117, g: 238, b: 255 },
  cyan: { r: 38, g: 190, b: 255 },
  cobalt: { r: 22, g: 92, b: 255 },
  violet: { r: 92, g: 66, b: 255 },
};

function resizeCanvas() {
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * pixelRatio);
  canvas.height = Math.round(window.innerHeight * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  updateTargetProgress();
  render();
}

function scrollProgress() {
  const maxScroll =
    document.documentElement.scrollHeight - window.innerHeight;

  if (maxScroll <= 0) return 0;
  return Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
}

function updateTargetProgress() {
  targetProgress = scrollProgress();

  if (reducedMotion.matches) {
    currentProgress = targetProgress;
    render();
    return;
  }

  requestRender();
}

function rgba(color, opacity) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
}

function drawCornerBloom(progress) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const centerX = width * 0.5;
  const centerY = height + Math.min(width, height) * 0.02;
  const baseRadius = Math.min(width, height) * 0.46;
  const radius = baseRadius + progress * Math.min(width, height) * 1.32;
  const opacity = 0.24 + progress * 0.4;

  context.save();
  context.globalCompositeOperation = "multiply";
  context.filter = `blur(${44 + progress * 58}px)`;
  context.translate(centerX, centerY);
  context.scale(1.55, 0.82);
  context.translate(-centerX, -centerY);

  const mainBloom = context.createRadialGradient(
    centerX,
    centerY,
    radius * 0.03,
    centerX,
    centerY,
    radius,
  );
  mainBloom.addColorStop(0, rgba(colors.violet, opacity * 0.7));
  mainBloom.addColorStop(0.18, rgba(colors.cobalt, opacity));
  mainBloom.addColorStop(0.44, rgba(colors.cyan, opacity * 0.74));
  mainBloom.addColorStop(0.74, rgba(colors.ice, opacity * 0.2));
  mainBloom.addColorStop(1, rgba(colors.ice, 0));

  context.fillStyle = mainBloom;
  context.fillRect(
    centerX - radius * 1.55,
    centerY - radius * 1.55,
    radius * 1.85,
    radius * 1.85,
  );

  const auraRadius = radius * 0.72;
  const auraX = centerX + radius * 0.08;
  const auraY = centerY - radius * 0.18;
  const aura = context.createRadialGradient(
    auraX,
    auraY,
    auraRadius * 0.02,
    auraX,
    auraY,
    auraRadius,
  );
  aura.addColorStop(0, rgba(colors.ice, opacity * 0.42));
  aura.addColorStop(0.36, rgba(colors.cyan, opacity * 0.28));
  aura.addColorStop(1, rgba(colors.cyan, 0));

  context.fillStyle = aura;
  context.fillRect(
    auraX - auraRadius,
    auraY - auraRadius,
    auraRadius * 1.5,
    auraRadius * 1.5,
  );
  context.restore();
}

function render() {
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  drawCornerBloom(currentProgress);
}

function animate() {
  animationFrame = 0;
  const distance = targetProgress - currentProgress;
  currentProgress += distance * 0.08;

  if (Math.abs(distance) < 0.001) {
    currentProgress = targetProgress;
  }

  render();

  if (currentProgress !== targetProgress) requestRender();
}

function requestRender() {
  if (!animationFrame) animationFrame = requestAnimationFrame(animate);
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("scroll", updateTargetProgress, { passive: true });
reducedMotion.addEventListener("change", updateTargetProgress);

resizeCanvas();

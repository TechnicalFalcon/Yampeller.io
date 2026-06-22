const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menuScreen = document.getElementById('menu-screen');
const hud = document.getElementById('hud');
const playerNameInput = document.getElementById('player-name');
const playBtn = document.getElementById('play-btn');
const partyBtn = document.getElementById('party-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const scoreVal = document.getElementById('score-val');
const healthBar = document.getElementById('health-bar');

let gameActive = false;
const arenaSize = 4000; 
let dpr = window.devicePixelRatio || 1;

let stars = [];
let nebulae = [];
let planets = []; 
const numStars = 4050; 
let nebulaCache = null; 

function initCosmos() {
stars = [];
nebulae = [];
planets = [];

const colors = [
{ r: 24, g: 8, b: 45, a: 0.18 },   
{ r: 6, g: 20, b: 35, a: 0.15 },   
{ r: 35, g: 2, b: 20, a: 0.10 },   
{ r: 0, g: 25, b: 25, a: 0.08 }    
];

for(let i = 0; i < 12; i++) {
nebulae.push({
x: Math.random() * arenaSize,
y: Math.random() * arenaSize,
radius: Math.random() * 500 + 400,
color: colors[i % colors.length]
    });
}

const planetColors = [
{ base: '#3a4f7c', shadow: '#151c2e', atmos: '#5b75b3', details: '#283759' },
{ base: '#e26d5c', shadow: '#4f1a13', atmos: '#f1a196', details: '#b84a39' },
{ base: '#2a6f97', shadow: '#012a4a', atmos: '#61a5c2', details: '#014f86' },
{ base: '#a1814c', shadow: '#3d301b', atmos: '#d1b88a', details: '#785f33' },
{ base: '#7b2cbf', shadow: '#240046', atmos: '#9d4edd', details: '#5a189a' }
];

for(let i = 0; i < 10; i++) {
const depth = Math.random() * 0.4 + 0.15; 
const palette = planetColors[Math.floor(Math.random() * planetColors.length)];
const radius = Math.random() * 80 + 50;
let surfaceFeatures = [];
const numFeatures = Math.floor(Math.random() * 5) + 4;
for(let f = 0; f < numFeatures; f++) {
surfaceFeatures.push({
relX: (Math.random() *1.2 - 0.6) * radius,
relY: (Math.random() * 1.2 - 0.6) * radius,
rad: Math.random() * (radius * 0.25) + (radius * 0.05)
    });
}

planets.push({
x: Math.random() * arenaSize,
y: Math.random() * arenaSize,
radius: radius,
baseColor: palette.base,
shadowColor: palette.shadow,
atmosColor: palette.atmos,
detailColor: palette.details,
features: surfaceFeatures,
depth: depth,
shadowAngle: Math.random() * Math.PI * 2,
hasRings: Math.random() > 0.5,
ringAngle: (Math.random() * 0.4 - 0.2) + Math.PI * 0.15,
ringColor: palette.atmos
    });
}

const starColors = ['#ffffff', '#fff5ea', '#eaf5ff', '#ffeaea', '#ffd7b3', '#b3f0ff'];
for(let i = 0; i < numStars; i++) {
const depth = Math.random(); 
stars.push({
x: Math.random() * arenaSize,
y: Math.random() * arenaSize,
size: depth * 1.8 + 0.2, 
color: starColors[Math.floor(Math.random() * starColors.length)],
depth: depth * 0.9 + 0.1, 
pulseSpeed: Math.random() * 0.04 + 0.01,
pulsePhase: Math.random() * Math.PI * 2
        });
    }
preRenderNebulae();
}

function preRenderNebulae() {
nebulaCache = document.createElement('canvas');
nebulaCache.width = arenaSize;
nebulaCache.height = arenaSize;
const nCtx = nebulaCache.getContext('2d');
nCtx.globalCompositeOperation = 'screen';
nebulae.forEach(neb => {
let grad = nCtx.createRadialGradient(neb.x, neb.y, 10, neb.x, neb.y, neb.radius);
grad.addColorStop(0, `rgba(${neb.color.r}, ${neb.color.g}, ${neb.color.b}, ${neb.color.a})`);
grad.addColorStop(0.5, `rgba(${neb.color.r}, ${neb.color.g}, ${neb.color.b}, ${neb.color.a * 0.3})`);
grad.addColorStop(1, 'rgba(0,0,0,0)');
nCtx.fillStyle = grad;
nCtx.beginPath();
nCtx.arc(neb.x, neb.y, neb.radius, 0, Math.PI * 2);
nCtx.fill();
    });
}

function resizeCanvas() {
dpr = window.devicePixelRatio || 1;
if (dpr > 2) dpr = 2; 
const width = window.innerWidth;
const height = window.innerHeight;
canvas.width = width * dpr;
canvas.height = height * dpr;
canvas.style.width = width + 'px';
canvas.style.height = height + 'px';
ctx.scale(dpr, dpr);
updateJoystickPositions();
}

let moveJoystick = { active: false, startX: 0, startY: 0, curX: 0, curY: 0, maxRadius: 50, moveX: 0, moveY: 0, id: null };
let aimJoystick = { active: false, startX: 0, startY: 0, curX: 0, curY: 0, maxRadius: 50, moveX: 0, moveY: 0, id: null };

function updateJoystickPositions() {
moveJoystick.startX = 100;
moveJoystick.startY = window.innerHeight - 100;
moveJoystick.curX = moveJoystick.startX;
moveJoystick.curY = moveJoystick.startY;
aimJoystick.startX = window.innerWidth - 100;
aimJoystick.startY = window.innerHeight - 100;
aimJoystick.curX = aimJoystick.startX;
aimJoystick.curY = aimJoystick.startY;
}

window.addEventListener('resize', resizeCanvas);
document.addEventListener('fullscreenchange', () => setTimeout(resizeCanvas, 100));

updateJoystickPositions();
resizeCanvas();
initCosmos();

let player;
let keys = {};
let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, worldX: 0, worldY: 0, moved: false };
let entities = { bullets: [], gems: [], particles: [] };

let isMobileDevice = false;
window.addEventListener('touchstart', function detectTouch() {
isMobileDevice = true;
window.removeEventListener('touchstart', detectTouch);
});

fullscreenBtn.addEventListener('click', () => {
if (!document.fullscreenElement) {
document.documentElement.requestFullscreen().catch(() => {});
} else {
document.exitFullscreen();
    }
});

class Particle {
constructor(x, y, vx, vy, size, color, maxLife, type = 'glow') {
this.x = x; this.y = y;
this.vx = vx; this.vy = vy;
this.size = size; this.color = color;
this.life = maxLife; this.maxLife = maxLife;
this.type = type;
    }
update() {
this.x += this.vx; this.y += this.vy;
if (this.type === 'explosion') {
this.vx *= 0.94; this.vy *= 0.94;
    }
this.life--;
}
draw(camX, camY) {
let alpha = this.life / this.maxLife;
ctx.save();
ctx.globalAlpha = alpha;
ctx.fillStyle = this.color;
if (this.type === 'explosion' && this.size > 2) {
ctx.shadowBlur = this.size * 1.5;
ctx.shadowColor = this.color;
}
ctx.beginPath();
ctx.arc(this.x - camX, this.y - camY, this.size, 0, Math.PI*2);
ctx.fill();
ctx.restore();
    }
}

function createExplosion(x, y, color, count = 15) {
for(let i = 0; i < count; i++) {
let angle = Math.random() * Math.PI * 2;
let speed = Math.random() * 4 + 2;
let size = Math.random() * 3 + 2;
let life = Math.random() * 20 + 20;
entities.particles.push(new Particle(
            x, y, 
Math.cos(angle) * speed, Math.sin(angle) * speed, 
size, color, life, 'explosion'
        ));
    }
}

class Player {
constructor(x, y, name) {
this.x = x; this.y = y;
this.name = name || 'Yampeller';
this.radius = 20;
this.vx = 0; this.vy = 0;
this.acceleration = 0.35;
this.friction = 0.93; 
this.maxSpeed = 6.5;
this.angle = 0; this.score = 0;
this.health = 100; this.maxHealth = 100;
this.lastShot = 0;
    }
update() {
let ax = 0; let ay = 0;
if (isMobileDevice && moveJoystick.active) {
ax = moveJoystick.moveX * this.acceleration;
ay = moveJoystick.moveY * this.acceleration;
} else {
if (keys['w'] || keys['arrowup']) ay -= this.acceleration;
if (keys['s'] || keys['arrowdown']) ay += this.acceleration;
if (keys['a'] || keys['arrowleft']) ax -= this.acceleration;
if (keys['d'] || keys['arrowright']) ax += this.acceleration;
}
this.vx += ax; this.vy += ay;
this.vx *= this.friction; this.vy *= this.friction; 
let currentSpeed = Math.hypot(this.vx, this.vy);
if (currentSpeed > this.maxSpeed) {
this.vx = (this.vx / currentSpeed) * this.maxSpeed;
this.vy = (this.vy / currentSpeed) * this.maxSpeed;
}
this.x += this.vx; this.y += this.vy;
if (this.x < this.radius) { this.x = this.radius; this.vx *= -0.5; }
if (this.x > arenaSize - this.radius) { this.x = arenaSize - this.radius; this.vx *= -0.5; }
if (this.y < this.radius) { this.y = this.radius; this.vy *= -0.5; }
if (this.y > arenaSize - this.radius) { this.y = arenaSize - this.radius; this.vy *= -0.5; }

if (isMobileDevice) {
if (aimJoystick.active) {
this.angle = Math.atan2(aimJoystick.moveY, aimJoystick.moveX);
} else if (moveJoystick.active && Math.hypot(moveJoystick.moveX, moveJoystick.moveY) > 0.1) {
this.angle = Math.atan2(moveJoystick.moveY, moveJoystick.moveX);
    }
} else {
if (mouse.moved || isMouseDown) {
mouse.worldX = mouse.x - (canvas.width / dpr) / 2 + this.x;
mouse.worldY = mouse.y - (canvas.height / dpr) / 2 + this.y;
this.angle = Math.atan2(mouse.worldY - this.y, mouse.worldX - this.x);
} else if (currentSpeed > 0.5) {
this.angle = Math.atan2(this.vy, this.vx);
    }
}

if (Math.hypot(ax, ay) > 0.05 || currentSpeed > 1) {
let trailAngle = this.angle + Math.PI + (Math.random() * 0.4 - 0.2);
let pX = this.x - Math.cos(this.angle) * 12;
let pY = this.y - Math.sin(this.angle) * 12;
let pVx = Math.cos(trailAngle) * (Math.random() * 3 + 1) + this.vx * 0.5;
let pVy = Math.sin(trailAngle) * (Math.random() * 3 + 1) + this.vy * 0.5;
entities.particles.push(new Particle(pX, pY, pVx, pVy, Math.random() * 2.5 + 1, '#00d5ff', Math.random() * 15 + 10, 'trail'));
    }
}
draw(camX, camY) {
ctx.save();
ctx.translate(this.x - camX, this.y - camY);
ctx.rotate(this.angle);
ctx.shadowBlur = 15; ctx.shadowColor = '#00d5ff';
ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
ctx.fillStyle = '#03030b';
ctx.beginPath();
ctx.moveTo(25, 0); ctx.lineTo(-15, -15);
ctx.lineTo(-5, 0); ctx.lineTo(-15, 15);
ctx.closePath();
ctx.fill();
ctx.stroke();
ctx.restore();
}
shoot() {
const now = Date.now();
if (now - this.lastShot >= 160) {
const cos = Math.cos(this.angle); const sin = Math.sin(this.angle);
entities.bullets.push(new Bullet(this.x + cos*25, this.y + sin*25, this.angle, '#00ffff'));
for(let i=0; i<3; i++) {
let flashAngle = this.angle + (Math.random()*0.6 - 0.3);
entities.particles.push(new Particle(
this.x + cos*25, this.y + sin*25, 
Math.cos(flashAngle)*(Math.random()*2+4), Math.sin(flashAngle)*(Math.random()*2+4),
2, '#ffffff', 8, 'trail'
    ));
            }
this.lastShot = now;
        }
    }
}

class Bullet {
constructor(x, y, angle, color) {
this.x = x; this.y = y;
this.vx = Math.cos(angle) * 15; this.vy = Math.sin(angle) * 15;
this.radius = 3; this.color = color;
this.life = 55;
    }
update() { 
this.x += this.vx; this.y += this.vy; 
this.life--; 
if (Math.random() > 0.4) {
entities.particles.push(new Particle(this.x, this.y, 0, 0, 1.5, this.color, 10, 'trail'));
    }
}
draw(camX, camY) {
ctx.save();
ctx.fillStyle = this.color;
ctx.shadowBlur = 10; ctx.shadowColor = this.color;
ctx.beginPath();
ctx.arc(this.x - camX, this.y - camY, this.radius, 0, Math.PI*2);
ctx.fill();
ctx.restore();
    }
}

class Gem {
constructor() {
this.x = Math.random() * arenaSize; this.y = Math.random() * arenaSize;
this.radius = 5;
this.color = Math.random() > 0.5 ? '#00ffaa' : '#ff00aa';
this.pulse = Math.random() * Math.PI;
    }
draw(camX, camY) {
this.pulse += 0.06;
let r = this.radius + Math.sin(this.pulse) * 1.8;
ctx.save();
ctx.fillStyle = this.color;
ctx.shadowBlur = 12; ctx.shadowColor = this.color;
ctx.beginPath();
ctx.arc(this.x - camX, this.y - camY, r, 0, Math.PI*2);
ctx.fill();
ctx.restore();
    }
}

function startGame() {
let name = playerNameInput.value.trim();
if(!name) name = "Player";
player = new Player(arenaSize/2, arenaSize/2, name);
entities.bullets = []; entities.gems = []; entities.particles = [];
for(let i=0; i<90; i++) entities.gems.push(new Gem());
gameActive = true;
menuScreen.classList.add('hidden');
hud.style.display = 'block';
}

let menuCamX = arenaSize / 2;
let menuCamY = arenaSize / 2;

function renderCinematicSpace(camX, camY) {
const logicalWidth = canvas.width / dpr;
const logicalHeight = canvas.height / dpr;
let bgGrad = ctx.createRadialGradient(logicalWidth/2, logicalHeight/2, 10, logicalWidth/2, logicalHeight/2, logicalWidth * 0.8);
bgGrad.addColorStop(0, '#040410');
bgGrad.addColorStop(1, '#010103');
ctx.fillStyle = bgGrad;
ctx.fillRect(0, 0, logicalWidth, logicalHeight);
if (!gameActive) {
let targetMenuX = (arenaSize / 2) + (mouse.x - logicalWidth / 2) * 0.8;
let targetMenuY = (arenaSize / 2) + (mouse.y - logicalHeight / 2) * 0.8;
menuCamX += (targetMenuX - menuCamX) * 0.08;
menuCamY += (targetMenuY - menuCamY) * 0.08;
camX = menuCamX;
camY = menuCamY;
}
ctx.save();
ctx.globalCompositeOperation = 'screen';
let nebParallaxX = -camX * 0.015;
let nebParallaxY = -camY * 0.015;
ctx.drawImage(nebulaCache, nebParallaxX, nebParallaxY);
if (nebParallaxX > 0) ctx.drawImage(nebulaCache, nebParallaxX - arenaSize, nebParallaxY);
if (nebParallaxY > 0) ctx.drawImage(nebulaCache, nebParallaxX, nebParallaxY - arenaSize);
ctx.restore();
planets.forEach(p => {
let px = (p.x - camX * p.depth);
let py = (p.y - camY * p.depth);
px = ((px % arenaSize) + arenaSize) % arenaSize;
py = ((py % arenaSize) + arenaSize) % arenaSize;
ctx.save();
let atmosGrad = ctx.createRadialGradient(px, py, p.radius * 0.8, px, py, p.radius * 1.2);
atmosGrad.addColorStop(0, p.atmosColor);
atmosGrad.addColorStop(0.3, p.atmosColor);
atmosGrad.addColorStop(1, 'rgba(0,0,0,0)');
ctx.fillStyle = atmosGrad;
ctx.globalAlpha = 0.6;
ctx.beginPath(); ctx.arc(px, py, p.radius * 1.2, 0, Math.PI * 2); ctx.fill();
ctx.globalAlpha = 1.0;
if (p.hasRings) {
ctx.save();
ctx.translate(px, py);
ctx.rotate(p.ringAngle);
ctx.strokeStyle = p.ringColor;
ctx.lineWidth = p.radius * 0.15;
ctx.globalAlpha = 0.4;
ctx.scale(2.2, 0.25);
ctx.beginPath();
ctx.arc(0, 0, p.radius * 0.8, Math.PI, 0);
ctx.stroke();
ctx.restore();
}
ctx.fillStyle = p.baseColor;
ctx.beginPath(); ctx.arc(px, py, p.radius, 0, Math.PI * 2); ctx.fill();
ctx.save();
ctx.beginPath(); ctx.arc(px, py, p.radius, 0, Math.PI * 2); ctx.clip();
ctx.fillStyle = p.detailColor;
p.features.forEach(f => {
ctx.beginPath();
ctx.arc(px + f.relX, py + f.relY, f.rad, 0, Math.PI * 2);
ctx.fill();
});
ctx.restore();
let shadowX = px + Math.cos(p.shadowAngle) * (p.radius * 0.4);
let shadowY = py + Math.sin(p.shadowAngle) * (p.radius * 0.4);
let shadowGrad = ctx.createRadialGradient(shadowX, shadowY, p.radius * 0.1, px, py, p.radius);
shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
shadowGrad.addColorStop(0.75, p.shadowColor);
shadowGrad.addColorStop(1, '#010105');
ctx.fillStyle = shadowGrad;
ctx.beginPath(); ctx.arc(px, py, p.radius + 1, 0, Math.PI * 2); ctx.fill();
if (p.hasRings) {
ctx.save();
ctx.translate(px, py);
ctx.rotate(p.ringAngle);
ctx.strokeStyle = p.ringColor;
ctx.lineWidth = p.radius * 0.15;
ctx.globalAlpha = 0.6;
ctx.scale(2.2, 0.25);
ctx.beginPath();
ctx.arc(0, 0, p.radius * 0.8, 0, Math.PI);
ctx.stroke();
ctx.restore();
    }
ctx.restore();
});

stars.forEach(star => {
let rx = (star.x - camX * star.depth * 0.25);
let ry = (star.y - camY * star.depth * 0.25);
rx = ((rx % arenaSize) + arenaSize) % arenaSize;
ry = ((ry % arenaSize) + arenaSize) % arenaSize;
star.pulsePhase += star.pulseSpeed;
let alpha = (0.35 + (Math.sin(star.pulsePhase) * 0.45)) * star.depth;
ctx.save();
ctx.globalAlpha = alpha;
ctx.fillStyle = star.color;
ctx.beginPath();
if (star.size > 1.5 && star.depth > 0.8) {
ctx.shadowBlur = 4;
ctx.shadowColor = star.color;
}
ctx.arc(rx, ry, star.size, 0, Math.PI*2);
ctx.fill();
ctx.restore();
    });
}

function drawVirtualJoysticks() {
if (!isMobileDevice) return;
ctx.save();
ctx.strokeStyle = moveJoystick.active ? 'rgba(0, 213, 255, 0.4)' : 'rgba(255, 255, 255, 0.15)';
ctx.lineWidth = 3;
ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
ctx.beginPath();
ctx.arc(moveJoystick.startX, moveJoystick.startY, moveJoystick.maxRadius, 0, Math.PI*2);
ctx.fill();
ctx.stroke();
ctx.strokeStyle = '#00d5ff';
ctx.fillStyle = 'rgba(0, 213, 255, 0.2)';
ctx.beginPath();
ctx.arc(moveJoystick.curX, moveJoystick.curY, 18, 0, Math.PI*2);
ctx.fill();
ctx.stroke();
ctx.restore();
ctx.save();
ctx.strokeStyle = aimJoystick.active ? 'rgba(255, 0, 170, 0.4)' : 'rgba(255, 255, 255, 0.15)';
ctx.lineWidth = 3;
ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
ctx.beginPath();
ctx.arc(aimJoystick.startX, aimJoystick.startY, aimJoystick.maxRadius, 0, Math.PI*2);
ctx.fill();
ctx.stroke();
ctx.strokeStyle = '#ff00aa';
ctx.fillStyle = 'rgba(255, 0, 170, 0.2)';
ctx.beginPath();
ctx.arc(aimJoystick.curX, aimJoystick.curY, 18, 0, Math.PI*2);
ctx.fill();
ctx.stroke();
ctx.restore();
}

function loop() {
const logicalWidth = canvas.width / dpr;
const logicalHeight = canvas.height / dpr;
let camX = 0; let camY = 0;
if(gameActive) {
camX = player.x - logicalWidth/2;
camY = player.y - logicalHeight/2;
}
renderCinematicSpace(camX, camY);
if(!gameActive) {
requestAnimationFrame(loop);
return;
}
if(!isMobileDevice && isMouseDown) player.shoot();
if(isMobileDevice && aimJoystick.active) player.shoot();
player.update();
ctx.strokeStyle = 'rgba(0, 213, 255, 0.02)'; ctx.lineWidth = 1;
for(let x = 0; x <= arenaSize; x += 400) {
ctx.beginPath(); ctx.moveTo(x - camX, 0 - camY); ctx.lineTo(x - camX, arenaSize - camY); ctx.stroke();
    }
for(let y = 0; y <= arenaSize; y += 400) {
ctx.beginPath(); ctx.moveTo(0 - camX, y - camY); ctx.lineTo(arenaSize - camX, y - camY); ctx.stroke();
}
ctx.strokeStyle = 'rgba(0, 213, 255, 0.2)'; ctx.lineWidth = 3;
ctx.shadowBlur = 10; ctx.shadowColor = '#00d5ff';
ctx.strokeRect(-camX, -camY, arenaSize, arenaSize);
ctx.shadowBlur = 0; 
for(let i = entities.particles.length - 1; i >= 0; i--) {
let p = entities.particles[i];
p.update();
p.draw(camX, camY);
if (p.life <= 0) entities.particles.splice(i, 1);
}
for(let i = entities.gems.length - 1; i >= 0; i--) {
let g = entities.gems[i]; 
g.draw(camX, camY);
if(Math.hypot(player.x - g.x, player.y - g.y) < player.radius + g.radius) {
player.score += 10; scoreVal.innerText = player.score;
createExplosion(g.x, g.y, g.color, 8); 
entities.gems.splice(i, 1); 
entities.gems.push(new Gem()); 
    }
}
for(let i = entities.bullets.length - 1; i >= 0; i--) {
let b = entities.bullets[i]; 
b.update(); 
b.draw(camX, camY);
if(b.x < 0 || b.x > arenaSize || b.y < 0 || b.y > arenaSize || b.life <= 0) {
createExplosion(b.x, b.y, b.color, 4); 
entities.bullets.splice(i, 1);
    }
}
player.draw(camX, camY);
drawVirtualJoysticks();
requestAnimationFrame(loop);
}

window.addEventListener('touchstart', e => {
if(!gameActive) return;
isMobileDevice = true;
for(let i = 0; i < e.changedTouches.length; i++) {
let t = e.changedTouches[i];
if(t.clientX < window.innerWidth / 2 && !moveJoystick.active) {
moveJoystick.active = true;
moveJoystick.id = t.identifier;
updateJoystickCalc(t, moveJoystick);
} 
else if(t.clientX >= window.innerWidth / 2 && !aimJoystick.active) {
aimJoystick.active = true;
aimJoystick.id = t.identifier;
updateJoystickCalc(t, aimJoystick);
        }
    }
});

window.addEventListener('touchmove', e => {
if(!gameActive) return;
for(let i = 0; i < e.touches.length; i++) {
let t = e.touches[i];
if(moveJoystick.active && t.identifier === moveJoystick.id) updateJoystickCalc(t, moveJoystick);
if(aimJoystick.active && t.identifier === aimJoystick.id) updateJoystickCalc(t, aimJoystick);
    }
});

window.addEventListener('touchend', e => {
for(let i = 0; i < e.changedTouches.length; i++) {
let t = e.changedTouches[i];
if(moveJoystick.active && t.identifier === moveJoystick.id) {
moveJoystick.active = false;
moveJoystick.moveX = 0; moveJoystick.moveY = 0;
moveJoystick.curX = moveJoystick.startX; moveJoystick.curY = moveJoystick.startY;
moveJoystick.id = null;
}
if(aimJoystick.active && t.identifier === aimJoystick.id) {
aimJoystick.active = false;
aimJoystick.moveX = 0; aimJoystick.moveY = 0;
aimJoystick.curX = aimJoystick.startX; aimJoystick.curY = aimJoystick.startY;
aimJoystick.id = null;
        }
    }
});

function updateJoystickCalc(touch, joystickObj) {
let dist = Math.hypot(touch.clientX - joystickObj.startX, touch.clientY - joystickObj.startY);
if(dist > joystickObj.maxRadius) {
let angle = Math.atan2(touch.clientY - joystickObj.startY, touch.clientX - joystickObj.startX);
joystickObj.curX = joystickObj.startX + Math.cos(angle) * joystickObj.maxRadius;
joystickObj.curY = joystickObj.startY + Math.sin(angle) * joystickObj.maxRadius;
} else {
joystickObj.curX = touch.clientX; joystickObj.curY = touch.clientY;
}
joystickObj.moveX = (joystickObj.curX - joystickObj.startX) / joystickObj.maxRadius;
joystickObj.moveY = (joystickObj.curY - joystickObj.startY) / joystickObj.maxRadius;
}

playBtn.addEventListener('click', startGame);
partyBtn.addEventListener('click', () => alert("Modo Party en desarrollo..."));

window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
window.addEventListener('mousemove', e => { 
mouse.x = e.clientX; 
mouse.y = e.clientY; 
mouse.moved = true; 
});

let isMouseDown = false;
window.addEventListener('mousedown', e => { if(e.button === 0) isMouseDown = true; });
window.addEventListener('mouseup', e => { if(e.button === 0) isMouseDown = false; });
loop();
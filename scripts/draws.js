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

// --- ELEMENTOS DEL DOM PARA LAS BARRAS ---
const specialBar = document.getElementById('special-bar');
const energyBar = document.getElementById('energy-bar');

const shotSound = new Howl({ src: ['sfx/ship_shot.wav'], volume: 0.5, preload: true });
const noShotSound = new Howl({ src: ['sfx/no_shot.wav'], volume: 0.5, preload: true });

let gameActive = false;
const arenaSize = 4000; 
let dpr = window.devicePixelRatio || 1;

let stars = [];
let nebulae = [];
let planets = []; 
let blackHoles = []; // Nueva lista para los agujeros negros del fondo
const numStars = 6000; // Más estrellas para un entorno denso y caótico
let nebulaCache = null; 

let peer = null;
let connection = null;       
let connectedPlayers = {};   
let isHost = false;
let isMultiplayer = false;
let networkTick = 0;

const ALLIED_BULLET_COLOR = '#00ffff'; 

let specialCooldown = false;
let specialLaserActive = false;
let specialLaserTimer = 0; 

// --- SISTEMA DE INFIERNO CÓSMICO (DECORACIÓN PURAMENTE ESTÉTICA) ---
let backgroundBots = [];
let backgroundBullets = []; // Balas exclusivas del fondo (no hacen daño al jugador)
const numBackgroundBots = 45; // ¡Súper caótico! Muchas naves peleando en segundo plano

class BackgroundBot {
    constructor() {
        this.reset();
    }
    reset() {
        this.x = Math.random() * arenaSize;
        this.y = Math.random() * arenaSize;
        this.vx = 0;
        this.vy = 0;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = Math.random() * 3 + 2;
        this.radius = Math.random() * 12 + 10;
        
        // Diseños de naves: 'interceptor', 'cruiser', 'fighter', 'drone'
        const designs = ['interceptor', 'cruiser', 'fighter', 'drone'];
        this.design = designs[Math.floor(Math.random() * designs.length)];
        
        // Paleta infernal para las naves decorativas
        const infernalColors = ['#ff3300', '#ffaa00', '#ff0055', '#7700aa', '#e60000'];
        this.color = infernalColors[Math.floor(Math.random() * infernalColors.length)];
        
        this.targetX = Math.random() * arenaSize;
        this.targetY = Math.random() * arenaSize;
        this.decisionTimer = Math.random() * 60 + 40;
        this.lastShot = 0;
        this.shootCooldown = Math.random() * 600 + 400; // Disparan muy rápido para simular guerra
    }
    update() {
        this.decisionTimer--;
        if (this.decisionTimer <= 0) {
            // IA caótica: ir a puntos aleatorios a máxima velocidad o seguir a otros bots cercanos
            if (Math.random() > 0.5 && backgroundBots.length > 1) {
                let randomBot = backgroundBots[Math.floor(Math.random() * backgroundBots.length)];
                if (randomBot !== this) {
                    this.targetX = randomBot.x;
                    this.targetY = randomBot.y;
                }
            } else {
                this.targetX = Math.random() * arenaSize;
                this.targetY = Math.random() * arenaSize;
            }
            this.decisionTimer = Math.random() * 120 + 60;
        }

        let targetAngle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
        let angleDiff = targetAngle - this.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        this.angle += angleDiff * 0.08;

        this.vx += Math.cos(this.angle) * 0.3;
        this.vy += Math.sin(this.angle) * 0.3;
        this.vx *= 0.94;
        this.vy *= 0.94;
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > arenaSize || this.y < 0 || this.y > arenaSize) {
            this.reset();
        }

        // Estela de fuego/plasma infernal
        if (Math.random() > 0.2) {
            let trailAngle = this.angle + Math.PI + (Math.random() * 0.5 - 0.25);
            entities.particles.push(new Particle(
                this.x - Math.cos(this.angle) * (this.radius * 0.7),
                this.y - Math.sin(this.angle) * (this.radius * 0.7),
                Math.cos(trailAngle) * 3,
                Math.sin(trailAngle) * 3,
                Math.random() * 2.5 + 0.8,
                this.color,
                12,
                'trail'
            ));
        }

        // Disparos decorativos automáticos entre bots
        let now = Date.now();
        if (now - this.lastShot > this.shootCooldown) {
            for (let i = 0; i < backgroundBots.length; i++) {
                let other = backgroundBots[i];
                if (other !== this && Math.hypot(this.x - other.x, this.y - other.y) < 500) {
                    backgroundBullets.push(new BackgroundBullet(
                        this.x + Math.cos(this.angle) * this.radius,
                        this.y + Math.sin(this.angle) * this.radius,
                        this.angle,
                        this.color
                    ));
                    this.lastShot = now;
                    this.shootCooldown = Math.random() * 700 + 300;
                    break;
                }
            }
        }
    }
    draw(camX, camY) {
        ctx.save();
        ctx.translate(this.x - camX, this.y - camY);
        ctx.rotate(this.angle);
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(20, 5, 5, 0.85)'; // Cabinas oscuras con tinte rojizo

        ctx.beginPath();
        if (this.design === 'interceptor') {
            // Diseño 1: Triángulo agresivo estilizado con alas dobles
            ctx.moveTo(this.radius * 1.3, 0);
            ctx.lineTo(-this.radius * 0.8, -this.radius * 0.9);
            ctx.lineTo(-this.radius * 0.3, -this.radius * 0.3);
            ctx.lineTo(-this.radius * 0.8, 0);
            ctx.lineTo(-this.radius * 0.3, this.radius * 0.3);
            ctx.lineTo(-this.radius * 0.8, this.radius * 0.9);
        } else if (this.design === 'cruiser') {
            // Diseño 2: Nave pesada con alas invertidas hacia adelante
            ctx.moveTo(this.radius * 1.1, 0);
            ctx.lineTo(this.radius * 0.4, -this.radius * 0.5);
            ctx.lineTo(-this.radius * 0.6, -this.radius * 1.1);
            ctx.lineTo(-this.radius * 0.4, -this.radius * 0.3);
            ctx.lineTo(-this.radius * 0.8, 0);
            ctx.lineTo(-this.radius * 0.4, this.radius * 0.3);
            ctx.lineTo(-this.radius * 0.6, this.radius * 1.1);
            ctx.lineTo(this.radius * 0.4, this.radius * 0.5);
        } else if (this.design === 'fighter') {
            // Diseño 3: Caza geométrico en forma de rombo de ataque
            ctx.moveTo(this.radius * 1.4, 0);
            ctx.lineTo(0, -this.radius * 0.7);
            ctx.lineTo(-this.radius * 0.9, -this.radius * 0.4);
            ctx.lineTo(-this.radius * 0.4, 0);
            ctx.lineTo(-this.radius * 0.9, this.radius * 0.4);
            ctx.lineTo(0, this.radius * 0.7);
        } else {
            // Diseño 4: Dron avanzado alienígena / hexagonal
            ctx.moveTo(this.radius, 0);
            ctx.lineTo(this.radius * 0.3, -this.radius * 0.8);
            ctx.lineTo(-this.radius * 0.7, -this.radius * 0.8);
            ctx.lineTo(-this.radius, 0);
            ctx.lineTo(-this.radius * 0.7, this.radius * 0.8);
            ctx.lineTo(this.radius * 0.3, this.radius * 0.8);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

// Balas puramente decorativas del fondo (no interactúan con las mecánicas lógicas del jugador)
class BackgroundBullet {
    constructor(x, y, angle, color) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.vx = Math.cos(angle) * 12;
        this.vy = Math.sin(angle) * 12;
        this.color = color;
        this.life = 45;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        if (Math.random() > 0.6) {
            entities.particles.push(new Particle(this.x, this.y, 0, 0, 1.2, this.color, 8, 'trail'));
        }

        // Colisión meramente visual entre las naves decorativas y las balas decorativas
        for (let i = 0; i < backgroundBots.length; i++) {
            let bot = backgroundBots[i];
            if (Math.hypot(this.x - bot.x, this.y - bot.y) < bot.radius) {
                createExplosion(bot.x, bot.y, bot.color, 10);
                this.life = 0;
                bot.reset(); // Reaparece instantáneamente creando el bucle sin fin caótico
                break;
            }
        }
    }
    draw(camX, camY) {
        ctx.save();
        ctx.translate(this.x - camX, this.y - camY);
        ctx.rotate(this.angle);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(12, 0);
        ctx.stroke();
        ctx.restore();
    }
}

// Inicializar ejércitos del fondo
for (let i = 0; i < numBackgroundBots; i++) {
    backgroundBots.push(new BackgroundBot());
}


function initCosmos(customCosmos = null) {
    stars = [];
    nebulae = [];
    planets = [];
    blackHoles = [];
    
    if (customCosmos) {
        nebulae = customCosmos.nebulae;
        planets = customCosmos.planets;
        stars = customCosmos.stars;
        if (customCosmos.blackHoles) blackHoles = customCosmos.blackHoles;
    } else {
        // COLORES INFERNALES: Magma, Fuego, Sangre y Ceniza cósmica
        const colors = [
            { r: 130, g: 15, b: 0, a: 0.28 },   // Rojo fuego intenso
            { r: 90, g: 0, b: 30, a: 0.24 },    // Sangre oscura
            { r: 140, g: 70, b: 0, a: 0.18 },   // Naranja magma ardiente
            { r: 40, g: 0, b: 50, a: 0.15 }     // Púrpura de vacío corrupto
        ];

        for(let i = 0; i < 26; i++) {
            nebulae.push({
                x: Math.random() * arenaSize,
                y: Math.random() * arenaSize,
                radius: Math.random() * 700 + 450,
                color: colors[i % colors.length],
                seed: Math.random() * 100
            });
        }

        // Planetas infernales o destruidos por el caos
        const planetColors = [
            { base: '#5e0b00', shadow: '#120000', atmos: '#ff4500', details: '#260400', glow: '#ff1a00' }, // Planeta de lava pura
            { base: '#2b2625', shadow: '#0d0d0d', atmos: '#e67300', details: '#ffcc00', glow: '#ffaa00' }, // Planeta fracturado fundido
            { base: '#1c0024', shadow: '#05000a', atmos: '#9933ff', details: '#4b0082', glow: '#cc33ff' }, // Gigante gaseoso de tormenta de plasma
            { base: '#423824', shadow: '#14110b', atmos: '#ffaa44', details: '#1c170e', glow: '#ff8800' }  // Asteroide masivo de fundición
        ];

        for(let i = 0; i < 14; i++) {
            const depth = Math.random() * 0.45 + 0.25; 
            const palette = planetColors[Math.floor(Math.random() * planetColors.length)];
            const radius = Math.random() * 95 + 60;
            let surfaceFeatures = [];
            const numFeatures = Math.floor(Math.random() * 8) + 7;
            
            for(let f = 0; f < numFeatures; f++) {
                surfaceFeatures.push({
                    relX: (Math.random() * 1.4 - 0.7) * radius,
                    relY: (Math.random() * 1.4 - 0.7) * radius,
                    rad: Math.random() * (radius * 0.4) + (radius * 0.08),
                    opacity: Math.random() * 0.5 + 0.3
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
                glowColor: palette.glow,
                features: surfaceFeatures,
                depth: depth,
                shadowAngle: Math.random() * Math.PI * 2,
                hasRings: Math.random() > 0.5,
                ringAngle: (Math.random() * 0.6 - 0.3) + Math.PI * 0.1,
                ringWidth: radius * (Math.random() * 0.35 + 0.25)
            });
        }

        // GENERACIÓN DE AGUJEROS NEGROS DESTRUCTIVOS EN EL FONDO
        for (let i = 0; i < 4; i++) {
            blackHoles.push({
                x: Math.random() * (arenaSize - 600) + 300,
                y: Math.random() * (arenaSize - 600) + 300,
                singularityRadius: Math.random() * 25 + 20,
                accretionRadius: Math.random() * 120 + 90,
                pulsePhase: Math.random() * Math.PI * 2,
                rotationSpeed: Math.random() * 0.04 + 0.02,
                currentRotation: Math.random() * Math.PI * 2,
                depth: Math.random() * 0.2 + 0.35 // ParalaX intermedio profundo
            });
        }

        const starColors = ['#ffffff', '#ffddcc', '#ffbb99', '#ff5533', '#ffdca3', '#ff3333'];
        for(let i = 0; i < numStars; i++) {
            const depth = Math.random(); 
            stars.push({
                x: Math.random() * arenaSize,
                y: Math.random() * arenaSize,
                size: depth * 2.5 + 0.2, 
                color: starColors[Math.floor(Math.random() * starColors.length)],
                depth: depth * 0.92 + 0.08, 
                pulseSpeed: Math.random() * 0.04 + 0.015,
                pulsePhase: Math.random() * Math.PI * 2,
                glow: depth > 0.8 && Math.random() > 0.6
            });
        }
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
        let grad = nCtx.createRadialGradient(neb.x, neb.y, neb.radius * 0.05, neb.x, neb.y, neb.radius);
        grad.addColorStop(0, `rgba(${neb.color.r}, ${neb.color.g}, ${neb.color.b}, ${neb.color.a})`);
        grad.addColorStop(0.3, `rgba(${neb.color.r}, ${neb.color.g}, ${neb.color.b}, ${neb.color.a * 0.8})`);
        grad.addColorStop(0.6, `rgba(${neb.color.r * 0.6}, ${neb.color.g * 0.2}, ${neb.color.b * 0.1}, ${neb.color.a * 0.3})`);
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
            this.vx *= 0.92; this.vy *= 0.92;
        }
        this.life--;
    }
    draw(camX, camY) {
        let alpha = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        if ((this.type === 'explosion' || this.type === 'trail') && this.size > 1.5) {
            ctx.shadowBlur = this.size * 3.5;
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
        let speed = Math.random() * 6 + 2;
        let size = Math.random() * 4 + 1.5;
        let life = Math.random() * 30 + 20;
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
        this.maxEnergy = 5000;
        this.energy = 5000;
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

        if (specialLaserActive && specialLaserTimer > 0) {
            ctx.save();
            ctx.translate(25, 0); 
            let originGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, 38);
            originGlow.addColorStop(0, '#ffffff');
            originGlow.addColorStop(0.2, '#00ffff');
            originGlow.addColorStop(0.6, 'rgba(0, 140, 255, 0.45)');
            originGlow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = originGlow;
            ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.fill();

            let wavePulse = Math.sin(Date.now() * 0.05) * 3;
            ctx.shadowBlur = 60; ctx.shadowColor = '#0044ff';
            ctx.strokeStyle = 'rgba(0, 90, 255, 0.5)';
            ctx.lineWidth = 26 + wavePulse; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1000, 0); ctx.stroke();

            ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 13 + (wavePulse * 0.5);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1000, 0); ctx.stroke();
            
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1000, 0); ctx.stroke();
            ctx.restore(); 

            for (let p = 0; p < 2; p++) {
                const laserDist = Math.random() * 1000;
                const offset = (Math.random() - 0.5) * 16; 
                const pX = this.x + Math.cos(this.angle) * (25 + laserDist) - Math.sin(this.angle) * offset;
                const pY = this.y + Math.sin(this.angle) * (25 + laserDist) + Math.cos(this.angle) * offset;
                entities.particles.push(new Particle(pX, pY, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, Math.random() * 2.5 + 1.5, '#00ffff', 22, 'trail'));
            }
            specialLaserTimer--;
            if (specialLaserTimer <= 0) specialLaserActive = false;
        }
        ctx.restore();
    }
    shoot() {
        if (this.energy <= 0) return;
        const now = Date.now();
        if (now - this.lastShot >= 60) {
            shotSound.play();
            this.energy--;
            if (energyBar) energyBar.style.width = (this.energy / this.maxEnergy * 100) + '%';
            const cos = Math.cos(this.angle); const sin = Math.sin(this.angle);
            const bx = this.x + cos * 25; const by = this.y + sin * 25;
            entities.bullets.push(new Bullet(bx, by, this.angle, ALLIED_BULLET_COLOR));
            
            if (isMultiplayer) {
                const bulletId = peer.id + '_' + now; 
                if (isHost) {
                    broadcastToClients({ type: 'spawn_bullet', id: bulletId, sender: 'host', x: bx, y: by, angle: this.angle, color: ALLIED_BULLET_COLOR });
                } else if (connection && connection.open) {
                    connection.send({ type: 'spawn_bullet', id: bulletId, sender: peer.id, x: bx, y: by, angle: this.angle, color: ALLIED_BULLET_COLOR }); 
                }
            }
            this.lastShot = now;
        }
    }
    fireSpecial() {
        if (specialCooldown) return;
        specialCooldown = true; specialLaserActive = true; specialLaserTimer = 35; 
        createExplosion(this.x + Math.cos(this.angle) * 25, this.y + Math.sin(this.angle) * 25, '#00ffff', 25); 
        if (specialBar) {
            specialBar.style.width = '0%'; specialBar.style.transition = 'none';
            void specialBar.offsetWidth; 
            specialBar.style.transition = 'width 20s linear'; specialBar.style.width = '100%';
        }
        setTimeout(() => { specialCooldown = false; }, 20000);
    }
}

class Bullet {
    constructor(x, y, angle, color) {
        this.x = x; this.y = y; this.angle = angle;
        this.vx = Math.cos(angle) * 15; this.vy = Math.sin(angle) * 15;
        this.length = 15; this.color = color; this.life = 55;
    }
    update() { 
        this.x += this.vx; this.y += this.vy; this.life--; 
        if (Math.random() > 0.4) entities.particles.push(new Particle(this.x, this.y, 0, 0, 1.5, this.color, 10, 'trail'));
    }
    draw(camX, camY) {
        ctx.save();
        ctx.translate(this.x - camX, this.y - camY);
        ctx.rotate(this.angle);
        ctx.strokeStyle = this.color; ctx.lineWidth = 3;
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(this.length, 0); ctx.stroke();
        ctx.restore();
    }
}

class Gem {
    constructor(x, y, color) {
        this.x = x !== undefined ? x : Math.random() * arenaSize; 
        this.y = y !== undefined ? y : Math.random() * arenaSize;
        this.radius = 5;
        this.color = color || (Math.random() > 0.5 ? '#ff5500' : '#ff0055'); // Gemas de magma e infernales
        this.pulse = Math.random() * Math.PI;
    }
    draw(camX, camY) {
        this.pulse += 0.06;
        let r = this.radius + Math.sin(this.pulse) * 1.8;
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 14; ctx.shadowColor = this.color;
        ctx.beginPath(); ctx.arc(this.x - camX, this.y - camY, r, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

function generateGemsArray() {
    let arr = [];
    for(let i=0; i<95; i++) {
        arr.push({ x: Math.random() * arenaSize, y: Math.random() * arenaSize, color: Math.random() > 0.5 ? '#ff5500' : '#ff0055' });
    }
    return arr;
}

function startGame(gemsData = null) {
    let name = playerNameInput.value.trim() || "Player";
    player = new Player(arenaSize/2, arenaSize/2, name);
    entities.bullets = []; entities.gems = []; entities.particles = []; backgroundBullets = [];
    if (gemsData) {
        gemsData.forEach(g => entities.gems.push(new Gem(g.x, g.y, g.color)));
    } else {
        generateGemsArray().forEach(g => entities.gems.push(new Gem(g.x, g.y, g.color)));
    }
    gameActive = true;
    menuScreen.classList.add('hidden');
    hud.style.display = 'block';
    if (energyBar) energyBar.style.width = '100%';
    if (specialBar) specialBar.style.width = '100%';
}

let menuCamX = arenaSize / 2;
let menuCamY = arenaSize / 2;

function renderCinematicSpace(camX, camY) {
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    
    // Fondo de vacío denso infernal
    let bgGrad = ctx.createRadialGradient(logicalWidth/2, logicalHeight/2, 50, logicalWidth/2, logicalHeight/2, logicalWidth * 0.95);
    bgGrad.addColorStop(0, '#0a0100');
    bgGrad.addColorStop(0.6, '#030000');
    bgGrad.addColorStop(1, '#000000');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    
    if (!gameActive) {
        let targetMenuX = (arenaSize / 2) + (mouse.x - logicalWidth / 2) * 0.8;
        let targetMenuY = (arenaSize / 2) + (mouse.y - logicalHeight / 2) * 0.8;
        menuCamX += (targetMenuX - menuCamX) * 0.08;
        menuCamY += (targetMenuY - menuCamY) * 0.08;
        camX = menuCamX; camY = menuCamY;
    }
    
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    let nebParallaxX = -camX * 0.015; let nebParallaxY = -camY * 0.015;
    ctx.drawImage(nebulaCache, nebParallaxX, nebParallaxY);
    if (nebParallaxX > 0) ctx.drawImage(nebulaCache, nebParallaxX - arenaSize, nebParallaxY);
    if (nebParallaxY > 0) ctx.drawImage(nebulaCache, nebParallaxX, nebParallaxY - arenaSize);
    ctx.restore();

    // DIBUJAR AGUJEROS NEGROS DEL FONDO CON EFECTO DE DISTORSIÓN Y DISCO DE ACRECIÓN ARDIENTE
    blackHoles.forEach(bh => {
        let bx = (bh.x - camX * bh.depth);
        let by = (bh.y - camY * bh.depth);
        bx = ((bx % arenaSize) + arenaSize) % arenaSize;
        by = ((by % arenaSize) + arenaSize) % arenaSize;

        bh.currentRotation += bh.rotationSpeed;
        bh.pulsePhase += 0.05;
        let pulseGlow = Math.sin(bh.pulsePhase) * 6;

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(bh.currentRotation);

        // 1. Brillo exterior térmico del disco
        let outerAcreDistortion = ctx.createRadialGradient(0, 0, bh.singularityRadius * 1.2, 0, 0, bh.accretionRadius + pulseGlow);
        outerAcreDistortion.addColorStop(0, 'rgba(255, 60, 0, 0.7)');
        outerAcreDistortion.addColorStop(0.3, 'rgba(255, 150, 0, 0.4)');
        outerAcreDistortion.addColorStop(0.7, 'rgba(120, 0, 255, 0.15)'); // Distorsión gravitacional púrpura en bordes
        outerAcreDistortion.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = outerAcreDistortion;
        ctx.beginPath(); ctx.arc(0, 0, bh.accretionRadius + pulseGlow, 0, Math.PI * 2); ctx.fill();

        // 2. Anillo de fuego asimétrico (simulación de Relatividad/Doppler)
        ctx.scale(1.5, 0.65);
        ctx.strokeStyle = '#ffdd00';
        ctx.lineWidth = 7;
        ctx.shadowBlur = 25; ctx.shadowColor = '#ff4500';
        ctx.beginPath(); ctx.arc(0, 0, bh.singularityRadius * 2.5, 0, Math.PI * 1.2); ctx.stroke();
        ctx.restore();

        // 3. Horizonte de sucesos / Singularidad central (Absorción de luz pura)
        ctx.save();
        ctx.translate(bx, by);
        ctx.fillStyle = '#000000';
        ctx.shadowBlur = 15; ctx.shadowColor = '#000000';
        ctx.beginPath(); ctx.arc(0, 0, bh.singularityRadius, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });

    planets.forEach(p => {
        let px = (p.x - camX * p.depth); let py = (p.y - camY * p.depth);
        px = ((px % arenaSize) + arenaSize) % arenaSize; py = ((py % arenaSize) + arenaSize) % arenaSize;
        
        ctx.save();
        let atmosGrad = ctx.createRadialGradient(px, py, p.radius * 0.85, px, py, p.radius * 1.3);
        atmosGrad.addColorStop(0, p.atmosColor);
        atmosGrad.addColorStop(0.2, p.atmosColor);
        atmosGrad.addColorStop(0.6, `rgba(${parseInt(p.glowColor.slice(1,3),16)||255}, 40, 0, 0.3)`);
        atmosGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = atmosGrad; ctx.globalAlpha = 0.75;
        ctx.beginPath(); ctx.arc(px, py, p.radius * 1.3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1.0;
        
        if (p.hasRings) {
            ctx.save(); ctx.translate(px, py); ctx.rotate(p.ringAngle); ctx.scale(2.4, 0.28);
            ctx.strokeStyle = p.atmosColor; ctx.lineWidth = p.ringWidth * 0.4; ctx.globalAlpha = 0.25;
            ctx.beginPath(); ctx.arc(0, 0, p.radius * 0.95, Math.PI, 0); ctx.stroke();
            ctx.restore();
        }
        
        ctx.fillStyle = p.baseColor;
        ctx.beginPath(); ctx.arc(px, py, p.radius, 0, Math.PI * 2); ctx.fill();
        
        ctx.save();
        ctx.beginPath(); ctx.arc(px, py, p.radius, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = p.detailColor;
        p.features.forEach(f => {
            ctx.globalAlpha = f.opacity;
            ctx.beginPath(); ctx.arc(px + f.relX, py + f.relY, f.rad, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();
        
        let shadowGrad = ctx.createRadialGradient(px + Math.cos(p.shadowAngle) * (p.radius * 0.45), py + Math.sin(p.shadowAngle) * (p.radius * 0.45), p.radius * 0.05, px, py, p.radius);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0)'); shadowGrad.addColorStop(0.75, p.shadowColor); shadowGrad.addColorStop(1, '#050000');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath(); ctx.arc(px, py, p.radius + 1.5, 0, Math.PI * 2); ctx.fill();
        
        if (p.hasRings) {
            ctx.save(); ctx.translate(px, py); ctx.rotate(p.ringAngle); ctx.scale(2.4, 0.28);
            ctx.strokeStyle = p.atmosColor; ctx.lineWidth = p.ringWidth * 0.4; ctx.globalAlpha = 0.55;
            ctx.beginPath(); ctx.arc(0, 0, p.radius * 0.95, 0, Math.PI); ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
    });

    stars.forEach(star => {
        let rx = (star.x - camX * star.depth * 0.22); let ry = (star.y - camY * star.depth * 0.22);
        rx = ((rx % arenaSize) + arenaSize) % arenaSize; ry = ((ry % arenaSize) + arenaSize) % arenaSize;
        star.pulsePhase += star.pulseSpeed;
        let alpha = (0.35 + (Math.sin(star.pulsePhase) * 0.55)) * star.depth;
        
        ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = star.color;
        if (star.glow) { 
            ctx.shadowBlur = 8; ctx.shadowColor = star.color;
            ctx.beginPath(); ctx.arc(rx, ry, star.size * 1.35, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.beginPath(); ctx.arc(rx, ry, star.size, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    });
}

function drawVirtualJoysticks() {
    if (!isMobileDevice) return;
    ctx.save();
    ctx.strokeStyle = moveJoystick.active ? 'rgba(0, 213, 255, 0.4)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 3; ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.beginPath(); ctx.arc(moveJoystick.startX, moveJoystick.startY, moveJoystick.maxRadius, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#00d5ff'; ctx.fillStyle = 'rgba(0, 213, 255, 0.2)';
    ctx.beginPath(); ctx.arc(moveJoystick.curX, moveJoystick.curY, 18, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = aimJoystick.active ? 'rgba(255, 0, 170, 0.4)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 3; ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.beginPath(); ctx.arc(aimJoystick.startX, aimJoystick.startY, aimJoystick.maxRadius, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#ff00aa'; ctx.fillStyle = 'rgba(255, 0, 170, 0.2)';
    ctx.beginPath(); ctx.arc(aimJoystick.curX, aimJoystick.curY, 18, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.restore();
}

function broadcastToClients(msg) {
    if (peer && peer.connections) {
        Object.keys(peer.connections).forEach(peerId => {
            peer.connections[peerId].forEach(c => { if (c.open) c.send(msg); });
        });
    }
}

// --- BUCLE PRINCIPAL (LOOP) ---
function loop() {
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    let camX = menuCamX; let camY = menuCamY;
    if(gameActive) {
        camX = player.x - logicalWidth/2;
        camY = player.y - logicalHeight/2;
    }
    renderCinematicSpace(camX, camY);

    // Actualizar y dibujar ejércitos e ráfagas del fondo (Acción fluida e inofensiva siempre corriendo)
    backgroundBots.forEach(bot => {
        bot.update();
        bot.draw(camX, camY);
    });
    for (let i = backgroundBullets.length - 1; i >= 0; i--) {
        let bb = backgroundBullets[i];
        bb.update();
        bb.draw(camX, camY);
        if (bb.life <= 0 || bb.x < 0 || bb.x > arenaSize || bb.y < 0 || bb.y > arenaSize) {
            backgroundBullets.splice(i, 1);
        }
    }

    if(!gameActive) {
        for(let i = entities.particles.length - 1; i >= 0; i--) {
            let p = entities.particles[i]; p.update(); p.draw(camX, camY);
            if (p.life <= 0) entities.particles.splice(i, 1);
        }
        requestAnimationFrame(loop);
        return;
    }

    if(!isMobileDevice && isMouseDown) player.shoot();
    if(isMobileDevice && aimJoystick.active) player.shoot();
    player.update();

    if (isMultiplayer) {
        networkTick++;
        if (networkTick % 4 === 0) { 
            if (isHost) {
                let dataToSend = {};
                Object.keys(connectedPlayers).forEach(id => {
                    dataToSend[id] = { x: connectedPlayers[id].x, y: connectedPlayers[id].y, angle: connectedPlayers[id].angle, name: connectedPlayers[id].name, vx: connectedPlayers[id].vx, vy: connectedPlayers[id].vy };
                });
                dataToSend['host'] = { x: player.x, y: player.y, angle: player.angle, name: player.name, vx: player.vx, vy: player.vy };
                broadcastToClients({ type: 'host_update', players: dataToSend });
            } else if (connection && connection.open) {
                connection.send({ type: 'client_update', x: player.x, y: player.y, angle: player.angle, name: player.name, vx: player.vx, vy: player.vy });
            }
        }
    }
    
    ctx.strokeStyle = 'rgba(255, 68, 0, 0.03)'; ctx.lineWidth = 1; // Cuadrícula de arena volcánica
    for(let x = 0; x <= arenaSize; x += 400) {
        ctx.beginPath(); ctx.moveTo(x - camX, 0 - camY); ctx.lineTo(x - camX, arenaSize - camY); ctx.stroke();
    }
    for(let y = 0; y <= arenaSize; y += 400) {
        ctx.beginPath(); ctx.moveTo(0 - camX, y - camY); ctx.lineTo(arenaSize - camX, y - camY); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 40, 0, 0.25)'; ctx.lineWidth = 3;
    ctx.shadowBlur = 10; ctx.shadowColor = '#ff3300';
    ctx.strokeRect(-camX, -camY, arenaSize, arenaSize);
    ctx.shadowBlur = 0; 
    
    for(let i = entities.particles.length - 1; i >= 0; i--) {
        let p = entities.particles[i]; p.update(); p.draw(camX, camY);
        if (p.life <= 0) entities.particles.splice(i, 1);
    }

    for(let i = entities.gems.length - 1; i >= 0; i--) {
        let g = entities.gems[i]; g.draw(camX, camY);
        if(Math.hypot(player.x - g.x, player.y - g.y) < player.radius + g.radius) {
            player.score += 10; scoreVal.innerText = player.score;
            createExplosion(g.x, g.y, g.color, 8); 
            entities.gems.splice(i, 1); 
            if (isMultiplayer) {
                if (isHost) {
                    broadcastToClients({ type: 'gem_collected_by_anyone', index: i });
                    let newGem = new Gem(); entities.gems.push(newGem);
                    broadcastToClients({ type: 'gem_spawned', x: newGem.x, y: newGem.y, color: newGem.color });
                } else if (connection && connection.open) {
                    connection.send({ type: 'client_gem_collected', index: i });
                }
            } else {
                entities.gems.push(new Gem());
            }
        }
    }

    for(let i = entities.bullets.length - 1; i >= 0; i--) {
        let b = entities.bullets[i]; b.update(); b.draw(camX, camY);
        if(b.x < 0 || b.x > arenaSize || b.y < 0 || b.y > arenaSize || b.life <= 0) {
            createExplosion(b.x, b.y, b.color, 4); entities.bullets.splice(i, 1);
        }
    }

    Object.keys(connectedPlayers).forEach(id => {
        if (!isHost && id === peer.id) return; if (isHost && id === 'host') return;
        let p = connectedPlayers[id];
        if(p.targetX !== undefined) {
            p.x += (p.targetX - p.x) * 0.25; p.y += (p.targetY - p.y) * 0.25;
            let angleDiff = p.targetAngle - p.angle;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            p.angle += angleDiff * 0.25;
        }
        if (Math.hypot(p.vx || 0, p.vy || 0) > 1) {
            let trailAngle = p.angle + Math.PI + (Math.random() * 0.4 - 0.2);
            entities.particles.push(new Particle(p.x - Math.cos(p.angle)*12, p.y - Math.sin(p.angle)*12, Math.cos(trailAngle)*3, Math.sin(trailAngle)*3, Math.random()*2.5+1, '#00d5ff', 12, 'trail'));
        }
        ctx.save(); ctx.translate(p.x - camX, p.y - camY); ctx.rotate(p.angle);
        ctx.shadowBlur = 15; ctx.shadowColor = '#00d5ff';
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.fillStyle = '#0a030b';
        ctx.beginPath(); ctx.moveTo(25, 0); ctx.lineTo(-15, -15); ctx.lineTo(-5, 0); ctx.lineTo(-15, 15); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
        ctx.save(); ctx.fillStyle = '#ffffff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(p.name, p.x - camX, p.y - camY - 25); ctx.restore();
    });

    player.draw(camX, camY);
    drawVirtualJoysticks();
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

window.addEventListener('touchstart', e => {
    if(!gameActive) return;
    isMobileDevice = true;
    for(let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i];
        if(t.clientX < window.innerWidth / 2 && !moveJoystick.active) {
            moveJoystick.active = true; moveJoystick.id = t.identifier;
            updateJoystickCalc(t, moveJoystick);
        } else if(t.clientX >= window.innerWidth / 2 && !aimJoystick.active) {
            aimJoystick.active = true; aimJoystick.id = t.identifier;
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
            moveJoystick.active = false; moveJoystick.moveX = 0; moveJoystick.moveY = 0;
            moveJoystick.curX = moveJoystick.startX; moveJoystick.curY = moveJoystick.startY; moveJoystick.id = null;
        }
        if(aimJoystick.active && t.identifier === aimJoystick.id) {
            aimJoystick.active = false; aimJoystick.moveX = 0; aimJoystick.moveY = 0;
            aimJoystick.curX = aimJoystick.startX; aimJoystick.curY = aimJoystick.startY; aimJoystick.id = null;
            noShotSound.play();
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

playBtn.addEventListener('click', () => startGame());
partyBtn.addEventListener('click', () => {
    const partyOptions = document.getElementById('party-options');
    if (partyOptions) partyOptions.style.display = partyOptions.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('host-btn').addEventListener('click', () => {
    isHost = true; isMultiplayer = true;
    peer = new Peer({ config: { 'iceServers': [{ url: 'stun:stun.l.google.com:19302' }] } });
    peer.on('open', (id) => {
        document.getElementById('room-info').innerHTML = `
        SPACE INIT.<br>Pásale este ID a tu amigo:<br>
        <strong id="copy-target" style="color:#ff3300">${id}</strong><br><br>
        <button id="copy-btn" class="neon-btn neon-blue" style="font-size:0.9rem; padding:5px 10px; margin-bottom:10px; width:80%;">📋 COPIAR ID</button>
        <button id="manual-start-btn" class="neon-btn neon-red" style="font-size:1.1rem; padding:8px 15px; width:100%;">¡EMPEZAR PARTIDA!</button>
        `;
        document.getElementById('copy-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(id).then(() => {
                const copyBtn = document.getElementById('copy-btn');
                copyBtn.innerText = "¡COPIADO!"; copyBtn.style.borderColor = "#ffcc00";
                setTimeout(() => { copyBtn.innerText = "📋 COPIAR ID"; copyBtn.style.borderColor = "#ff3300"; }, 2000);
            });
        });
        document.getElementById('manual-start-btn').addEventListener('click', () => startGame());
    });

    peer.on('connection', (conn) => {
        conn.on('open', () => {
            conn.send({ 
                type: 'init_world', 
                gems: entities.gems.map(g => ({ x: g.x, y: g.y, color: g.color })),
                cosmos: { nebulae: nebulae, planets: planets, stars: stars, blackHoles: blackHoles }
            });
        });
        conn.on('data', (data) => {
            if (data.type === 'client_update') {
                if(!connectedPlayers[conn.peer]) connectedPlayers[conn.peer] = { x: data.x, y: data.y, angle: data.angle, name: data.name, vx: data.vx, vy: data.vy };
                connectedPlayers[conn.peer].targetX = data.x; connectedPlayers[conn.peer].targetY = data.y;
                connectedPlayers[conn.peer].targetAngle = data.angle; connectedPlayers[conn.peer].name = data.name;
                connectedPlayers[conn.peer].vx = data.vx; connectedPlayers[conn.peer].vy = data.vy;
            }
            if (data.type === 'spawn_bullet') {
                if (!data.id.startsWith(peer.id)) { entities.bullets.push(new Bullet(data.x, data.y, data.angle, ALLIED_BULLET_COLOR)); shotSound.play(); }
                broadcastToClients({ type: 'spawn_bullet', id: data.id, sender: data.sender, x: data.x, y: data.y, angle: data.angle, color: ALLIED_BULLET_COLOR });
            }
            if (data.type === 'client_gem_collected' && entities.gems[data.index]) {
                entities.gems.splice(data.index, 1);
                broadcastToClients({ type: 'gem_collected_by_anyone', index: data.index });
                let newGem = new Gem(); entities.gems.push(newGem);
                broadcastToClients({ type: 'gem_spawned', x: newGem.x, y: newGem.y, color: newGem.color });
            }
        });
    });
});

document.getElementById('join-btn').addEventListener('click', () => {
    const targetId = prompt("Introduce el ID de la sala de tu amigo:");
    if (!targetId) return;
    isHost = false; isMultiplayer = true;
    peer = new Peer({ config: { 'iceServers': [{ url: 'stun:stun.l.google.com:19302' }] } });
    peer.on('open', () => {
        connection = peer.connect(targetId);
        connection.on('data', (data) => {
            if (data.type === 'init_world') { initCosmos(data.cosmos); startGame(data.gems); }
            if (data.type === 'host_update') {
                Object.keys(data.players).forEach(id => {
                    if (id === peer.id) return; 
                    if (!connectedPlayers[id]) { connectedPlayers[id] = data.players[id]; } else {
                        connectedPlayers[id].targetX = data.players[id].x; connectedPlayers[id].targetY = data.players[id].y;
                        connectedPlayers[id].targetAngle = data.players[id].angle; connectedPlayers[id].name = data.players[id].name;
                        connectedPlayers[id].vx = data.players[id].vx; connectedPlayers[id].vy = data.players[id].vy;
                    }
                });
            }
            if (data.type === 'spawn_bullet' && data.sender !== peer.id) { entities.bullets.push(new Bullet(data.x, data.y, data.angle, ALLIED_BULLET_COLOR)); shotSound.play(); }
            if (data.type === 'gem_collected_by_anyone' && entities.gems[data.index]) entities.gems.splice(data.index, 1);
            if (data.type === 'gem_spawned') entities.gems.push(new Gem(data.x, data.y, data.color));
        });
    });
});

window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.moved = true; });
window.addEventListener('contextmenu', e => { if (gameActive) e.preventDefault(); });

let isMouseDown = false;
window.addEventListener('mousedown', e => { 
    if(!gameActive) return;
    if(e.button === 0) isMouseDown = true; 
    else if(e.button === 2) player.fireSpecial();
});
window.addEventListener('mouseup', e => { if(e.button === 0 && isMouseDown) { isMouseDown = false; noShotSound.play(); } });
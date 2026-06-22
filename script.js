// ==================== CONFIG ====================
const LINE_COLOR = '#E0779A';
const START_DATE = new Date('2026-06-20T22:30:00');
const MAX_PARTICLES = 100;
const SPAWN_INTERVAL = 1500;
const SPAWN_AMOUNT = 3;
const CENTER_SOFT_RADIUS = 180;
const COLLECTION_RADIUS = 55;
const PARTICLES_NEEDED = 20;

let particles = [];
let clockMode = 0;
let lastSpawnTime = 0;
let collectedParticles = [];
let bursts = [];
let isMouseActive = false;
let lastMouseMove = 0;
let cursorX = 0;
let cursorY = 0;
let heartPoints = [];
let wasDragged = false;
let lastTapTime = 0;
let lastTapX = 0;
let lastTapY = 0;

// ==================== MILESTONES ====================
const MILESTONES = [
    { days: 100,  name: '100 Days' },
    { days: 200,  name: '200 Days' },
    { days: 300,  name: '300 Days' },
    { days: 365,  name: '1 Year Anniversary' },
    { days: 500,  name: '500 Days' },
    { days: 730,  name: '2 Years Anniversary' },
    { days: 1000, name: '1000 Days' },
    { days: 1095, name: '3 Years Anniversary' },
    { days: 1460, name: '4 Years Anniversary' },
    { days: 1825, name: '5 Years Anniversary' }
];

// ==================== HELPERS ====================
function calculateHeartPoints(n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const s = 4;
        pts.push({
            x: s * 16 * Math.pow(Math.sin(t), 3),
            y: -s * (13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t))
        });
    }
    return pts;
}

// Draws a heart shape. Caller sets fill/stroke before calling.
function drawHeart(cx, cy, size) {
    beginShape();
    for (let t = 0; t < Math.PI * 2; t += 0.25) {
        const hx = cx + size * Math.pow(Math.sin(t), 3);
        const hy = cy - size * (13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t)) / 16;
        vertex(hx, hy);
    }
    endShape(CLOSE);
}

// ==================== PARTICLE ====================
class Particle {
    constructor(x, y) {
        this.x = x ?? Math.random() * windowWidth;
        this.y = y ?? Math.random() * windowHeight;
        this.baseX = this.x;
        this.baseY = this.y;
        this.vx = Math.random() - 0.5;
        this.vy = Math.random() - 0.5;
        this.noiseX = Math.random() * 1000;
        this.noiseY = Math.random() * 1000;
        this.collected = false;
        this.size = 4;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.heartIndex = -1;
        this.glowSize = 0;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.06;
        // 40% dot, 40% heart, 20% sparkle
        const r = Math.random();
        this.type = r < 0.4 ? 'dot' : r < 0.8 ? 'heart' : 'sparkle';
    }

    update() {
        if (this.collected) {
            if (this.heartIndex >= 0 && this.heartIndex < heartPoints.length) {
                const tp = heartPoints[this.heartIndex];
                this.x += (cursorX + tp.x - this.x) * 0.15;
                this.y += (cursorY + tp.y - this.y) * 0.15;
                this.pulsePhase += 0.08;
                this.size = 5 + Math.sin(this.pulsePhase) * 1.5;
                this.glowSize = 12 + Math.sin(this.pulsePhase) * 3;
                this.rotation += this.rotSpeed;
            }
            return;
        }

        this.noiseX += 0.008;
        this.noiseY += 0.008;

        let tx = this.baseX + (noise(this.noiseX) - 0.5) * 100;
        let ty = this.baseY + (noise(this.noiseY) - 0.5) * 100;

        this.baseX += this.vx * 0.5;
        this.baseY += this.vy * 0.5;

        // Soft center avoidance
        const dx = this.x - width / 2;
        const dy = this.y - height / 2;
        const dc = Math.sqrt(dx*dx + dy*dy);
        if (dc < CENTER_SOFT_RADIUS && dc > 0) {
            const push = map(dc, 0, CENTER_SOFT_RADIUS, 1, 0);
            tx += dx/dc * push * 3;
            ty += dy/dc * push * 3;
        }

        // Cursor interaction
        if (isMouseActive) {
            const cdx = cursorX - this.x;
            const cdy = cursorY - this.y;
            const cd = Math.sqrt(cdx*cdx + cdy*cdy);

            if (cd > 1) {
                if (mouseIsPressed && cd < 280) {
                    // Vortex: clockwise orbit + slight inward pull
                    const f = map(cd, 0, 280, 5, 0.4);
                    tx += (-cdy/cd * 3.0 + cdx/cd * 0.4) * f;
                    ty += ( cdx/cd * 3.0 + cdy/cd * 0.4) * f;
                } else if (!mouseIsPressed && cd < COLLECTION_RADIUS) {
                    // Gentle attraction for collection
                    const pull = map(cd, 0, COLLECTION_RADIUS, 7, 1);
                    tx += cdx/cd * pull;
                    ty += cdy/cd * pull;
                }
            }
        }

        this.x += (tx - this.x) * 0.05;
        this.y += (ty - this.y) * 0.05;
        this.rotation += this.rotSpeed;

        if (this.baseX < -50) this.baseX = width + 50;
        if (this.baseX > width + 50) this.baseX = -50;
        if (this.baseY < -50) this.baseY = height + 50;
        if (this.baseY > height + 50) this.baseY = -50;

        this.pulsePhase += 0.05;
        this.size = 4 + Math.sin(this.pulsePhase);
    }

    display() {
        const nearMouse = isMouseActive && !mouseIsPressed && dist(this.x, this.y, cursorX, cursorY) < COLLECTION_RADIUS;
        if (this.collected || nearMouse) {
            const glow = this.collected
                ? this.glowSize
                : map(dist(this.x, this.y, cursorX, cursorY), 0, COLLECTION_RADIUS, 16, 5);
            fill(LINE_COLOR + '40');
            noStroke();
            circle(this.x, this.y, glow);
        }

        if (this.type === 'heart') {
            fill(LINE_COLOR);
            noStroke();
            drawHeart(this.x, this.y, this.size * 1.2);
        } else if (this.type === 'sparkle') {
            stroke(LINE_COLOR);
            strokeWeight(1.5);
            noFill();
            for (let i = 0; i < 4; i++) {
                const a = this.rotation + (i / 4) * Math.PI * 2;
                const len = this.size * (i % 2 === 0 ? 1 : 0.6);
                line(this.x, this.y,
                     this.x + Math.cos(a) * len,
                     this.y + Math.sin(a) * len);
            }
            noStroke();
        } else {
            fill(LINE_COLOR);
            noStroke();
            circle(this.x, this.y, this.size);
        }
    }
}

// ==================== CLICK BURST ====================
class ClickBurst {
    constructor(x, y) {
        this.life = 1;
        this.done = false;
        this.pts = [];
        for (let i = 0; i < 14; i++) {
            const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
            const speed = 2 + Math.random() * 5;
            this.pts.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3 + Math.random() * 5,
                type: Math.random() < 0.65 ? 'heart' : 'dot',
                rot: Math.random() * Math.PI * 2
            });
        }
    }

    update() {
        this.life -= 0.024;
        if (this.life <= 0) { this.done = true; return; }
        for (const p of this.pts) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.92;
            p.vy = p.vy * 0.92 + 0.08;
            p.size *= 0.97;
            p.rot += 0.12;
        }
    }

    display() {
        const a = Math.floor(this.life * 255).toString(16).padStart(2, '0');
        fill(LINE_COLOR + a);
        noStroke();
        for (const p of this.pts) {
            if (p.type === 'heart') {
                drawHeart(p.x, p.y, p.size);
            } else {
                circle(p.x, p.y, p.size);
            }
        }
    }
}

// ==================== DOUBLE CLICK BURST ====================
class DoubleClickBurst {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.done = false;
        this.time = 0;

        // Single expanding heart ring
        this.ring = { scale: 0, maxScale: 130, alpha: 1 };

        // Hearts splash outward like a top-down water puddle hit —
        // no gravity, just radial spread with drag
        this.drops = [];
        for (let i = 0; i < 34; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 10;
            this.drops.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                // squaring skews toward small — most are tiny, a few are big
                size: 2 + Math.pow(Math.random(), 1.5) * 18,
                life: 0.75 + Math.random() * 0.25,
                drag: 0.90 + Math.random() * 0.06, // varied friction → uneven spread
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.25
            });
        }
    }

    update() {
        this.time += 0.016;

        this.ring.scale += 2.2;
        this.ring.alpha = Math.max(0, 1 - this.ring.scale / this.ring.maxScale);

        for (const p of this.drops) {
            p.x += p.vx; p.y += p.vy;
            p.vx *= p.drag; p.vy *= p.drag;
            p.life -= 0.01;
            p.rot += p.rotSpeed;
        }
        if (this.time > 3) this.done = true;
    }

    display() {
        if (this.ring.alpha > 0) {
            const a = Math.floor(this.ring.alpha * 220).toString(16).padStart(2, '0');
            noFill();
            stroke(LINE_COLOR + a);
            strokeWeight(Math.max(0.5, 3.5 * this.ring.alpha));
            drawHeart(this.x, this.y, this.ring.scale);
        }
        noStroke();
        for (const p of this.drops) {
            if (p.life <= 0) continue;
            const a = Math.floor(p.life * 230).toString(16).padStart(2, '0');
            push();
            translate(p.x, p.y);
            rotate(p.rot);
            fill(LINE_COLOR + a);
            drawHeart(0, 0, p.size);
            pop();
        }
    }
}

// ==================== HEART EXPLOSION ====================
class HeartExplosion {
    constructor(x, y, dots) {
        this.x = x; this.y = y;
        this.waves = [];
        this.parts = [];
        this.sparkles = [];
        this.alpha = 255;
        this.done = false;
        this.time = 0;

        for (let wave = 0; wave < 3; wave++) {
            for (let t = 0; t < Math.PI * 2; t += 0.05) {
                const s = 6 + wave * 2;
                const hx = x + s * 16 * Math.pow(Math.sin(t), 3);
                const hy = y - s * (13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t));
                this.waves.push({
                    x, y, tx: hx, ty: hy,
                    size: Math.random() * 3 + 2,
                    life: 1, delay: wave * 0.2, progress: 0
                });
            }
        }

        for (const dot of dots) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 3;
            this.parts.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 6 + 4,
                life: 1,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.4
            });
        }

        for (let i = 0; i < 50; i++) {
            const angle = Math.random() * Math.PI * 2;
            const d = Math.random() * 65 + 10;
            this.sparkles.push({
                x: x + Math.cos(angle) * d,
                y: y + Math.sin(angle) * d,
                size: Math.random() * 4 + 2,
                life: Math.random() * 0.5 + 0.5,
                delay: Math.random() * 0.5
            });
        }
    }

    update() {
        this.time += 0.016;
        this.alpha -= 1.2;
        for (const p of this.waves) {
            if (this.time > p.delay) {
                p.progress = Math.min(1, p.progress + 0.02);
                const e = 1 - Math.pow(1 - p.progress, 3);
                p.x = this.x + (p.tx - this.x) * e;
                p.y = this.y + (p.ty - this.y) * e;
                p.life -= 0.005;
                p.size *= 0.995;
            }
        }
        for (const p of this.parts) {
            p.x += p.vx; p.y += p.vy;
            p.vy += 0.15; p.vx *= 0.98;
            p.life -= 0.008; p.size *= 0.99;
            p.rot += p.rotSpeed;
        }
        for (const s of this.sparkles) {
            if (this.time > s.delay) s.life -= 0.01;
        }
        if (this.alpha <= 0) this.done = true;
    }

    display() {
        for (const p of this.waves) {
            if (p.life > 0 && this.time > p.delay) {
                const a = Math.floor(p.life * this.alpha * 0.8).toString(16).padStart(2, '0');
                fill(LINE_COLOR + a);
                noStroke();
                circle(p.x, p.y, p.size);
            }
        }
        for (const p of this.parts) {
            if (p.life > 0) {
                const a = Math.floor(p.life * this.alpha).toString(16).padStart(2, '0');
                push();
                translate(p.x, p.y);
                rotate(p.rot);
                fill(LINE_COLOR + a);
                noStroke();
                drawHeart(0, 0, p.size * 0.5);
                pop();
            }
        }
        for (const s of this.sparkles) {
            if (s.life > 0 && this.time > s.delay) {
                const a = Math.floor(s.life * this.alpha).toString(16).padStart(2, '0');
                push();
                translate(s.x, s.y);
                rotate(this.time * 2);
                stroke(LINE_COLOR + a);
                strokeWeight(1.5);
                noFill();
                for (let i = 0; i < 4; i++) {
                    rotate(Math.PI / 2);
                    line(0, 0, 0, s.size);
                }
                pop();
            }
        }
    }
}

// ==================== P5 SETUP ====================
function setup() {
    const cnv = createCanvas(windowWidth, windowHeight);
    cnv.id('main-canvas');

    heartPoints = calculateHeartPoints(PARTICLES_NEEDED);
    cursorX = width / 2;
    cursorY = height / 2;

    for (let i = 0; i < 35; i++) particles.push(new Particle());

    const clockEl = document.getElementById('clock');
    clockEl.addEventListener('click', toggleClockMode);
    clockEl.addEventListener('touchend', e => {
        e.preventDefault();
        e.stopPropagation();
        toggleClockMode();
    });

    setupMilestoneButton();
    updateClock();
    setInterval(updateClock, 1000);
}

function draw() {
    // Subtle heartbeat background — two pulses per second
    const t = millis() / 1000;
    const pulse = Math.max(0, Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI * 2));
    const bg = lerpColor(color(255, 255, 255), color(255, 238, 246), pulse * 0.35);
    background(bg);

    if (isMouseActive) {
        cursorX = mouseX;
        cursorY = mouseY;
    }

    // Spawn particles
    if (millis() - lastSpawnTime > SPAWN_INTERVAL && particles.length < MAX_PARTICLES) {
        for (let i = 0; i < SPAWN_AMOUNT; i++) {
            const edge = Math.floor(Math.random() * 4);
            let x, y;
            if      (edge === 0) { x = Math.random() * width; y = -20; }
            else if (edge === 1) { x = width + 20;  y = Math.random() * height; }
            else if (edge === 2) { x = Math.random() * width; y = height + 20; }
            else                 { x = -20;          y = Math.random() * height; }
            particles.push(new Particle(x, y));
        }
        lastSpawnTime = millis();
    }

    if (millis() - lastMouseMove > 100) isMouseActive = false;

    for (const p of particles)          p.update();
    for (const p of collectedParticles) p.update();

    if (isMouseActive && !mouseIsPressed && collectedParticles.length < PARTICLES_NEEDED) {
        checkCollection();
    }

    // Draw connections between free particles
    noFill();
    strokeWeight(1.5);
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const d = dist(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
            if (d < 100) {
                const a = Math.floor(map(d, 0, 100, 60, 0)).toString(16).padStart(2, '0');
                stroke(LINE_COLOR + a);
                line(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
            }
        }
    }

    for (const p of particles) p.display();

    // Collection UI
    if (isMouseActive && !mouseIsPressed && collectedParticles.length < PARTICLES_NEEDED) {
        // Outer ring
        noFill();
        stroke(LINE_COLOR + '55');
        strokeWeight(2);
        circle(cursorX, cursorY, COLLECTION_RADIUS * 2);

        // Progress arc
        if (collectedParticles.length > 0) {
            stroke(LINE_COLOR + 'cc');
            strokeWeight(3);
            const sweep = (collectedParticles.length / PARTICLES_NEEDED) * Math.PI * 2;
            arc(cursorX, cursorY, COLLECTION_RADIUS * 2 + 12, COLLECTION_RADIUS * 2 + 12,
                -Math.PI / 2, -Math.PI / 2 + sweep);

            fill(LINE_COLOR + 'bb');
            noStroke();
            textSize(11);
            textAlign(CENTER);
            textFont('Georgia, serif');
            text(`${collectedParticles.length}/${PARTICLES_NEEDED} ♥`, cursorX, cursorY + COLLECTION_RADIUS + 20);
        }

        // Inner pulse ring
        const pulse2 = 0.5 + sin(millis() / 200) * 0.1;
        stroke(LINE_COLOR + '28');
        strokeWeight(1);
        circle(cursorX, cursorY, COLLECTION_RADIUS * 2 * pulse2);
    }

    for (const p of collectedParticles) p.display();

    // Connections between collected (heart outline)
    if (collectedParticles.length > 1) {
        stroke(LINE_COLOR + '80');
        strokeWeight(2);
        noFill();
        for (let i = 0; i < collectedParticles.length; i++) {
            const p1 = collectedParticles[i];
            const p2 = collectedParticles[(i + 1) % collectedParticles.length];
            if (dist(p1.x, p1.y, p2.x, p2.y) < 50) {
                line(p1.x, p1.y, p2.x, p2.y);
            }
        }
    }

    // Bursts (click sparks + heart explosions)
    for (let i = bursts.length - 1; i >= 0; i--) {
        bursts[i].update();
        bursts[i].display();
        if (bursts[i].done) bursts.splice(i, 1);
    }

    // Vortex visual hint when holding mouse
    if (mouseIsPressed && isMouseActive) {
        noFill();
        strokeWeight(1);
        const spin = millis() / 500;
        for (let r = 70; r <= 270; r += 100) {
            stroke(LINE_COLOR + '18');
            arc(cursorX, cursorY, r*2, r*2,
                spin % (Math.PI*2),
                spin % (Math.PI*2) + Math.PI * 1.6);
        }
    }
}

function checkCollection() {
    for (let i = particles.length - 1; i >= 0; i--) {
        if (dist(particles[i].x, particles[i].y, cursorX, cursorY) < 25) {
            particles[i].collected = true;
            particles[i].heartIndex = collectedParticles.length;
            collectedParticles.push(particles.splice(i, 1)[0]);
            if (collectedParticles.length >= PARTICLES_NEEDED) {
                createHeartExplosion();
            }
        }
    }
}

function createHeartExplosion() {
    bursts.push(new HeartExplosion(cursorX, cursorY, [...collectedParticles]));
    collectedParticles = [];
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(
            cursorX + Math.random() * 200 - 100,
            cursorY + Math.random() * 200 - 100
        ));
    }
}

// Click anywhere = heart burst (skip if it was a drag)
function mouseClicked(event) {
    if (wasDragged) return false;
    if (event?.target?.closest('#clock, #milestone-btn, #milestone-popup')) return false;

    bursts.push(new ClickBurst(mouseX, mouseY));
    return false;
}

function doubleClicked(event) {
    if (event?.target?.closest('#clock, #milestone-btn, #milestone-popup')) return false;
    bursts.push(new DoubleClickBurst(mouseX, mouseY));
    return false;
}

function mousePressed()  { wasDragged = false; }
function mouseDragged()  { wasDragged = true; isMouseActive = true; lastMouseMove = millis(); return false; }
function mouseMoved()    { isMouseActive = true; lastMouseMove = millis(); return false; }

function touchMoved() {
    if (touches.length > 0) {
        const t = touches[0];
        const rect = document.getElementById('clock').getBoundingClientRect();
        if (t.x >= rect.left && t.x <= rect.right && t.y >= rect.top && t.y <= rect.bottom) return false;
        isMouseActive = true; lastMouseMove = millis();
        cursorX = t.x; cursorY = t.y;
    }
    return false;
}

function touchStarted() {
    if (touches.length > 0) {
        const t = touches[0];
        const rect = document.getElementById('clock').getBoundingClientRect();
        if (t.x >= rect.left && t.x <= rect.right && t.y >= rect.top && t.y <= rect.bottom) return false;
        isMouseActive = true; lastMouseMove = millis();
        cursorX = t.x; cursorY = t.y;

        // Double-tap detection: two taps within 300ms and 40px
        const now = Date.now();
        const dx = t.x - lastTapX;
        const dy = t.y - lastTapY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (now - lastTapTime < 300 && dist < 40) {
            bursts.push(new DoubleClickBurst(t.x, t.y));
            lastTapTime = 0; // reset so triple-tap doesn't re-trigger
        } else {
            lastTapTime = now;
            lastTapX = t.x;
            lastTapY = t.y;
        }
    }
    return false;
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }

// ==================== CLOCK ====================
function toggleClockMode() {
    const el = document.getElementById('clock-number');
    el.classList.remove('liquid');
    void el.offsetWidth;
    el.classList.add('liquid');
    // Swap the number at peak blur (40% of 750ms) so the change is hidden
    setTimeout(() => {
        clockMode = (clockMode + 1) % 4;
        updateClock();
    }, 300);
    el.addEventListener('animationend', () => el.classList.remove('liquid'), { once: true });
}

function getDateInTimezone(date, timezone) {
    return date.toLocaleDateString('en-CA', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
    });
}

function calculateDaysDifference(startDate, currentDate, timezone) {
    const start   = new Date(getDateInTimezone(startDate, timezone)   + 'T00:00:00');
    const current = new Date(getDateInTimezone(currentDate, timezone) + 'T00:00:00');
    return Math.floor((current - start) / (1000 * 60 * 60 * 24));
}

function updateClock() {
    const now      = new Date();
    const diff     = now - START_DATE;
    const timezone = 'Asia/Ho_Chi_Minh';

    const days         = calculateDaysDifference(START_DATE, now, timezone) + 1;
    const totalSeconds = Math.floor(diff / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours   = Math.floor(totalMinutes / 60);

    const numEl   = document.getElementById('clock-number');
    const labelEl = document.getElementById('clock-label');

    switch (clockMode) {
        case 0: numEl.textContent = days;         labelEl.textContent = days === 1         ? 'day'    : 'days';    break;
        case 1: numEl.textContent = totalHours;   labelEl.textContent = totalHours === 1   ? 'hour'   : 'hours';   break;
        case 2: numEl.textContent = totalMinutes; labelEl.textContent = totalMinutes === 1 ? 'minute' : 'minutes'; break;
        case 3: numEl.textContent = totalSeconds; labelEl.textContent = totalSeconds === 1 ? 'second' : 'seconds'; break;
    }
}

// ==================== MILESTONES ====================
function setupMilestoneButton() {
    const btn   = document.getElementById('milestone-btn');
    const popup = document.getElementById('milestone-popup');

    function togglePopup(e) {
        e.preventDefault();
        e.stopPropagation();
        popup.classList.toggle('show');
        if (popup.classList.contains('show')) updateMilestones();
    }

    btn.addEventListener('click',    togglePopup);
    btn.addEventListener('touchend', togglePopup);

    popup.addEventListener('click',      e => e.stopPropagation());
    popup.addEventListener('touchstart', e => e.stopPropagation());
    popup.addEventListener('touchmove',  e => e.stopPropagation());
    popup.addEventListener('touchend',   e => e.stopPropagation());

    document.addEventListener('click',    e => { if (!popup.contains(e.target) && e.target !== btn) popup.classList.remove('show'); });
    document.addEventListener('touchend', e => { if (!popup.contains(e.target) && e.target !== btn) popup.classList.remove('show'); });
}

function updateMilestones() {
    const now      = new Date();
    const timezone = 'Asia/Ho_Chi_Minh';
    const currentDays = calculateDaysDifference(START_DATE, now, timezone) + 1;

    const startDateMidnight = new Date(getDateInTimezone(START_DATE, timezone) + 'T00:00:00');
    const container = document.getElementById('milestone-list');
    container.innerHTML = '';

    MILESTONES.forEach(milestone => {
        const milestoneDate = new Date(startDateMidnight);
        if ([365, 730, 1095, 1460, 1825].includes(milestone.days)) {
            milestoneDate.setFullYear(milestoneDate.getFullYear() + milestone.days / 365);
        } else {
            milestoneDate.setDate(milestoneDate.getDate() + milestone.days - 1);
        }

        const day   = String(milestoneDate.getDate()).padStart(2, '0');
        const month = String(milestoneDate.getMonth() + 1).padStart(2, '0');
        const year  = milestoneDate.getFullYear();
        const dateStr = `${day}/${month}/${year}`;

        const item = document.createElement('div');
        item.className = 'milestone-item' + (currentDays >= milestone.days ? ' reached' : '');
        const daysLeft = milestone.days - currentDays;
        item.innerHTML = `
            <div class="milestone-name">${milestone.name}</div>
            <div class="milestone-date">${dateStr}</div>
            <div class="milestone-countdown">${currentDays >= milestone.days ? 'Reached!' : `${daysLeft} days to go`}</div>
        `;
        container.appendChild(item);
    });
}

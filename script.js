// ============================================
// THEME TOGGLE
// ============================================
const themeToggle = document.getElementById('theme-toggle');
const htmlElement = document.documentElement;

let savedTheme;
try { savedTheme = localStorage.getItem('theme'); } catch (e) { savedTheme = null; }
const currentTheme = savedTheme ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
htmlElement.setAttribute('data-theme', currentTheme);

/* Switch the theme. `origin` is the viewport point the new theme spreads out from — a light being switched on. */
function setTheme(next, origin) {
    if (htmlElement.getAttribute('data-theme') === next) return;
    const apply = () => {
        htmlElement.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (e) { /* unavailable */ }
    };

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || still) {
        document.body.classList.add('theme-transitioning');
        apply();
        setTimeout(() => document.body.classList.remove('theme-transitioning'), 320);
        return;
    }

    const { x, y } = origin;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    htmlElement.classList.add('theme-reveal');
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
        htmlElement.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration: 380, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }   // short: the page takes no clicks while it runs
        );
    }).catch(() => {});
    vt.finished.finally(() => htmlElement.classList.remove('theme-reveal'));
}
const centerOf = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
const otherTheme = () => (htmlElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');

themeToggle.addEventListener('click', () => setTheme(otherTheme(), centerOf(themeToggle)));

// ============================================
// HERO LAMP — hangs from the nav bar and is the hero's light switch.
// Click it, or pull the chain: light on = dark theme (the lamp lights the room at night), off = light theme.
// Drag the shade: it swings as a damped pendulum (fixed 120 Hz steps, so it feels the same at any frame rate);
// the loop stops once it settles. Moths circle the bulb while it is on and scatter when it swings hard.
// Flip it too many times too fast and the bulb blows — `php artisan lamp:replace` in the terminal fits a new one.
// `lamp --shoot` loads a slingshot under the lamp that hops to a random spot after every shot: pebbles knock the shade,
// pop the bulb, or hit the nav's theme switch.
// ============================================
const heroLamp = (function initHeroLamp() {
    const none = { nudge() {}, setOn() {}, replace() { return false; }, shoot() { return false; }, lightAt() { return 0; },
                   status() { return { on: false, broken: false, shots: 0, bulbs: 0, shoot: false }; } };
    const root = document.getElementById('hero-lamp');
    const arm  = document.getElementById('lamp-arm');
    const bulb = document.getElementById('lamp-bulb');
    const hero = document.querySelector('.hero');
    if (!root || !arm || !bulb || !hero) return none;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
    const cord   = arm.querySelector('.lamp-cord');
    const chain  = arm.querySelector('.lamp-chain');
    const moths  = arm.querySelector('.lamp-moths');
    const shadow = root.querySelector('.lamp-shadow');
    const hint   = root.querySelector('.lamp-hint');
    const hintText = hint ? hint.textContent : '';
    const replaceChip = document.getElementById('lamp-replace-chip');
    const playBtn = document.getElementById('lamp-play');
    let played = false, playTimer = 0, pill = '';          // what the pill under the lamp offers: 'play' or 'fix'
    const PILL = { play: '\u{1F3AF} lamp --shoot \u00b7 play', fix: '\u{1F527} lamp:replace \u00b7 fix the bulb' };

    const isOn = () => htmlElement.getAttribute('data-theme') !== 'light';
    let broken = false, shoot = false;
    const stats = { shots: 0, bulbs: 0 };
    const flips = [];                 // recent switch flips {t, w}: too much heat in a few seconds and the bulb blows

    function sync() {
        const on = isOn();
        arm.setAttribute('aria-checked', String(on));
        arm.setAttribute('aria-label', broken ? 'Lamp: the bulb is blown. Run php artisan lamp:replace in the terminal'
            : on ? 'Lamp: switch the light off (light theme)' : 'Lamp: switch the light on (dark theme)');
        if (hint) hint.textContent = broken ? 'bulb blown · php artisan lamp:replace' : hintText;
        if (replaceChip) replaceChip.hidden = !broken;
        if (broken) showPill('fix');                                         // the fix is one tap away, right under the lamp
        else if (pill === 'fix') hidePill();
    }
    function showPill(kind) {
        if (!playBtn) return;
        clearTimeout(playTimer);
        pill = kind;
        playBtn.textContent = PILL[kind];
        playBtn.classList.toggle('is-fix', kind === 'fix');
        playBtn.hidden = false;
    }
    function hidePill() { if (!playBtn) return; clearTimeout(playTimer); playBtn.hidden = true; pill = ''; }
    sync();
    const flicker = () => { if (reduced.matches) return; arm.classList.remove('just-on'); void arm.offsetWidth; arm.classList.add('just-on'); };
    new MutationObserver(() => {
        const wasOn = arm.getAttribute('aria-checked') === 'true';
        sync();
        if (isOn() === wasOn) return;
        const now = performance.now();
        while (flips.length && now - flips[0].t > 6000) flips.shift();
        flips.push({ t: now, w: isOn() ? 1 : 0.4 });
        if (!played && !broken) offerPlay();                             // "you can play with this" — until they have
        if (broken || !isOn()) return;
        flicker();
        const heat = flips.reduce((h, f) => h + f.w, 0);
        if (heat >= 3.4) { arm.classList.add('overheat'); setTimeout(pop, 300); }   // on-off-on-off-on within six seconds
    }).observe(htmlElement, { attributes: true, attributeFilter: ['data-theme'] });

    function offerPlay() {
        showPill('play');
        playTimer = setTimeout(hidePill, 6000);
    }
    if (playBtn) playBtn.addEventListener('click', () => {
        const kind = pill;
        hidePill();
        if (kind === 'fix') { if (typeof runTerminal === 'function') runTerminal('php artisan lamp:replace'); else replace(); return; }
        played = true;
        if (typeof runTerminal === 'function') runTerminal('lamp --shoot'); else setShoot(true);
    });

    // --- pendulum ---
    const G = 2600, STEP = 1 / 120, DAMP = 0.6;
    let theta = 0, omega = 0, L = 260;
    let grab = null, pull = null, raf = 0, last = 0, acc = 0, visible = true, scatterT = 0;
    const pointer = { x: 0, y: 0 };
    let downX = 0, downY = 0, dragged = false;
    const geo = { px: 0, py: 0, k: 1, cord: 0 };          // pivot in hero coordinates, px per svg unit, cord length

    function measure() {
        geo.px = root.offsetLeft; geo.py = root.offsetTop;
        geo.k = arm.offsetWidth / 160; geo.cord = cord.offsetHeight;
        L = geo.cord + 76 * geo.k;                          // pivot → bulb centre
        fxResize();
    }
    const pivotClient = () => { const r = root.getBoundingClientRect(); return { x: r.left, y: r.top }; };
    // hero coordinates ↔ the lamp's own (x across the shade, y down the cord; the arm is rotated by -theta)
    const toLocal = (x, y) => { const dx = x - geo.px, dy = y - geo.py, c = Math.cos(theta), s = Math.sin(theta); return { x: dx * c - dy * s, y: dx * s + dy * c }; };
    const toWorld = (lx, ly) => { const c = Math.cos(theta), s = Math.sin(theta); return { x: geo.px + lx * c + ly * s, y: geo.py - lx * s + ly * c }; };
    const dirToWorld = (nx, ny) => { const c = Math.cos(theta), s = Math.sin(theta); return { x: nx * c + ny * s, y: -nx * s + ny * c }; };

    function render() {
        arm.style.transform = `rotate(${(-theta).toFixed(4)}rad)`;
        if (shadow) shadow.style.transform = `translate(${(theta * L * 0.55).toFixed(1)}px, ${(Math.abs(theta) * 14).toFixed(1)}px)`;
    }
    function step(dt) {
        let a = -(G / L) * Math.sin(theta) - omega * DAMP;
        if (grab) {                                          // spring towards the pointer while held
            const p = pivotClient();
            const tgt = clampN(Math.atan2(pointer.x - p.x, pointer.y - p.y) - grab.offset, -1.1, 1.1);
            a += (tgt - theta) * 170 - omega * 16;
        }
        omega += a * dt;
        theta = clampN(theta + omega * dt, -1.3, 1.3);
    }
    const moving = () => Math.abs(omega) > 0.02 || Math.abs(theta) > 0.004;
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now; acc += dt;
        while (acc >= STEP) { step(STEP); acc -= STEP; }
        render();
        if (moths && Math.abs(omega) > 0.9 && now > scatterT) {   // a hard swing scatters the moths
            scatterT = now + 3400;
            moths.classList.add('scatter');
            setTimeout(() => moths.classList.remove('scatter'), 3100);
        }
        if (grab || moving()) { raf = requestAnimationFrame(frame); return; }
        raf = 0; theta = 0; omega = 0; render();            // settled: stop the loop
    }
    function wake() {
        if (raf || reduced.matches || !visible) return;
        last = performance.now(); acc = 0;
        raf = requestAnimationFrame(frame);
    }
    const nudge = v => { omega += v; wake(); };
    const kick = (x, y, fx, fy) => nudge(((y - geo.py) * fx - (x - geo.px) * fy) / (L * L));   // an impulse at a point

    function flip() {
        if (broken) { nudge(0.25); return; }                 // nothing happens; the hint says what to do
        setTheme(otherTheme(), centerOf(bulb));
        if (!reduced.matches) nudge(0.45);                   // the tug on the switch
    }
    arm.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const onChain = chain && e.target.closest('.lamp-chain');
        if (reduced.matches && !onChain) return;
        pointer.x = downX = e.clientX; pointer.y = downY = e.clientY;
        dragged = false;
        arm.setPointerCapture(e.pointerId);
        if (onChain) { pull = { y0: e.clientY, ext: 0 }; chain.classList.add('is-pulling'); return; }
        const p = pivotClient();
        grab = { offset: Math.atan2(e.clientX - p.x, e.clientY - p.y) - theta };
        arm.classList.add('is-grabbed');
        wake();
    });
    arm.addEventListener('pointermove', e => {
        pointer.x = e.clientX; pointer.y = e.clientY;
        if (pull) {
            pull.ext = clampN((e.clientY - pull.y0) / geo.k, 0, 26);
            chain.style.transform = `translateY(${pull.ext.toFixed(1)}px)`;
            if (pull.ext > 4) dragged = true;
            return;
        }
        if (grab && !dragged && Math.hypot(e.clientX - downX, e.clientY - downY) > 6) dragged = true;
    });
    function release() {
        if (pull) {
            const tug = pull.ext >= 12;
            chain.classList.remove('is-pulling');
            chain.style.transform = '';
            pull = null;
            if (tug) { dragged = true; flip(); }             // a real tug switches; the click that follows is swallowed
        }
        grab = null;
        arm.classList.remove('is-grabbed');
    }
    arm.addEventListener('pointerup', release);
    arm.addEventListener('pointercancel', release);
    arm.addEventListener('click', () => {
        if (dragged) { dragged = false; return; }            // that was a swing (or a tug), not a click
        flip();
    });

    // idle off screen / in a background tab; pick up again when back — with a sway, as if a door just opened
    let seen = false;
    new IntersectionObserver(([entry]) => {
        const was = visible;
        visible = entry.isIntersecting;
        if (!visible) { if (raf) { cancelAnimationFrame(raf); raf = 0; } if (fxRaf) { cancelAnimationFrame(fxRaf); fxRaf = 0; } return; }
        if (seen && !was && !reduced.matches) nudge(0.5);
        seen = true;
        if (moving()) wake();
        fxWake();
    }).observe(root);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = 0; } if (fxRaf) { cancelAnimationFrame(fxRaf); fxRaf = 0; } }
        else { wake(); fxWake(); }
    });
    window.addEventListener('resize', measure, { passive: true });
    if (window.ResizeObserver) { let queued = 0; new ResizeObserver(() => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; measure(); }); }).observe(hero); }

    // --- the bulb blows ---
    function pop(vx = 0, vy = 0) {
        if (broken) return;
        broken = true;
        stats.bulbs++;
        flips.length = 0;
        arm.classList.remove('overheat', 'just-on');
        root.classList.add('is-broken');
        sync();
        if (reduced.matches) return;
        const b = toWorld(0, geo.cord + 76 * geo.k);
        for (let i = 0; i < 34; i++) {
            const ang = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 460, n = 3 + Math.floor(Math.random() * 2), r = 2 + Math.random() * 5;
            const poly = [];
            for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + Math.random() * 0.8; poly.push([Math.cos(a) * r * (0.5 + Math.random()), Math.sin(a) * r * (0.5 + Math.random())]); }
            shards.push({ x: b.x + Math.cos(ang) * 8, y: b.y + Math.sin(ang) * 8, vx: Math.cos(ang) * sp + vx * 0.35, vy: Math.sin(ang) * sp * 0.7 + 80 + vy * 0.35,
                          a: Math.random() * 6.28, va: (Math.random() - 0.5) * 24, poly, life: 7 });
        }
        for (let i = 0; i < 36; i++) {
            const ang = Math.random() * Math.PI * 2, sp = 200 + Math.random() * 650;
            sparks.push({ x: b.x, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0.3 + Math.random() * 0.6, max: 0.9 });
        }
        flash = 1;
        fxWake();
    }
    function replace() {
        if (!broken) return false;
        broken = false;
        root.classList.remove('is-broken');
        sync();
        if (isOn()) flicker();
        return true;
    }

    // --- effects canvas: glass and sparks when the bulb blows, the slingshot and its pebbles ---
    const fx = document.createElement('canvas');
    fx.className = 'lamp-fx';
    fx.setAttribute('aria-hidden', 'true');
    hero.appendChild(fx);
    const ctx = fx.getContext('2d');
    let FW = 0, FH = 0, DPR = 1, flash = 0;
    let shards = [], sparks = [], pebbles = [];
    const sling = { x: 0, y: 0, u: null, s: 1, rest: { x: 0, y: 0 }, pouch: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, loaded: true, reloadT: 0 };
    let aim = null, aimPt = { x: 0, y: 0 }, aimAt = 0, fxRaf = 0, fxLast = 0, fxAcc = 0, switchBox = null, stageUntil = 0;
    let floor = 0;                                     // the playing field's floor: the bottom of the hero, or of the screen if that comes first
    const PEBBLE_R = 6, PG = 1500, LAUNCH = 16, MAX_PULL = 140, SG = 2600;   // a modest pull straight down reaches the bulb, even on a phone

    function fxResize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        FW = hero.clientWidth; FH = hero.clientHeight;
        fx.width = Math.round(FW * DPR); fx.height = Math.round(FH * DPR);
        sling.s = FW <= 768 ? 0.7 : 1;                                    // smaller on phones
        updateFloor();
        placeSling();
        if (fxBusy()) fxRender();
    }
    // the hero can be taller than the screen (short phones, a tablet with the terminal open): the slingshot then
    // stands on the visible bottom, never below the fold
    function updateFloor() {
        const top = hero.getBoundingClientRect().top;
        const f = clampN(Math.round(window.innerHeight - top), 240, FH);
        if (f === floor) return false;
        floor = f;
        return true;
    }
    // the slingshot stands on the hero's floor: first right under the lamp (a straight pull down hits the bulb),
    // then somewhere new after every shot — that is the game
    const slingX = u => { const min = FW > 768 ? 90 : 60; return min + u * (FW - min - 60); };   // clear of the side icons
    function placeSling(u = sling.u) {
        sling.u = u;
        sling.x = u === null ? clampN(geo.px, 50, FW - 50) : slingX(u);
        sling.y = floor;
        sling.rest = { x: sling.x, y: floor - 118 * sling.s };
        if (aim === null) { sling.pouch = { ...sling.rest }; sling.vel = { x: 0, y: 0 }; }
    }
    function moveSling() {
        let u = Math.random();
        for (let i = 0; i < 20 && Math.abs(slingX(u) - sling.x) < FW * 0.25; i++) u = Math.random();   // well away from here
        placeSling(u);
    }
    const heroXY = e => { const r = hero.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    // the canvas takes no pointer events (the hero's buttons stay clickable); the pouch is picked up here instead
    hero.addEventListener('pointerdown', e => {
        if (!shoot || !sling.loaded || aim !== null) return;
        const p = heroXY(e);
        if (Math.hypot(p.x - sling.pouch.x, p.y - sling.pouch.y) > (e.pointerType === 'mouse' ? 30 : 44)) return;
        e.preventDefault(); e.stopPropagation();
        aim = e.pointerId; aimPt = p; aimAt = performance.now();
        try { hero.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is gone already; the release below still runs */ }
        hero.classList.add('is-aiming');                                     // the copy steps aside: it is a game now
        fxWake();
    }, true);
    hero.addEventListener('pointermove', e => { if (aim === e.pointerId) { aimPt = heroXY(e); aimAt = performance.now(); } });
    // release: wherever the pointer ends up, the shot goes — a held pebble must never get stuck
    const loose = e => { if (aim === null || aim !== e.pointerId) return; aim = null; shootPebble(); };
    hero.addEventListener('pointerup', loose);
    hero.addEventListener('pointercancel', loose);
    hero.addEventListener('lostpointercapture', loose);
    document.addEventListener('pointerup', loose, true);
    document.addEventListener('pointercancel', loose, true);
    window.addEventListener('blur', () => { if (aim !== null) { aim = null; sling.pouch = { ...sling.rest }; } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && shoot) setShoot(false); });

    function shootPebble() {
        const launch = LAUNCH / sling.s;                                     // the small phone slingshot pulls shorter, so it hits harder
        const vx = (sling.rest.x - sling.pouch.x) * launch, vy = (sling.rest.y - sling.pouch.y) * launch;
        if (Math.hypot(vx, vy) / launch < 18) return;
        pebbles.push({ x: sling.pouch.x, y: sling.pouch.y, vx, vy, a: 0, hitT: 0, rest: 0, life: 1 });
        sling.loaded = false; sling.reloadT = 0.35;
        sling.vel = { x: vx * 0.4, y: vy * 0.4 };
        stats.shots++;
        stageUntil = performance.now() + 3000;                              // the copy stays back until the pebble lands
    }
    function collide(p) {
        if (p.hitT > 0) return;
        if (switchBox) {                                                     // the nav's theme button flips the light
            const cx = clampN(p.x, switchBox.l, switchBox.r), cy = clampN(p.y, switchBox.t, switchBox.b);
            let nx = p.x - cx, ny = p.y - cy;
            const d = Math.hypot(nx, ny);
            if (d <= PEBBLE_R) {
                if (d === 0) { const sp = Math.hypot(p.vx, p.vy) || 1; nx = -p.vx / sp; ny = -p.vy / sp; } else { nx /= d; ny /= d; }
                const vn = p.vx * nx + p.vy * ny;
                if (vn < 0) {
                    p.vx -= 1.4 * vn * nx; p.vy -= 1.4 * vn * ny;
                    p.x = cx + nx * (PEBBLE_R + 1); p.y = cy + ny * (PEBBLE_R + 1);
                    p.hitT = 0.1;
                    themeToggle.click();
                    return;
                }
            }
        }
        const l = toLocal(p.x, p.y);
        const r = PEBBLE_R / geo.k, lx = l.x / geo.k, ly = (l.y - geo.cord) / geo.k;   // in the fixture's svg units
        if (!broken && Math.hypot(lx, ly - 76) < 24 + r) {                            // the bulb (generous: its glow counts)
            pop(p.vx, p.vy);
            kick(p.x, p.y, p.vx * 0.08, p.vy * 0.08);
            p.vx *= 0.75; p.vy *= 0.75; p.hitT = 0.08;
            return;
        }
        if (ly < 13 - r || ly > 64 + r) return;                                        // the shade
        const hw = 13 + 49 * Math.pow(clampN((ly - 15) / 49, 0, 1), 0.7);
        if (Math.abs(lx) > hw + r) return;
        let nx = lx, ny = ly - 30;
        const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const n = dirToWorld(nx, ny);
        const vn = p.vx * n.x + p.vy * n.y;
        if (vn >= 0) return;
        const e = 0.45;
        p.vx -= (1 + e) * vn * n.x; p.vy -= (1 + e) * vn * n.y;
        p.x += n.x * 6; p.y += n.y * 6;
        const J = -(1 + e) * vn * 0.22;
        kick(p.x, p.y, -n.x * J, -n.y * J);
        p.hitT = 0.06;
    }
    function fxStep(dt) {
        if (aim !== null) {                                                  // pouch follows the pointer while held
            let dx = aimPt.x - sling.rest.x, dy = Math.min(aimPt.y, floor - 12) - sling.rest.y;   // never below the floor
            const d = Math.hypot(dx, dy);
            if (d > MAX_PULL) { dx *= MAX_PULL / d; dy *= MAX_PULL / d; }
            sling.pouch = { x: sling.rest.x + dx, y: sling.rest.y + dy };
            sling.vel = { x: 0, y: 0 };
        } else {                                                             // and springs back after
            sling.vel.x += ((sling.rest.x - sling.pouch.x) * 900 - sling.vel.x * 12) * dt;
            sling.vel.y += ((sling.rest.y - sling.pouch.y) * 900 - sling.vel.y * 12) * dt;
            sling.pouch.x += sling.vel.x * dt; sling.pouch.y += sling.vel.y * dt;
        }
        for (const p of pebbles) {
            p.hitT = Math.max(0, p.hitT - dt);
            if (p.rest > 0) continue;
            p.vy += PG * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.vx * dt * 0.05;
            collide(p);
            if (p.y > floor - PEBBLE_R) {
                p.y = floor - PEBBLE_R; p.vy *= -0.35; p.vx *= 0.75;
                if (Math.abs(p.vy) < 40 && Math.abs(p.vx) < 20) p.rest = 0.001;
            }
            if (p.x < PEBBLE_R || p.x > FW - PEBBLE_R) { p.x = clampN(p.x, PEBBLE_R, FW - PEBBLE_R); p.vx *= -0.5; }
        }
        for (const s of shards) {
            s.vy += SG * 0.75 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.a += s.va * dt;
            if (s.y > floor - 3) { s.y = floor - 3; s.vy *= -0.28; s.vx *= 0.6; s.va *= 0.5; if (Math.abs(s.vy) < 30) s.vy = 0; }
            if (s.x < 0 || s.x > FW) { s.vx *= -0.5; s.x = clampN(s.x, 0, FW); }
        }
        for (const k of sparks) { k.vy += SG * 0.4 * dt; k.vx *= 0.985; k.x += k.vx * dt; k.y += k.vy * dt; }
    }
    function fxTick(dt) {                                                    // the slow bookkeeping, once a frame
        if (!sling.loaded) { sling.reloadT -= dt; if (sling.reloadT <= 0) { sling.loaded = true; moveSling(); } }
        for (const p of pebbles) if (p.rest > 0) { p.rest += dt; if (p.rest > 4) p.life -= dt * 1.5; }
        pebbles = pebbles.filter(p => p.life > 0 && p.y < FH + 200).slice(-10);
        for (const s of shards) s.life -= dt;
        shards = shards.filter(s => s.life > 0);
        for (const k of sparks) k.life -= dt;
        sparks = sparks.filter(k => k.life > 0);
        flash = Math.max(0, flash - dt * 3.5);
        const inFlight = pebbles.some(p => p.rest === 0);
        if (aim !== null && performance.now() - aimAt > 12000) { aim = null; sling.pouch = { ...sling.rest }; }   // a pointer we never heard from again
        if (aim === null && (!inFlight || performance.now() > stageUntil)) hero.classList.remove('is-aiming');
    }

    function drawPebble(x, y, a, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(a);
        const g = ctx.createRadialGradient(-2, -2, 0, 0, 0, PEBBLE_R + 1);
        g.addColorStop(0, '#b3ada3'); g.addColorStop(0.6, '#6e6961'); g.addColorStop(1, '#37332e');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(0, 0, PEBBLE_R + 0.8, PEBBLE_R - 0.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    function drawSlingshot() {
        const { x, y, s: S } = sling, p = sling.pouch;
        const tipL = { x: x - 26 * S, y: y - 128 * S }, tipR = { x: x + 26 * S, y: y - 128 * S };
        const stretch = clampN(Math.hypot(p.x - sling.rest.x, p.y - sling.rest.y) / MAX_PULL, 0, 1);
        const bandW = (4 - stretch * 2) * S;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#7a2e22'; ctx.lineWidth = bandW;
        ctx.beginPath(); ctx.moveTo(tipL.x, tipL.y); ctx.lineTo(p.x - 6 * S, p.y); ctx.stroke();
        const wood = ctx.createLinearGradient(x - 28 * S, 0, x + 28 * S, 0);
        wood.addColorStop(0, '#3b2616'); wood.addColorStop(0.45, '#8a5a34'); wood.addColorStop(1, '#3a2515');
        ctx.strokeStyle = wood; ctx.lineWidth = 10 * S;
        ctx.beginPath();
        ctx.moveTo(x, y + 4); ctx.lineTo(x, y - 66 * S);
        ctx.quadraticCurveTo(x - 4 * S, y - 88 * S, tipL.x, tipL.y);
        ctx.moveTo(x, y - 66 * S);
        ctx.quadraticCurveTo(x + 4 * S, y - 88 * S, tipR.x, tipR.y);
        ctx.stroke();
        ctx.fillStyle = '#2a1a0f';
        for (const t of [tipL, tipR]) { ctx.beginPath(); ctx.ellipse(t.x, t.y, 6 * S, 3 * S, 0, 0, Math.PI * 2); ctx.fill(); }
        if (aim !== null) {                                                  // where it will go
            const launch = LAUNCH / S;
            const vx = (sling.rest.x - p.x) * launch, vy = (sling.rest.y - p.y) * launch;
            ctx.fillStyle = '#FF2D20'; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2;
            for (let i = 1; i <= 12; i++) {
                const t = i * 0.04;
                ctx.globalAlpha = 0.95 - 0.6 * (i / 12);
                ctx.beginPath(); ctx.arc(p.x + vx * t, p.y + vy * t + 0.5 * PG * t * t, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
        ctx.fillStyle = '#4a2c1c';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 11 * S, 7 * S, Math.atan2(p.y - sling.rest.y, p.x - sling.rest.x), 0, Math.PI * 2); ctx.fill();
        if (sling.loaded) drawPebble(p.x, p.y, 0, 1);
        ctx.strokeStyle = '#8e3627'; ctx.lineWidth = bandW;
        ctx.beginPath(); ctx.moveTo(tipR.x, tipR.y); ctx.lineTo(p.x + 6 * S, p.y); ctx.stroke();
        // the score
        ctx.font = `${Math.round(11 * S)}px "Fira Code", monospace`;
        ctx.textAlign = x > FW * 0.75 ? 'right' : 'left';                   // beside the handle, on the floor, away from the hero's buttons
        ctx.fillStyle = isOn() ? 'rgba(236,230,218,0.6)' : 'rgba(63,63,70,0.75)';
        ctx.fillText(`${stats.shots} shot${stats.shots === 1 ? '' : 's'} · ${stats.bulbs} bulb${stats.bulbs === 1 ? '' : 's'}`, x + (x > FW * 0.75 ? -14 : 14) * S, y - 12);
        ctx.textAlign = 'start';
    }
    function drawParticles() {
        for (const p of pebbles) drawPebble(p.x, p.y, p.a, clampN(p.life, 0, 1));
        const glassFill = isOn() ? 'rgba(210,225,240,0.16)' : 'rgba(40,45,55,0.12)';
        const glassLine = isOn() ? 'rgba(230,238,248,0.55)' : 'rgba(40,45,55,0.6)';
        for (const s of shards) {
            ctx.save();
            ctx.globalAlpha = clampN(s.life, 0, 1);
            ctx.translate(s.x, s.y); ctx.rotate(s.a);
            ctx.fillStyle = glassFill; ctx.strokeStyle = glassLine; ctx.lineWidth = 0.8;
            ctx.beginPath(); s.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }
        if (!sparks.length) return;
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineWidth = 1.4;
        for (const k of sparks) {
            const t = clampN(k.life / k.max, 0, 1);
            ctx.strokeStyle = `rgba(255,${Math.round(150 + 90 * t)},${Math.round(80 * t)},${t.toFixed(3)})`;
            ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.lineTo(k.x - k.vx * 0.012, k.y - k.vy * 0.012); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
    }
    function fxRender() {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.clearRect(0, 0, FW, FH);
        if (shoot) drawSlingshot();
        drawParticles();
        if (flash > 0) { ctx.fillStyle = `rgba(255,236,200,${(flash * 0.35).toFixed(3)})`; ctx.fillRect(0, 0, FW, FH); }
    }
    const fxBusy = () => shoot || shards.length > 0 || sparks.length > 0 || pebbles.length > 0 || flash > 0;
    function fxFrame(now) {
        const dt = Math.min(0.05, (now - fxLast) / 1000);
        fxLast = now; fxAcc += dt;
        if (shoot && updateFloor() && aim === null) placeSling();          // scrolled: the slingshot keeps to the visible floor
        if (shoot && pebbles.length) {
            const h = hero.getBoundingClientRect(), t = themeToggle.getBoundingClientRect();
            switchBox = { l: t.left - h.left, r: t.right - h.left, t: t.top - h.top, b: t.bottom - h.top };
        } else switchBox = null;
        while (fxAcc >= STEP) { fxStep(STEP); fxAcc -= STEP; }
        fxTick(dt);
        fxRender();
        if (fxBusy() && visible) { fxRaf = requestAnimationFrame(fxFrame); return; }
        fxRaf = 0;
    }
    function fxWake() {
        if (fxRaf || !visible || !fxBusy()) return;
        fxLast = performance.now(); fxAcc = 0;
        fxRaf = requestAnimationFrame(fxFrame);
    }
    function setShoot(on) {
        if (on && !root.offsetParent) return false;                        // no lamp on this screen (very short viewports)
        shoot = !!on;
        if (shoot) { played = true; if (pill === 'play') hidePill(); }
        hero.classList.toggle('is-shooting', shoot);
        aim = null;
        hero.classList.remove('is-aiming');
        placeSling(null);                                                    // back under the lamp for the first shot
        if (shoot) fxWake(); else if (!fxRaf) fxRender();
        return shoot;
    }

    // how much the lamp lights a point of the hero (0..1): inside the cone, fading towards its edge and its end
    function lightAt(x, y) {
        if (broken || !isOn()) return 0;
        const l = toLocal(x, y);
        const ly = l.y - geo.cord - 64 * geo.k;               // distance below the rim
        const reach = 494 * geo.k;
        if (ly < 0 || ly > reach) return 0;
        const hw = 46 * geo.k + 0.41 * ly;                    // the cone's half width there
        const edge = clampN((hw - Math.abs(l.x)) / (hw * 0.35), 0, 1);
        return edge * (1 - ly / reach);
    }

    measure();
    return {
        nudge,
        lightAt,
        replace,
        shoot: setShoot,
        setOn(on) { if (broken || isOn() === !!on) return; setTheme(on ? 'dark' : 'light', centerOf(bulb)); if (!reduced.matches) nudge(0.45); },
        status: () => ({ on: isOn(), broken, shots: stats.shots, bulbs: stats.bulbs, shoot, slingX: sling.x, slingY: sling.rest.y }),
    };
})();

// ============================================
// CUSTOM CURSOR
// ============================================
const cursorDot  = document.getElementById('cursor-dot');
const cursorRing = document.getElementById('cursor-ring');
const cursorGlow = document.getElementById('cursor-glow');

if (window.matchMedia('(hover: hover)').matches) {
    let mouseX = 0, mouseY = 0;
    let ringX  = 0, ringY  = 0;

    window.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        cursorDot.style.left  = mouseX + 'px';
        cursorDot.style.top   = mouseY + 'px';
        cursorGlow.style.left = mouseX + 'px';
        cursorGlow.style.top  = mouseY + 'px';
    });

    // ring follows with slight lag
    function animateRing() {
        ringX += (mouseX - ringX) * 0.18;
        ringY += (mouseY - ringY) * 0.18;
        cursorRing.style.left = ringX + 'px';
        cursorRing.style.top  = ringY + 'px';
        requestAnimationFrame(animateRing);
    }
    animateRing();

    // expand on interactive elements
    const interactives = 'a, button, .skill-tab, .skill-tag, .contact-link, .nav-link';
    document.addEventListener('mouseover', e => {
        if (e.target.closest(interactives)) document.body.classList.add('cursor-hover');
    });
    document.addEventListener('mouseout', e => {
        if (e.target.closest(interactives)) document.body.classList.remove('cursor-hover');
    });
}

// ============================================
// SCROLL PROGRESS BAR
// ============================================
const progressBar = document.getElementById('scroll-progress');

// The elePHPant (PHP's mascot) walks the progress line: right as you scroll down, back as you scroll up.
//
// Motion model (rewritten after it stuttered on iPhone):
//  - scroll events only record a target; one rAF loop eases the elephant toward it, so uneven
//    event timing during momentum scrolling never shows up as stop-start movement
//  - the legs step by DISTANCE scrolled, not by a timer: on a long page the body moves ~1px per
//    30px of scroll, and timer-driven legs looked like frantic running on the spot
//  - it turns round only after 36px of travel the other way over 3+ events, so wobble or a glitch can't flip it
//  - only transforms change per frame; every layout measurement is cached
const elephpant = document.getElementById('elephpant');
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const isTouch = window.matchMedia('(hover: none)').matches;
const ele = { w: 0, track: 0, maxScroll: 1, vw: 0, blocked: [], target: 0, cur: null, dist: 0, t: 0, lastY: window.scrollY,
              ticks: [], lastCenter: null, turn: 0, turnEvents: 0, facingLeft: false, raf: 0, lastP: 0, greeted: false, lastCheer: 0, summonedUntil: 0 };
try { ele.greeted = sessionStorage.getItem('elephpant-greeted') === '1'; } catch (e) { /* unavailable */ }

function measureElephpant() {
    ele.vw = window.innerWidth;
    ele.maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    if (!elephpant) return;
    ele.w = elephpant.offsetWidth;
    ele.track = ele.vw - ele.w;
    // On touch screens it walks under the logo and the nav buttons: it must not take their taps there.
    ele.blocked = !isTouch ? [] : [...document.querySelectorAll('.nav-logo, .theme-toggle, .nav-toggle')]
        .filter(node => node.offsetParent)
        .map(node => { const r = node.getBoundingClientRect(); return [r.left - ele.w - 10, r.right + 10]; });

    // one tick on the line per section in the nav, at the x where the elephant will be when you reach it
    const holder = document.getElementById('progress-ticks');
    if (!holder) return;
    const navH = document.getElementById('navbar').offsetHeight;
    const xs = [...document.querySelectorAll('.nav-link')].map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean)
        .map(sec => Math.max(0, Math.min(1, (sec.offsetTop - navH) / ele.maxScroll)) * ele.track + ele.w / 2);
    while (holder.children.length < xs.length) holder.appendChild(document.createElement('i'));
    while (holder.children.length > xs.length) holder.lastChild.remove();
    ele.ticks = xs.map((x, i) => { const node = holder.children[i]; node.style.left = (x - 1).toFixed(1) + 'px'; return { x, node }; });
}

function renderElephpant() {
    const x = ele.cur;
    elephpant.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
    progressBar.style.transform = `scaleX(${((x + ele.w * 0.3) / ele.vw).toFixed(5)})`;   // the line ends under its back legs
    // one full leg swing per ~190px scrolled (capped in elephpantFrame): a calm walk that stops when you do
    const swing = reducedMotionQuery.matches ? 0 : Math.sin(ele.dist / 30);
    elephpant.style.setProperty('--leg', (swing * 15).toFixed(2) + 'deg');
    elephpant.style.setProperty('--bob', (-Math.abs(swing) * 1.1).toFixed(2) + 'px');
    elephpant.style.pointerEvents = ele.blocked.some(([a, b]) => x > a && x < b) ? 'none' : '';

    // ticks behind it turn red; crossing one makes it hop
    const center = x + ele.w / 2;
    for (const tick of ele.ticks) {
        tick.node.classList.toggle('passed', center >= tick.x);
        if (ele.lastCenter !== null && (ele.lastCenter < tick.x) !== (center < tick.x) && !reducedMotionQuery.matches && !elephpant.classList.contains('hop')) {
            elephpant.classList.add('hop');
            setTimeout(() => elephpant.classList.remove('hop'), 360);
        }
    }
    ele.lastCenter = center;
}

function elephpantFrame(t) {
    const dt = ele.t ? Math.min(50, t - ele.t) : 16.7;      // real elapsed time: same feel at 60Hz and 120Hz
    ele.t = t;
    const gap = ele.target - ele.cur;
    if (Math.abs(gap) < 0.05) { ele.cur = ele.target; ele.raf = 0; ele.t = 0; renderElephpant(); return; }
    const move = gap * (1 - Math.exp(-dt / 70));
    ele.cur += move;
    // Steps follow the distance scrolled, but never faster than a calm ~1 stride a second: a fast fling
    // covers 50-90px a frame, which would otherwise spin the legs several steps per frame (looks like shaking).
    const scrolledEquivalent = Math.abs(move) * (ele.maxScroll / Math.max(1, ele.track));
    ele.dist += Math.min(scrolledEquivalent, dt * 0.2);
    renderElephpant();
    ele.raf = requestAnimationFrame(elephpantFrame);
}

function updateProgress() {
    const y = window.scrollY;
    const p = Math.max(0, Math.min(1, y / ele.maxScroll));
    if (!elephpant) { progressBar.style.transform = `scaleX(${p})`; return; }

    // nothing at the very top of the page — unless `php -v` just summoned it and it is mid-trumpet
    const visible = y > 40 || performance.now() < ele.summonedUntil;
    elephpant.classList.toggle('show', visible);
    progressBar.style.opacity = visible ? '1' : '0';
    const tickHolder = document.getElementById('progress-ticks');
    if (tickHolder) tickHolder.classList.toggle('show', visible);

    // direction, with hysteresis
    const dy = y - ele.lastY;
    ele.lastY = y;
    // Turn round only after 36px of travel the other way across at least 3 consecutive events:
    // a 1px wobble can't flip it, and neither can a single glitchy jump of any size.
    if (dy !== 0) {
        if ((dy < 0) === ele.facingLeft) { ele.turn = 0; ele.turnEvents = 0; }
        else {
            ele.turn += Math.abs(dy);
            if (++ele.turnEvents >= 3 && ele.turn > 36) {
                ele.facingLeft = dy < 0;
                ele.turn = 0; ele.turnEvents = 0;
                elephpant.classList.toggle('left', ele.facingLeft);
            }
        }
    }

    ele.target = p * ele.track;
    if (ele.cur === null || reducedMotionQuery.matches) { ele.cur = ele.target; renderElephpant(); }
    else if (!ele.raf) ele.raf = requestAnimationFrame(elephpantFrame);

    // It says hello once per visit the first time it appears, and celebrates when you reach the end
    // (both are unprompted motion, so not under reduced motion — a tap still works there)
    if (visible && !ele.greeted) {
        ele.greeted = true;
        try { sessionStorage.setItem('elephpant-greeted', '1'); } catch (e) { /* unavailable */ }
        if (!reducedMotionQuery.matches) setTimeout(elephpantTrumpet, 700);
    }
    const now = performance.now();
    if (!reducedMotionQuery.matches && p >= 0.995 && ele.lastP < 0.995 && now - ele.lastCheer > 6000) {   // cooldown: iOS rubber-banding re-crosses the line
        ele.lastCheer = now;
        setTimeout(elephpantTrumpet, 300);
    }
    ele.lastP = p;
}

const remeasure = () => { measureElephpant(); updateProgress(); };
window.addEventListener('scroll', updateProgress, { passive: true });
window.addEventListener('resize', remeasure, { passive: true });
window.addEventListener('load', remeasure);
if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);   // page height changes (terminal output, skill filter)
remeasure();   // a reload can restore a scroll position

// Click it (or run `php -v` in the terminal) and it rears up and trumpets a little PHP
function elephpantTrumpet() {
    if (!elephpant || elephpant.classList.contains('trumpet')) return;
    // keep the spray on screen: at either edge it turns to face the page first
    const box = elephpant.getBoundingClientRect();
    if (box.right > window.innerWidth - 130) ele.facingLeft = true;
    else if (box.left < 130) ele.facingLeft = false;
    elephpant.classList.toggle('left', ele.facingLeft);

    ele.summonedUntil = performance.now() + 1500;
    elephpant.classList.add('show', 'trumpet');
    setTimeout(() => elephpant.classList.remove('trumpet'), 650);
    setTimeout(updateProgress, 1600);   // summoned from the top of the page (`php -v`)? slip away again afterwards
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !elephpant.animate) return;

    const r = elephpant.getBoundingClientRect();
    const dir = elephpant.classList.contains('left') ? -1 : 1;
    const tipX = dir === 1 ? r.right - 2 : r.left + 2, tipY = r.top + 2;
    ['<?php', '->', '::', '$this', '=>'].forEach((glyph, i) => {
        const s = document.createElement('span');
        s.className = 'ele-spray';
        s.textContent = glyph;
        s.style.left = tipX + 'px';
        s.style.top  = tipY + 'px';
        document.body.appendChild(s);
        const dx = dir * (26 + i * 17 + Math.random() * 14), up = 16 + Math.random() * 22;
        s.animate([
            { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
            { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% - ${up}px)) scale(1)`, opacity: 1, offset: 0.35 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${34 + i * 5}px)) scale(0.9)`, opacity: 0 },
        ], { duration: 950, delay: 140 + i * 55, easing: 'cubic-bezier(0.3, 0.6, 0.4, 1)', fill: 'backwards' }).onfinish = () => s.remove();
    });
}
if (elephpant) elephpant.addEventListener('click', elephpantTrumpet);

// ============================================
// NAVIGATION
// ============================================
const navbar   = document.getElementById('navbar');
const navToggle = document.getElementById('nav-toggle');
const navMenu  = document.getElementById('nav-menu');
const navLinks = document.querySelectorAll('.nav-link');

const setNavOpen = open => {
    navMenu.classList.toggle('active', open);
    navToggle.classList.toggle('active', open);
    navToggle.setAttribute('aria-expanded', String(open));
};

navToggle.addEventListener('click', () => setNavOpen(!navMenu.classList.contains('active')));

navLinks.forEach(link => link.addEventListener('click', () => setNavOpen(false)));

// tap outside the open mobile menu closes it
document.addEventListener('click', e => {
    if (navMenu.classList.contains('active') && !e.target.closest('#navbar')) setNavOpen(false);
});

window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ============================================
// ACTIVE NAV HIGHLIGHT
// ============================================
const sections = document.querySelectorAll('.section');

const highlightNavigation = () => {
    const scrollPos = window.scrollY;
    const winH      = window.innerHeight;
    const docH      = document.documentElement.scrollHeight;

    if (Math.ceil(scrollPos + winH) >= docH - 50) {
        updateActiveLink(sections[sections.length - 1]?.getAttribute('id'));
        return;
    }

    sections.forEach(section => {
        const top    = section.offsetTop - 150;
        const height = section.offsetHeight;
        if (scrollPos >= top && scrollPos < top + height) {
            updateActiveLink(section.getAttribute('id'));
        }
    });
};

const linkedIds = new Set([...navLinks].map(l => l.getAttribute('href').slice(1)));

const updateActiveLink = id => {
    if (id !== 'home' && !linkedIds.has(id)) return;
    navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
    });
};

// ============================================
// SMOOTH SCROLL
// ============================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        e.preventDefault();
        const target = document.querySelector(targetId);
        if (target) {
            window.scrollTo({ top: target.offsetTop - navbar.offsetHeight, behavior: 'smooth' });
        }
    });
});

// ============================================
// SCROLL REVEAL
// ============================================
const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            // pop any emoji-icon inside the revealed card
            const emojis = entry.target.querySelectorAll('.emoji-icon');
            emojis.forEach((e, i) => {
                setTimeout(() => {
                    e.classList.add('pop');
                    setTimeout(() => e.classList.remove('pop'), 600);
                }, i * 80);
            });
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.scroll-reveal').forEach(el => revealObserver.observe(el));

// ============================================
// STATS COUNTER ANIMATION
// ============================================
const animateCounter = (element, target, duration = 2000) => {
    const numMatch = target.match(/(\d+)/);
    if (!numMatch) return;
    const numericTarget = parseInt(numMatch[1]);
    const hasPlus = target.includes('+');
    const prefix  = target.substring(0, target.indexOf(numMatch[0]));
    let current   = 0;
    const inc     = numericTarget / (duration / 16);

    const tick = () => {
        current += inc;
        if (current < numericTarget) {
            element.textContent = prefix + Math.floor(current) + (hasPlus ? '+' : '');
            requestAnimationFrame(tick);
        } else {
            element.textContent = target;
        }
    };
    tick();
};

const statsObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const num = entry.target.querySelector('.stat-number');
            const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (num && !still && !num.classList.contains('animated')) {
                num.classList.add('animated');
                animateCounter(num, num.textContent.trim(), 2000);
                // pop the stat-number emoji on entry
                num.classList.add('emoji-pop');
                setTimeout(() => num.classList.remove('emoji-pop'), 600);
            }
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('.bento-item').forEach(c => statsObserver.observe(c));

// ============================================
// EXPERIENCE DURATIONS — computed so "Present" never goes stale
// ============================================
document.querySelectorAll('.timeline-date[data-start]').forEach(el => {
    const [sy, sm] = el.dataset.start.split('-').map(Number);
    const now = new Date();
    const [ey, em] = el.dataset.end
        ? el.dataset.end.split('-').map(Number)
        : [now.getFullYear(), now.getMonth() + 1];
    const months = (ey - sy) * 12 + (em - sm) + 1; // inclusive, LinkedIn-style
    const y = Math.floor(months / 12), m = months % 12;
    const parts = [];
    if (y) parts.push(`${y} yr${y > 1 ? 's' : ''}`);
    if (m) parts.push(`${m} mo${m > 1 ? 's' : ''}`);
    if (parts.length) el.textContent += ' · ' + parts.join(' ');
});

// ============================================
// SKILL CATEGORY TABS
// ============================================
const skillTabs = document.querySelectorAll('.skill-tab');
const skillCategories = document.querySelectorAll('.skill-category');

skillTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;

        skillTabs.forEach(t => {
            t.classList.toggle('active', t === tab);
            t.setAttribute('aria-pressed', String(t === tab));
        });

        skillCategories.forEach(cat => {
            if (target === 'all' || cat.dataset.category === target) {
                cat.classList.remove('hidden');
            } else {
                cat.classList.add('hidden');
            }
        });
    });
});

// ============================================
// BACK TO TOP
// ============================================
const backToTop = document.getElementById('back-to-top');

window.addEventListener('scroll', () => {
    backToTop.classList.toggle('visible', window.scrollY > 500);
}, { passive: true });

const footerEl = document.querySelector('.footer');
if (footerEl && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => backToTop.classList.toggle('at-footer', entry.isIntersecting)).observe(footerEl);
}

const motionOK = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// One rocket flight from (startX, startY) off the top of the screen. Used by the back-to-top
// button and by the terminal's `deploy` command.
function flyRocket(startX, startY, onDone) {
    const fly = document.createElement('div');
    fly.className = 'rocket-flying';
    fly.textContent = '🚀';
    fly.style.left = startX + 'px';
    fly.style.top  = startY + 'px';
    document.body.appendChild(fly);

    const duration  = 750;
    const endY      = -60;
    let   lastTrail = 0;

    function spawnExhaust(x, y) {
        const p = document.createElement('div');
        p.className = 'rocket-exhaust';
        const spread = (Math.random() - 0.5) * 14;
        p.style.left = (x + spread - 3) + 'px';
        p.style.top  = (y + 10)         + 'px';
        p.style.width  = (4 + Math.random() * 5) + 'px';
        p.style.height = p.style.width;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 520);
    }

    const t0 = performance.now();
    function frame(now) {
        const progress = Math.min((now - t0) / duration, 1);
        // Ease-in so it accelerates like a real launch
        const curY = startY + (endY - startY) * progress * progress;

        fly.style.top     = curY + 'px';
        fly.style.opacity = progress > 0.75 ? String(1 - (progress - 0.75) / 0.25) : '1';

        // Drop exhaust particle every ~35ms
        if (now - lastTrail > 35) {
            spawnExhaust(startX, curY);
            lastTrail = now;
        }

        if (progress < 1) {
            requestAnimationFrame(frame);
        } else {
            fly.remove();
            if (onDone) onDone();
        }
    }
    requestAnimationFrame(frame);
}

backToTop.addEventListener('click', () => {
    if (backToTop.dataset.flying === '1') return;
    backToTop.dataset.flying = '1';

    const rect = backToTop.getBoundingClientRect();

    // Hide the button while rocket is in flight
    backToTop.style.opacity = '0';
    backToTop.style.transform = 'scale(0.7)';

    flyRocket(rect.left + rect.width / 2, rect.top + rect.height / 2, () => {
        backToTop.style.opacity  = '';
        backToTop.style.transform = '';
        backToTop.dataset.flying = '0';
        // Landing re-entry animation
        backToTop.classList.add('landing');
        setTimeout(() => backToTop.classList.remove('landing'), 450);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ============================================
// CONTACT ANALYTICS
// ============================================
document.querySelectorAll('.contact-link').forEach(link => {
    link.addEventListener('click', function () {
        const linkType = this.id.replace('-link', '');
        if (typeof gtag === 'function') {
            gtag('event', 'contact_click', { event_category: 'engagement', event_label: linkType });
        }
    });
});

// ============================================
// PERFORMANCE: DEBOUNCE SCROLL HANDLERS
// ============================================
function debounce(fn, wait = 12) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

const debouncedHighlight = debounce(highlightNavigation, 12);
window.addEventListener('scroll', debouncedHighlight, { passive: true });

// ============================================
// ACCESSIBILITY
// ============================================
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && navMenu.classList.contains('active')) {
        setNavOpen(false);
        navToggle.focus();
    }
});

navToggle.addEventListener('click', () => {
    if (navMenu.classList.contains('active')) {
        setTimeout(() => navMenu.querySelector('.nav-link')?.focus(), 80);
    }
});

// ============================================
// HERO CANVAS — floating code symbols
// ============================================
function initHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    const isDark = () => document.documentElement.getAttribute('data-theme') !== 'light';

    const symbols = [
        // Identity
        'Nainesh', 'NR', 'nainesh.dev',
        // Company & locations
        'WebOccult', 'Gotilo', 'Ahmedabad', 'India', 'Gujarat',
        'USA', 'Australia', 'Japan', 'Netherlands',
        // Laravel ecosystem
        'Laravel', 'Eloquent', 'Artisan', 'Blade', 'Livewire',
        'Route::', 'Cache::', 'Queue::push()', 'Redis::', 'Middleware',
        'php artisan', '<?php', '@inject', 'composer require',
        '$this->', '=>', '::', '->where()', 'fn()', '|>',
        // PHP syntax
        'return', 'public', 'static', 'abstract', 'interface',
        // Databases & caching
        'MySQL', 'PostgreSQL', 'Redis', 'RabbitMQ', 'Elasticsearch',
        // Frontend
        'Vue.js', 'jQuery', 'Vite', 'Alpine.js',
        // APIs & patterns
        'REST API', 'GraphQL', 'Microservices', 'WebSockets',
        'Multi-Tenant', 'SaaS', 'OAuth', 'Stripe',
        // DevOps & infra
        'Docker', 'AWS', 'Azure', 'n8n', 'nginx', 'CI/CD',
        '.env', 'git push', 'Forge', 'Vapor',
        // AI / CV work
        'TensorFlow', 'OpenCV', 'CV Pipeline',
        // Role & impact
        'Tech Lead', '13+ Years', '50+ Projects', '25+ Devs',
        'Performance', 'Scalable', 'Architecture', 'ERP',
        'LaravelLive', 'Speaker', 'Mentor',
    ];

    let W, H, particles;

    function resize() {
        W = canvas.width  = canvas.offsetWidth;
        H = canvas.height = canvas.offsetHeight;
    }

    // Strip-based: canvas divided into vertical lanes so symbols never overlap
    class Sym {
        constructor(strip, total, init) {
            this.strip = strip;
            this.total = total;
            this.reset(init);
        }
        reset(init) {
            const laneW = W / this.total;
            // Stay within own lane, small random offset for organic feel
            this.x    = this.strip * laneW + laneW * 0.15 + Math.random() * laneW * 0.55;
            this.y    = init ? Math.random() * H : H + 20;
            // Rotate through symbol list by lane so adjacent lanes show different text
            const group = Math.floor(Math.random() * 4);
            this.text = symbols[(this.strip + group * Math.ceil(symbols.length / 4)) % symbols.length];
            this.spd  = 0.14 + Math.random() * 0.20;
            this.opa  = 0.22 + Math.random() * 0.18; // 0.22–0.40 base — readable in dark mode
            this.size = 9 + Math.floor(Math.random() * 5);
        }
        tick() {
            this.y -= this.spd;
            if (this.y < -24) this.reset(false);
        }
        draw() {
            const dark = isDark();
            const lit = dark ? heroLamp.lightAt(this.x + this.size * 2, this.y - this.size * 0.4) : 0;   // under the lamp?
            ctx.save();
            // phones have no empty margin: the words drift across the copy, so keep them as faint texture only
            ctx.globalAlpha = Math.min(1, (dark ? this.opa : this.opa * 1.5) * (W <= 768 ? 0.3 : 1) + lit * 0.6); // dark 0.22–0.40, light 0.33–0.60
            ctx.fillStyle   = lit > 0.02 ? `rgb(255, ${Math.round(45 + 150 * lit)}, ${Math.round(32 + 80 * lit)})` : dark ? '#FF2D20' : '#8B1A0E';
            ctx.font        = `${this.size}px "Fira Code", monospace`;
            ctx.fillText(this.text, this.x, this.y);
            ctx.restore();
        }
    }

    function init() {
        resize();
        // Responsive count: ~1 symbol per 60px of width, capped for perf
        const count = W <= 768 ? 6 : Math.max(10, Math.min(26, Math.floor(W / 60)));
        particles = Array.from({ length: count }, (_, i) => new Sym(i, count, true));
    }

    let raf;
    function loop() { ctx.clearRect(0, 0, W, H); particles.forEach(p => { p.tick(); p.draw(); }); raf = requestAnimationFrame(loop); }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) cancelAnimationFrame(raf);
        else loop();
    });

    const ro = new ResizeObserver(() => init()); // reinit so lane widths recalculate
    ro.observe(canvas.parentElement);

    init();
    loop();
}

// ============================================
// HERO TYPING — cycles through roles
// ============================================
function initHeroTyping() {
    const el = document.getElementById('typing-text');
    if (!el) return;

    // Phones: the terminal bar fits ~22 characters after the prompt at 320px
    const roles = window.matchMedia('(max-width: 480px)').matches ? [
        'Technical Lead',
        'Laravel Expert',
        '13+ Years Experience',
        'Speaker & Mentor',
        'Performance Tuning'
    ] : [
        'Technical Lead & Laravel Expert',
        '13+ Years Engineering Experience',
        'Conference Speaker & Mentor',
        'Performance Optimization Specialist',
        'Scaling Laravel for High Traffic'
    ];

    const cursor = document.querySelector('.typing-cursor');
    let ri = 0, ci = 0, deleting = false;
    const WRITE = 70, DELETE = 35, PAUSE = 2200, GAP = 500;

    function tick() {
        const role = roles[ri];
        if (deleting) {
            if (cursor) cursor.classList.add('is-typing');
            ci--;
            el.textContent = role.slice(0, ci);
            if (ci === 0) {
                deleting = false;
                ri = (ri + 1) % roles.length;
                if (cursor) cursor.classList.remove('is-typing');
                setTimeout(tick, GAP);
                return;
            }
            setTimeout(tick, DELETE);
        } else {
            if (cursor) cursor.classList.add('is-typing');
            ci++;
            el.textContent = role.slice(0, ci);
            if (ci === role.length) {
                deleting = true;
                if (cursor) cursor.classList.remove('is-typing');
                setTimeout(tick, PAUSE);
                return;
            }
            setTimeout(tick, WRITE);
        }
    }

    setTimeout(tick, 900);
}

// ============================================
// PAGE LOAD
// ============================================
let pageStarted = false;
function startPage() {
    if (pageStarted) return;
    pageStarted = true;
    document.body.classList.add('loaded');

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Dismiss page loader
    const loader = document.getElementById('page-loader');
    if (loader) setTimeout(() => loader.classList.add('out'), reducedMotion ? 0 : 480);

    initHeroCanvas();
    initHeroTyping();
    initHeroSpotlight();
    if (!reducedMotion) setTimeout(() => heroLamp.nudge(0.7), 500);   // the lamp settles as the hero comes in
    initSectionUnderlines();
    if (!reducedMotion) {
        initCardTouchShimmer();
        initMagneticBtns();
    }
    initSectionGlow();
    initSkillTooltips();
}

window.addEventListener('load', startPage);
setTimeout(startPage, 2500); // fallback if analytics/fonts stall the load event

// ============================================
// DYNAMIC COPYRIGHT YEAR
// ============================================
const footer = document.querySelector('.footer p');
if (footer) footer.textContent = footer.textContent.replace(/\d{4}/, new Date().getFullYear());

// ============================================
// 1. CARD TOUCH SHIMMER (mobile)
// ============================================
function initCardTouchShimmer() {
    if (!window.matchMedia('(hover: none)').matches) return;
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('touchstart', () => {
            card.style.transition = 'box-shadow 0.25s ease, border-color 0.25s ease';
            card.style.boxShadow  = '0 0 28px rgba(255,45,32,0.28)';
            card.style.borderColor = 'rgba(255,45,32,0.55)';
            setTimeout(() => { card.style.boxShadow = ''; card.style.borderColor = ''; }, 550);
        }, { passive: true });
    });
}

// ============================================
// 2. MAGNETIC BUTTONS (desktop) / TAP RIPPLE (mobile)
// ============================================
function initMagneticBtns() {
    const isTouch = window.matchMedia('(hover: none)').matches;
    document.querySelectorAll('.btn').forEach(btn => {
        if (isTouch) {
            btn.addEventListener('touchstart', e => {
                const touch = e.touches[0];
                const r = btn.getBoundingClientRect();
                const x = touch.clientX - r.left;
                const y = touch.clientY - r.top;
                const ripple = document.createElement('span');
                ripple.className = 'btn-ripple';
                ripple.style.left = x + 'px';
                ripple.style.top  = y + 'px';
                btn.appendChild(ripple);
                setTimeout(() => ripple.remove(), 650);
            }, { passive: true });
        } else {
            btn.addEventListener('mousemove', e => {
                const r = btn.getBoundingClientRect();
                const x = ((e.clientX - r.left) - r.width  / 2) * 0.28;
                const y = ((e.clientY - r.top)  - r.height / 2) * 0.36;
                btn.style.transition = 'transform 0.12s ease';
                btn.style.transform  = `translate(${x}px, ${y}px)`;
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transition = 'transform 0.5s var(--spring)';
                btn.style.transform  = '';
            });
        }
    });
}

// ============================================
// 4. SECTION AMBIENT GLOW ON SCROLL
// ============================================
function initSectionGlow() {
    const obs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const title = entry.target;
            title.classList.add('section-glow');
            setTimeout(() => title.classList.remove('section-glow'), 1800);
            obs.unobserve(title);
        });
    }, { threshold: 0.5 });
    document.querySelectorAll('.section-title').forEach(t => obs.observe(t));
}

// ============================================
// 5. SKILL TAG CODE SNIPPET TOOLTIP
// ============================================
function initSkillTooltips() {
    const isTouch = window.matchMedia('(hover: none)').matches;
    const map = {
        'Laravel':       "Route::get('/users', [UserController::class, 'index']);",
        'PHP':           "fn($x): bool => match(true) { $x > 0 => true, default => false };",
        'Eloquent':      "User::where('active', 1)->with('posts')->paginate(20);",
        'Redis':         "Cache::remember('users', 3600, fn() => User::all());",
        'MySQL':         "SELECT id, name FROM users WHERE active = 1 LIMIT 20;",
        'PostgreSQL':    "SELECT id, title FROM posts WHERE created_at > NOW() - INTERVAL '7 days';",
        'Docker':        "docker compose up --build -d && docker compose logs -f",
        'Vue.js':        "const count = ref(0); const double = computed(() => count.value * 2);",
        'GraphQL':       "query { users { id name posts { title createdAt } } }",
        'AWS':           "aws s3 sync ./dist s3://bucket --delete --cache-control max-age=31536000",
        'Microservices': "Http::timeout(5)->retry(3)->post('/svc/orders', $payload);",
        'RabbitMQ':      "Queue::connection('rabbitmq')->push(new ProcessOrderJob($order));",
        'TensorFlow':    "model.fit(X_train, y_train, epochs=10, validation_split=0.2)",
        'Git':           "git push origin feature/perf-opt --force-with-lease",
        'CI/CD':         "push → build → test → deploy → notify ✅",
        'n8n':           "// Trigger → HTTP Request → Transform → Slack Notify",
        'Azure':         "az webapp up --name myapp --resource-group prod-rg",
        'Stripe':        "PaymentIntent::create(['amount'=>1999,'currency'=>'usd']);",
        'OAuth':         "return Socialite::driver('google')->redirect();",
    };

    const tip = document.createElement('div');
    tip.className = 'skill-code-tip';
    document.body.appendChild(tip);

    let tipTimeout;
    document.querySelectorAll('.skill-tag').forEach(tag => {
        const code = map[tag.textContent.trim()];
        if (!code) return;
        if (isTouch) {
            tag.addEventListener('touchstart', e => {
                const touch = e.touches[0];
                tip.textContent = code;
                const tw = Math.min(window.innerWidth - 16, 320);
                tip.style.maxWidth = tw + 'px';
                const x = Math.max(8, Math.min(window.innerWidth - tw - 8, touch.clientX - tw / 2));
                tip.style.left = x + 'px';
                tip.style.top  = (touch.clientY - 68) + 'px';
                tip.classList.add('visible');
                clearTimeout(tipTimeout);
                tipTimeout = setTimeout(() => tip.classList.remove('visible'), 2200);
            }, { passive: true });
        } else {
            const move = e => {
                const tw = tip.offsetWidth;
                const x  = Math.max(8, Math.min(window.innerWidth - tw - 8, e.clientX - tw / 2));
                tip.style.left = x + 'px';
                tip.style.top  = (e.clientY - 56) + 'px';
            };
            tag.addEventListener('mouseenter', e => { tip.textContent = code; tip.classList.add('visible'); move(e); });
            tag.addEventListener('mousemove', move);
            tag.addEventListener('mouseleave', () => tip.classList.remove('visible'));
        }
    });
}

// ============================================
// COPY EMAIL TO CLIPBOARD
// ============================================
function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// A paper plane leaves the clicked element, loops up and away — "message sent"
function launchPaperPlane(fromEl) {
    if (!motionOK() || !fromEl.animate) return;
    const r = fromEl.getBoundingClientRect();
    const plane = document.createElement('div');
    plane.className = 'paper-plane';
    plane.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 11.2 21 3l-5.6 18-3.7-7.3L2.5 11.2Zm9.2 2.5 2.9 5.7L19 5.6l-7.3 8.1Z"/></svg>';
    plane.style.left = (r.left + r.width / 2) + 'px';
    plane.style.top  = (r.top + r.height / 2) + 'px';
    document.body.appendChild(plane);

    const dx = Math.min(innerWidth - r.left - 40, 260), dy = -Math.min(r.top + 60, 340);
    plane.animate([
        { transform: 'translate(-50%, -50%) rotate(0deg) scale(0.6)', opacity: 0 },
        { transform: `translate(calc(-50% + ${dx * 0.25}px), calc(-50% + 18px)) rotate(12deg) scale(1)`, opacity: 1, offset: 0.18 },
        { transform: `translate(calc(-50% + ${dx * 0.6}px), calc(-50% + ${dy * 0.45}px)) rotate(-28deg) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(-40deg) scale(0.5)`, opacity: 0 },
    ], { duration: 900, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' }).onfinish = () => plane.remove();
}

const emailLink = document.getElementById('email-link');
if (emailLink) {
    // Older browsers / iOS, and the path taken if the async clipboard is refused
    const legacyCopy = text => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (_) {}
        document.body.removeChild(ta);
        return ok;
    };

    emailLink.addEventListener('click', function () {
        launchPaperPlane(this);
        const email = 'nkrabadiya@gmail.com';
        const copied = () => showToast('✓ Email copied to clipboard');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(email).then(copied, () => { if (legacyCopy(email)) copied(); });
        } else if (legacyCopy(email)) {
            copied();
        }
    });
}

// ============================================
// HERO CURSOR SPOTLIGHT
// ============================================
function initHeroSpotlight() {
    if (window.matchMedia('(hover: none)').matches) return;
    const hero = document.querySelector('.hero');
    const spotlight = document.getElementById('hero-spotlight');
    if (!hero || !spotlight) return;
    hero.addEventListener('mousemove', e => {
        const r = hero.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width  * 100).toFixed(1) + '%';
        const y = ((e.clientY - r.top)  / r.height * 100).toFixed(1) + '%';
        spotlight.style.setProperty('--hx', x);
        spotlight.style.setProperty('--hy', y);
    }, { passive: true });
}

// ============================================
// SECTION TITLE UNDERLINE
// ============================================
function initSectionUnderlines() {
    const obs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const title = entry.target;
            setTimeout(() => title.classList.add('underlined'), 200);
            obs.unobserve(title);
        });
    }, { threshold: 0.5 });
    document.querySelectorAll('.section-title').forEach(t => obs.observe(t));
}

// ============================================
// INTERACTIVE TERMINAL (hero)
// ============================================
let runTerminal = null;   // set below; the lamp's "play" pill uses it
(function initTerminal() {
    const form   = document.getElementById('term-form');
    const input  = document.getElementById('term-input');
    const output = document.getElementById('term-output');
    if (!form || !input || !output) return;

    const SECTIONS = ['about', 'skills', 'experience', 'projects', 'speaking', 'community', 'contact'];
    const ALIASES  = { community: 'leadership', talks: 'speaking', work: 'projects', '~': 'home', home: 'home', education: 'education' };
    const TALKS = [
        ['2024-12', 'Laravel Queues on Steroids',                       'LaravelLive Ahmedabad'],
        ['2024-02', 'Speeding Up Your Large-Scale Laravel App, Part 2', 'LaravelLive Ahmedabad'],
        ['2023-07', 'Speeding Up Your Large-Scale Laravel App',         'LaravelLive Ahmedabad'],
        ['2022-12', 'Working with Laravel Observers',                   'LaravelLive Ahmedabad'],
    ];

    // tiny DOM helpers — everything goes through textContent, never innerHTML
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    const line = (...parts) => { const d = el('div'); parts.forEach(p => d.append(p)); return d; };
    const kv = (k, v) => line(el('span', 't-key', k.padEnd(11)), v);
    const link = (text, href) => { const a = el('a', null, text); a.href = href; if (/^http/.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } return a; };

    function goTo(id) {
        const target = document.getElementById(id);
        if (!target) return false;
        const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: id === 'home' ? 0 : target.offsetTop - navbar.offsetHeight, behavior: still ? 'instant' : 'smooth' });
        return true;
    }

    const COMMANDS = {
        help: () => [
            kv('whoami', 'who is this'),
            kv('about', 'php artisan about — the short version'),
            kv('ls', 'list sections  ·  ls talks/ lists talks'),
            kv('cd <name>', 'jump to a section, e.g. cd projects'),
            kv('contact', 'how to reach me'),
            kv('theme', 'toggle dark / light'),
            kv('lamp', 'the hero lamp — lamp:on · lamp:off · lamp --shoot'),
            kv('clear', 'clear the terminal'),
            line(el('span', 't-dim', 'also: deploy · php -v · php artisan inspire · php artisan down')),
        ],
        whoami: () => [
            line(el('span', 't-cmd-name', 'Nainesh Rabadiya')),
            line('Technical Lead · Senior Laravel Developer'),
            line('13+ years · 50+ projects · 25+ developers led'),
            line(el('span', 't-dim', '4× speaker — LaravelLive & Laravel Ahmedabad')),
        ],
        about: () => [
            kv('Role', 'Technical Lead @ WebOccult Technologies'),
            kv('Experience', '13+ years, since 2013'),
            kv('Stack', 'PHP · Laravel · MySQL · PostgreSQL · Redis'),
            kv('Focus', 'high-traffic performance, architecture, mentoring'),
            kv('Talks', '4 (2022 – 2024)'),
            kv('Laracons', '4 attended'),
        ],
        ls: arg => {
            if (/^talks\/?$/.test(arg || '')) {
                return [...TALKS.map(([d, t, v]) => line(el('span', 't-dim', d + '  '), t, el('span', 't-dim t-venue', v))),
                        line(el('span', 't-dim', '→ '), link('cd speaking', '#speaking'))];
            }
            if (arg) return [line(`ls: ${arg}: no such directory — try ls`)];
            return [line(SECTIONS.map(s => s + '/').join('  '))];
        },
        cd: arg => {
            const name = (arg || '').replace(/\/$/, '').toLowerCase();
            if (!name) return [line('usage: cd <section> — ' + SECTIONS.join(', '))];
            const id = ALIASES[name] || name;
            if (!goTo(id)) return [line(`cd: no such section: ${name} — try ls`)];
            return [line(el('span', 't-dim', `→ ~/nainesh/${name}`))];
        },
        contact: () => [
            kv('email', link('nkrabadiya@gmail.com', 'mailto:nkrabadiya@gmail.com')),
            kv('linkedin', link('in/naineshrabadiya', 'https://www.linkedin.com/in/naineshrabadiya/')),
            kv('github', link('nainesh-rabadiya', 'https://github.com/nainesh-rabadiya')),
            kv('x', link('@nainesh_9x', 'https://x.com/nainesh_9x')),
        ],
        deploy: () => {
            if (motionOK()) {
                const r = form.getBoundingClientRect();
                flyRocket(r.left + 28, r.top + r.height / 2);
            }
            return [line(el('span', 't-dim', 'Building… running tests… ')), line(el('span', 't-key', '✓ '), 'Deployed to production. 0 downtime.')];
        },
        elephant: () => {
            elephpantTrumpet();
            return [line('elePHPant 13.0 (cli) — 13+ years of uptime'), line(el('span', 't-dim', 'The mascot walks the red line under the top bar as you scroll. Tap it.'))];
        },
        inspire: () => {
            const quotes = [
                ['Simplicity is the ultimate sophistication.', 'Leonardo da Vinci'],
                ['Well begun is half done.', 'Aristotle'],
                ['It is not the man who has too little, but the man who craves more, that is poor.', 'Seneca'],
                ['Very little is needed to make a happy life.', 'Marcus Aurelius'],
            ];
            const [q, who] = quotes[Math.floor(Math.random() * quotes.length)];
            return [line('“' + q + '”'), line(el('span', 't-dim', '— ' + who))];
        },
        down: () => {
            const overlay = document.createElement('div');
            overlay.className = 'maintenance-mode';
            overlay.setAttribute('role', 'status');
            overlay.innerHTML = '<div><span>503</span><span>Service Unavailable</span></div><p>php artisan up in 2s…</p>';
            document.body.appendChild(overlay);
            setTimeout(() => { overlay.classList.add('out'); setTimeout(() => overlay.remove(), 400); }, 2200);
            return [line(el('span', 't-dim', 'Application is now in maintenance mode.')), line(el('span', 't-key', '✓ '), 'Application is now live.')];
        },
        theme: () => { themeToggle.click(); return [line(el('span', 't-dim', 'APP_THEME=' + htmlElement.getAttribute('data-theme')))]; },
        lamp: arg => {
            const a = (arg || '').replace(/^--/, '').toLowerCase().trim();
            const s = heroLamp.status();
            const tip = t => line(el('span', 't-dim', t));
            const ok = t => line(el('span', 't-key', '✓ '), t);
            if (a === 'shoot' || a === 'shoot on') {
                if (!heroLamp.shoot(true)) return [line('No lamp here to shoot at.')];
                return [ok('Slingshot loaded, under the lamp. Pull the pebble straight down and let go.'),
                        tip('It moves somewhere new after every shot. Aim for the bulb, the shade… or the theme switch. Esc or lamp --shoot off puts it away.')];
            }
            if (a === 'shoot off') { heroLamp.shoot(false); return [tip('Slingshot put away.')]; }
            if (a === 'on' || a === 'off') {
                if (s.broken) return [line('The bulb is blown.'), tip('→ php artisan lamp:replace')];
                if (s.on === (a === 'on')) return [tip(`Lamp is already ${a}.`)];
                heroLamp.setOn(a === 'on');
                return [ok(`Lamp ${a}. APP_THEME=${a === 'on' ? 'dark' : 'light'}`)];
            }
            if (a === 'replace') {
                if (!heroLamp.replace()) return [tip('Nothing to replace — the bulb is fine.')];
                return [ok('Bulb replaced.' + (s.on ? ' Lamp on.' : ' Flip the switch.'))];
            }
            if (a && a !== 'status') return [line(`lamp: unknown option: ${a}`), tip('lamp:on · lamp:off · lamp:replace · lamp --shoot')];
            return [kv('lamp', s.broken ? 'blown' + (s.on ? ' (switch on)' : '') : s.on ? 'on' : 'off'),
                    kv('shots', String(s.shots)), kv('bulbs', s.bulbs + ' replaced'),
                    tip('php artisan lamp:on · lamp:off · lamp:replace · lamp --shoot')];
        },
        sudo: () => [line('Permission denied. (contact works without sudo.)')],
    };

    function run(raw) {
        const text = raw.trim().replace(/\s+/g, ' ');
        if (!text) return;
        if (text === 'clear') { output.replaceChildren(); output.hidden = true; return; }

        let [name, ...rest] = text.split(' ');
        let arg = rest.join(' ');
        if (/^php artisan about$/i.test(text) || /^artisan about$/i.test(text)) { name = 'about'; arg = ''; }
        const artisan = text.match(/^(?:php )?artisan (inspire|down)$/i);
        if (artisan) { name = artisan[1]; arg = ''; }
        if (/^git push( .*)?$/i.test(text)) { name = 'deploy'; arg = ''; }
        const lampCmd = text.match(/^(?:(?:php )?artisan )?lamp(?::|\s|$)(.*)$/i);
        if (lampCmd) { name = 'lamp'; arg = lampCmd[1].trim(); }
        if (/^php (-v|--version)$/i.test(text) || /^elephpant$/i.test(text)) { name = 'elephant'; arg = ''; }
        name = name.toLowerCase();

        const block = el('div', 't-block');
        block.append(el('div', 't-cmd', text));
        const handler = Object.prototype.hasOwnProperty.call(COMMANDS, name) ? COMMANDS[name] : null;
        (handler ? handler(arg) : [line(`command not found: ${name} — try help`)]).forEach(n => block.append(n));

        output.hidden = false;
        output.append(block);
        const keep = window.matchMedia('(max-width: 768px)').matches ? 1 : 6;
        while (output.children.length > keep) output.firstElementChild.remove();
        output.scrollTop = keep === 1 ? 0 : output.scrollHeight;

        if (typeof gtag === 'function') gtag('event', 'terminal_command', { event_category: 'engagement', event_label: handler ? name : 'unknown' });
    }

    runTerminal = run;
    form.addEventListener('submit', e => { e.preventDefault(); run(input.value); input.value = ''; form.classList.remove('has-value'); });
    input.addEventListener('input', () => form.classList.toggle('has-value', input.value !== ''));
    input.addEventListener('keydown', e => { if (e.key === 'Escape') { input.value = ''; form.classList.remove('has-value'); input.blur(); } });
    document.querySelectorAll('.term-chip').forEach(chip => chip.addEventListener('click', () => run(chip.dataset.cmd)));
    // links printed by the terminal (#speaking) use the same offset scroll as the nav
    output.addEventListener('click', e => {
        const a = e.target.closest('a[href^="#"]');
        if (a) { e.preventDefault(); goTo(a.getAttribute('href').slice(1)); }
    });
})();

// ============================================
// PERF BADGE — this page's own numbers, measured in the visitor's browser
// ============================================
window.addEventListener('load', () => setTimeout(() => {
    const badge = document.getElementById('perf-badge');
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (!badge || !nav || !nav.loadEventEnd) return;

    const b = text => { const n = document.createElement('b'); n.textContent = text; return n; };
    const bytes = [nav, ...performance.getEntriesByType('resource')].reduce((sum, e) => sum + (e.transferSize || 0), 0);
    badge.append('Loaded in ', b((nav.loadEventEnd / 1000).toFixed(2) + 's'));   // the gauge replaces the ⚡
    const fresh = bytes > 8 * 1024; // a revisit only transfers a few hundred bytes of 304 headers
    badge.append(' · ', b(fresh ? Math.round(bytes / 1024) + ' KB' : 'cached'));
    badge.append(' · ', b('0'), ' frameworks');
    badge.hidden = false;
    // needle: 0s = far left (green), 3s+ = far right (red); it sweeps when the footer scrolls into view
    const seconds = nav.loadEventEnd / 1000;
    badge.style.setProperty('--needle', (-84 + Math.min(1, seconds / 3) * 168).toFixed(1) + 'deg');
    let sweep;
    new IntersectionObserver(([entry]) => {
        clearInterval(sweep);
        badge.classList.toggle('measured', entry.isIntersecting);
        if (!entry.isIntersecting || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        sweep = setInterval(() => {              // drop back to zero, then measure again
            badge.classList.remove('measured');
            setTimeout(() => badge.classList.add('measured'), 1500);
        }, 7000);
    }, { threshold: 0.6 }).observe(badge);
}, 0));

// ============================================
// CAROUSEL DOTS (phones — card rows scroll sideways, see styles.css)
// ============================================
document.querySelectorAll('.projects-grid').forEach(grid => {
    const cards = [...grid.children];
    if (cards.length < 2) return;
    const dots = document.createElement('div');
    dots.className = 'carousel-dots';
    dots.setAttribute('aria-hidden', 'true');
    cards.forEach((_, i) => { const d = document.createElement('span'); if (i === 0) d.className = 'on'; dots.append(d); });
    grid.after(dots);

    let ticking = false;
    grid.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            ticking = false;
            const atEnd = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 2;
            const base = cards[0].offsetLeft;
            let active = atEnd ? cards.length - 1 : 0;
            if (!atEnd) cards.forEach((c, i) => { if (c.offsetLeft - base <= grid.scrollLeft + 8) active = i; });
            [...dots.children].forEach((d, i) => d.classList.toggle('on', i === active));
        });
    }, { passive: true });
});

// ============================================
// EXPERIENCE: the git line draws downward as you scroll; each role's dot "commits" when reached
// ============================================
(function initTimelineProgress() {
    const timeline = document.querySelector('.experience-timeline');
    if (!timeline) return;
    const items = [...timeline.querySelectorAll('.timeline-item')];
    if (!motionOK()) { items.forEach(i => i.classList.add('reached')); return; } // CSS shows the full line
    timeline.classList.add('is-tracking');

    let ticking = false, active = false;
    function update() {
        ticking = false;
        const r = timeline.getBoundingClientRect();
        const mark = innerHeight * 0.6;                       // the "playhead" sits 60% down the screen
        const p = Math.max(0, Math.min(1, (mark - r.top) / r.height));
        timeline.style.setProperty('--progress', p.toFixed(4));
        items.forEach(i => i.classList.toggle('reached', i.getBoundingClientRect().top + 12 < mark));
    }
    const onScroll = () => { if (active && !ticking) { ticking = true; requestAnimationFrame(update); } };
    new IntersectionObserver(([e]) => { active = e.isIntersecting; if (active) update(); }, { rootMargin: '200px 0px' }).observe(timeline);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
})();

// ============================================
// N+1 → EAGER LOADING (Projects): 101 queries fire one by one, then collapse into 2
// ============================================
(function initNPlusOne() {
    const panel = document.getElementById('nplus1');
    if (!panel) return;
    const dotsEl = document.getElementById('np-dots'), count = document.getElementById('np-count'), code = document.getElementById('np-code');
    const DOTS = 44, QUERIES = 101;
    const before = code.innerHTML;
    for (let i = 0; i < DOTS; i++) { const d = document.createElement('span'); if (i < 2) d.className = 'keep'; dotsEl.appendChild(d); }
    const dots = [...dotsEl.children];
    let timers = [], visible = false;
    const stop = () => { timers.forEach(clearTimeout); timers = []; };

    const showFixed = () => {
        panel.classList.add('fixed');
        dots.forEach(d => d.classList.add('on'));
        code.textContent = "$posts = Post::with('author')->get();";
        count.textContent = '2 queries';
    };
    // One pass: queries pile up slowly (~3s), the problem sits there for a beat, the fix lands and is
    // held long enough to read — then it starts again, for as long as the panel is on screen.
    function play() {
        stop();
        panel.classList.remove('fixed');
        dots.forEach(d => d.classList.remove('on'));
        code.innerHTML = before;
        count.textContent = '0 queries';
        if (!motionOK()) { showFixed(); return; }
        const STEP = 70, START = 600;
        dots.forEach((d, i) => timers.push(setTimeout(() => {
            d.classList.add('on');
            count.textContent = Math.round((i + 1) / DOTS * QUERIES) + ' queries';
        }, START + i * STEP)));
        const fixAt = START + DOTS * STEP + 1500;
        timers.push(setTimeout(showFixed, fixAt));
        timers.push(setTimeout(() => { if (visible) play(); }, fixAt + 4500));
    }
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) play();
        else { stop(); showFixed(); }          // off screen: no timers running, resting on the answer
    }, { threshold: 0.5 }).observe(panel);
    document.getElementById('np-replay').addEventListener('click', play);
})();

// ============================================
// `php artisan migrate` (Skills): each category card appears as its migration line ticks DONE
// ============================================
(function initMigrateLog() {
    const log = document.getElementById('migrate-log');
    const cards = [...document.querySelectorAll('.skill-category')];
    if (!log || !cards.length) return;
    const row = html => { const d = document.createElement('div'); d.innerHTML = html; log.appendChild(d); return d; };
    const rows = [row('<span class="ml-cmd"><b>$</b> php artisan migrate</span>')];
    cards.forEach(card => {
        revealObserver.unobserve(card);                       // this sequence reveals them instead
        const name = 'create_' + card.dataset.category.replace(/[^a-z0-9]+/g, '_') + '_skills';
        rows.push(row(`<span class="ml-pre">Migrating:</span><span class="ml-name">${name}</span><span class="ml-dots"></span><span class="ml-done">DONE</span>`));
    });
    const total = document.querySelectorAll('.skill-tag').length;
    rows.push(row(`<span class="ml-pre">Migrated:</span><span class="ml-name">${cards.length} tables, ${total} skills</span>`));

    let timers = [], visible = false, revealed = false;
    const stop = () => { timers.forEach(clearTimeout); timers = []; };
    const finish = () => { rows.forEach(r => r.classList.add('in')); cards.forEach(c => c.classList.add('revealed')); revealed = true; };

    function run() {
        stop();
        if (!motionOK()) { finish(); return; }
        const GAP = 480;
        rows.forEach(r => r.classList.remove('in'));
        rows.forEach((r, i) => timers.push(setTimeout(() => {
            r.classList.add('in');
            if (!revealed && i >= 1 && i <= cards.length) cards[i - 1].classList.add('revealed');
            if (i === rows.length - 1) revealed = true;
        }, 500 + i * GAP)));
        timers.push(setTimeout(() => { if (visible) run(); }, 500 + rows.length * GAP + 4500));   // hold, then migrate again
    }
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) run();
        else { stop(); finish(); }
    }, { threshold: 0.4 }).observe(log);
})();

// ============================================
// TALK DEMOS — one scripted panel per talk card. Each runs slowly (~15s), holds, and loops while at
// least half of it is on screen; off screen it clears its timers and rests on the final state that is
// already in the HTML. Numbers are illustrative.
// ============================================
(function initTalkDemos() {
    const GREEN = '#22c55e', AMBER = '#eab308', RED = '#ef4444', GREY = 'var(--text-3)';

    function talkDemo(kind, script) {
        const root = document.querySelector(`.talk-demo[data-demo="${kind}"]`);
        if (!root) return;
        const finalHTML = root.innerHTML, finalClass = root.className;      // the no-JS / resting state
        let timers = [], visible = false;
        const stop = () => { timers.forEach(clearTimeout); timers = []; };
        const rest = () => { stop(); root.innerHTML = finalHTML; root.className = finalClass; };

        const api = {
            at: (ms, fn) => timers.push(setTimeout(fn, ms)),
            say: text => { root.querySelector('.qd-note-text').textContent = text; },
            request: () => { root.classList.add('s-req'); },
            pill: (text, tone) => { const p = root.querySelector('.qd-res'); p.textContent = text; p.className = 'qd-res' + (tone ? ' ' + tone : ''); root.classList.add('s-res'); },
            // row(i, {name, label, color, fill 0..1, dur ms}) — dur is how long the bar takes to reach `fill`
            row: (i, { name, label = '', color = GREY, fill = 0, dur = 400 }) => {
                const r = root.querySelectorAll('.qd-jobs li')[i];
                if (name) r.querySelector('.qd-name').textContent = name;
                r.querySelector('.qd-state').textContent = label;
                r.style.setProperty('--c', color); r.style.setProperty('--dur', dur + 'ms'); r.style.setProperty('--fill', fill);
                r.classList.add('in');
            },
        };

        function play() {
            rest();
            if (!motionOK()) return;
            root.className = 'talk-demo';
            root.querySelectorAll('.qd-jobs li').forEach(li => { li.className = ''; li.style.setProperty('--fill', 0); li.style.setProperty('--dur', '0ms'); li.querySelector('.qd-state').textContent = ''; });
            const length = script(api);
            api.at(length + 5000, () => { if (visible) play(); });
        }
        new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible) play(); else rest();
        }, { threshold: 0.5 }).observe(root);
    }

    // Queues: the response is instant; the slow work happens after, on two workers, and a failure is retried
    talkDemo('queue', d => {
        d.request(); d.say('customer clicks “Place order”…');
        d.at(1300,  () => { d.pill('200 OK · 120 ms'); d.say('Response sent. The customer is already done.'); });
        d.at(3000,  () => { d.say('Meanwhile, 3 jobs were pushed to the queue:'); d.row(0, { label: 'queued' }); });
        d.at(3450,  () => d.row(1, { label: 'queued' }));
        d.at(3900,  () => d.row(2, { label: 'queued' }));
        d.at(5400,  () => { d.say('Two workers pick up the first two jobs.'); d.row(0, { label: 'processing', color: AMBER, fill: 1, dur: 4000 }); d.row(1, { label: 'processing', color: AMBER, fill: 1, dur: 2400 }); });
        d.at(7900,  () => { d.row(1, { label: '✓ done', color: GREEN, fill: 1 }); d.row(0, { label: '✗ SMTP timeout', color: RED, fill: 0.62 }); d.say('The email fails. No customer ever sees this error.'); });
        d.at(8500,  () => d.row(2, { label: 'processing', color: AMBER, fill: 1, dur: 2400 }));
        d.at(10300, () => { d.row(0, { label: 'retry 2/3', color: AMBER, fill: 0, dur: 500 }); d.say('It is retried automatically, with backoff.'); });
        d.at(11000, () => d.row(2, { label: '✓ done', color: GREEN, fill: 1 }));
        d.at(12000, () => d.row(0, { label: 'processing', color: AMBER, fill: 1, dur: 2400 }));
        d.at(14500, () => { d.row(0, { label: '✓ done', color: GREEN, fill: 1 }); d.say('All done. Response time stayed 120 ms throughout.'); });
        return 14500;
    });

    // Redis: the first request pays for the query, the rest are served from memory; an update invalidates it
    talkDemo('redis', d => {
        d.request(); d.pill('cache: empty', 'idle'); d.say('First visitor asks for the product list…');
        d.at(1500,  () => { d.row(0, { label: 'MISS → MySQL', color: AMBER, fill: 1, dur: 2600 }); d.say('Not in Redis yet, so MySQL runs the heavy query.'); });
        d.at(4200,  () => { d.row(0, { label: 'MISS · 480 ms', color: RED, fill: 1 }); d.pill('cache: warm'); d.say('The result is stored in Redis for an hour.'); });
        d.at(6200,  () => { d.row(1, { label: 'HIT · 4 ms', color: GREEN, fill: 0.04, dur: 150 }); d.say('Next visitor: served straight from memory.'); });
        d.at(8000,  () => d.row(2, { label: 'HIT · 3 ms', color: GREEN, fill: 0.03, dur: 150 }));
        d.at(9200,  () => d.say('Same data, over 100× faster. MySQL did the work once.'));
        d.at(11500, () => { d.pill('Cache::forget', 'bad'); d.say('A product is edited → its cache key is cleared…'); });
        d.at(13500, () => { d.pill('cache: warm'); d.say('…and rebuilt on the next request. Never stale, still fast.'); });
        return 13500;
    });

    // Monitoring: measure where the time goes, fix the biggest bar, measure again
    talkDemo('perf', d => {
        d.request(); d.pill('p95 2.4 s', 'bad'); d.say('Users say the dashboard is slow. Guessing is not a plan.');
        d.at(2200,  () => { d.say('Profile it: where does 2.4 s actually go?'); d.row(0, { name: 'SQL · 187 queries', label: '1.9 s', color: RED, fill: 0.8, dur: 2200 }); });
        d.at(3200,  () => d.row(1, { name: 'PHP · app code', label: '320 ms', color: AMBER, fill: 0.13, dur: 700 }));
        d.at(3900,  () => d.row(2, { name: 'Redis · cache', label: '40 ms', color: GREEN, fill: 0.02, dur: 300 }));
        d.at(6000,  () => d.say('187 queries for one page: an N+1 and a missing index.'));
        d.at(9000,  () => { d.say('Fix the biggest bar: eager loading + one index.'); d.row(0, { name: 'SQL · 6 queries', label: '90 ms', color: GREEN, fill: 0.05, dur: 1800 }); });
        d.at(11200, () => d.row(1, { name: 'PHP · app code', label: '180 ms', color: GREEN, fill: 0.09, dur: 900 }));
        d.at(12600, () => { d.pill('p95 310 ms'); d.say('Measure again: 2.4 s → 310 ms. Then keep watching it.'); });
        return 12600;
    });

    // Observers: the controller stays one line; the model's side effects live in one class
    talkDemo('observer', d => {
        d.request(); d.say('The controller does one thing: mark the order shipped.');
        d.at(2000,  () => { d.pill('updated event'); d.say('Eloquent fires “updated”. OrderObserver is listening.'); });
        d.at(4300,  () => { d.say('The observer runs every side effect, in one place:'); d.row(0, { label: 'running', color: AMBER, fill: 1, dur: 1500 }); });
        d.at(5900,  () => { d.row(0, { label: '✓ queued', color: GREEN, fill: 1 }); d.row(1, { label: 'running', color: AMBER, fill: 1, dur: 1500 }); });
        d.at(7500,  () => { d.row(1, { label: '✓ saved', color: GREEN, fill: 1 }); d.row(2, { label: 'running', color: AMBER, fill: 1, dur: 1500 }); });
        d.at(9100,  () => d.row(2, { label: '✓ cleared', color: GREEN, fill: 1 }));
        d.at(10400, () => d.say('Ship it from the API, a job or tinker: same result.'));
        d.at(13000, () => d.say('The controller stayed one line. Side effects live in one place.'));
        return 13000;
    });
})();

// ============================================
// PRINT AS RÉSUMÉ
// ============================================
const printBtn = document.getElementById('print-cv');
if (printBtn) printBtn.addEventListener('click', () => {
    if (!motionOK() || printBtn.dataset.printing === '1') { window.print(); return; }
    printBtn.dataset.printing = '1';
    const r = printBtn.getBoundingClientRect();
    const sheet = document.createElement('div');
    sheet.className = 'print-sheet';
    sheet.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
    sheet.style.left = (r.left + r.width / 2) + 'px';
    sheet.style.top  = (r.bottom - 8) + 'px';   // feeds downward, into the empty space under the button
    document.body.appendChild(sheet);
    setTimeout(() => {
        sheet.remove();
        printBtn.dataset.printing = '0';
        window.print();
    }, 1050);
});

// ============================================
// CONSOLE
// ============================================
console.log('%c👋 Hello, Developer!', 'font-size:18px;font-weight:bold;color:#FF2D20;');
console.log('%cnainesh.dev — Built with vanilla HTML, CSS & JS', 'font-size:13px;color:#A1A1AA;');

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { debounce, animateCounter };
}

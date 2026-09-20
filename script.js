// ============================================
// THEME TOGGLE
// ============================================
const themeToggle = document.getElementById('theme-toggle');
const htmlElement = document.documentElement;

let savedTheme;
try { savedTheme = localStorage.getItem('theme'); } catch (e) { savedTheme = null; }
const currentTheme = savedTheme ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
htmlElement.setAttribute('data-theme', currentTheme);

themeToggle.addEventListener('click', () => {
    const t = htmlElement.getAttribute('data-theme');
    const next = t === 'dark' ? 'light' : 'dark';
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

    // The new theme spreads out from the button like a light being switched on
    const r = themeToggle.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    htmlElement.classList.add('theme-reveal');
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
        htmlElement.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration: 520, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
        );
    }).catch(() => {});
    vt.finished.finally(() => htmlElement.classList.remove('theme-reveal'));
});

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
            ctx.save();
            // phones have no empty margin: the words drift across the copy, so keep them as faint texture only
            ctx.globalAlpha = (dark ? this.opa : this.opa * 1.5) * (W <= 768 ? 0.3 : 1); // dark 0.22–0.40, light 0.33–0.60
            ctx.fillStyle   = dark ? '#FF2D20' : '#8B1A0E';
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
// QUEUE DEMO (Queues talk card): a checkout returns in 120ms; the email, invoice and inventory jobs run
// afterwards on two workers, and the email fails once and is retried. Loops slowly while on screen.
// ============================================
(function initQueueDemo() {
    const demo = document.getElementById('queue-demo');
    if (!demo) return;
    const note = document.getElementById('qd-note');
    const jobs = [...demo.querySelectorAll('.qd-jobs li')].map(li => ({ li, state: li.querySelector('.qd-state') }));
    const [email, invoice, inventory] = jobs;
    let timers = [], visible = false;
    const stop = () => { timers.forEach(clearTimeout); timers = []; };
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const set = (job, cls, label) => { job.li.className = 'in ' + cls; job.state.textContent = label; };
    const say = text => { note.textContent = text; };

    const finalState = () => {
        demo.className = 'queue-demo s-res';
        jobs.forEach(j => set(j, 'done', '✓ done'));
        say('Customer saw success in 120 ms. The slow work ran after.');
    };

    function play() {
        stop();
        if (!motionOK()) { finalState(); return; }
        demo.className = 'queue-demo s-req';
        jobs.forEach(j => { j.li.className = ''; j.state.textContent = ''; });
        say('customer clicks “Place order”…');

        at(1300,  () => { demo.classList.add('s-res'); say('Response sent. The customer is already done.'); });
        at(3000,  () => { say('Meanwhile, 3 jobs were pushed to the queue:'); set(email, 'queued', 'queued'); });
        at(3450,  () => set(invoice, 'queued', 'queued'));
        at(3900,  () => set(inventory, 'queued', 'queued'));
        // two workers: the first two jobs start together, the third waits for a free worker
        at(5400,  () => { say('Two workers pick up the first two jobs.'); set(email, 'processing', 'processing'); set(invoice, 'processing', 'processing'); });
        at(7900,  () => { set(invoice, 'done', '✓ done'); set(email, 'failed', '✗ SMTP timeout'); say('The email fails. No customer ever sees this error.'); });
        at(8500,  () => set(inventory, 'processing', 'processing'));
        at(10300, () => { set(email, 'retry', 'retry 2/3'); say('It is retried automatically, with backoff.'); });
        at(11000, () => set(inventory, 'done', '✓ done'));
        at(12000, () => set(email, 'processing', 'processing'));
        at(14500, () => { set(email, 'done', '✓ done'); say('All done. Response time stayed 120 ms throughout.'); });
        at(19500, () => { if (visible) play(); });
    }

    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) play();
        else { stop(); finalState(); }
    }, { threshold: 0.5 }).observe(demo);
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

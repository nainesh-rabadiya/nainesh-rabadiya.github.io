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
    htmlElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) { /* unavailable */ }
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

function updateProgress() {
    const scrolled  = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrolled / docHeight) * 100 : 0;
    progressBar.style.width = pct + '%';
}
window.addEventListener('scroll', updateProgress, { passive: true });

// ============================================
// NAVIGATION
// ============================================
const navbar   = document.getElementById('navbar');
const navToggle = document.getElementById('nav-toggle');
const navMenu  = document.getElementById('nav-menu');
const navLinks = document.querySelectorAll('.nav-link');

navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    navToggle.classList.toggle('active');
});

navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
    });
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

const updateActiveLink = id => {
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
            if (num && !num.classList.contains('animated')) {
                num.classList.add('animated');
                animateCounter(num, num.textContent.trim(), 2000);
            }
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('.bento-item').forEach(c => statsObserver.observe(c));

// ============================================
// SKILL CATEGORY TABS
// ============================================
const skillTabs = document.querySelectorAll('.skill-tab');
const skillCategories = document.querySelectorAll('.skill-category');

skillTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;

        skillTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

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

backToTop.addEventListener('click', () => {
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
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
        navToggle.focus();
    }
});

navToggle.addEventListener('click', () => {
    if (navMenu.classList.contains('active')) {
        setTimeout(() => navMenu.querySelector('.nav-link')?.focus(), 80);
    }
});

// ============================================
// HERO CANVAS — binary rain (Matrix style)
// ============================================
function initHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx    = canvas.getContext('2d');
    const isDark = () => document.documentElement.getAttribute('data-theme') !== 'light';

    const FONT_SIZE = 13;
    let W, H, cols, drops;

    function resize() {
        W    = canvas.width  = canvas.offsetWidth;
        H    = canvas.height = canvas.offsetHeight;
        cols = Math.floor(W / FONT_SIZE);
        // spread drops randomly across the full height on init
        if (!drops) drops = Array.from({ length: cols }, () => Math.random() * (H / FONT_SIZE));
        // keep existing drop positions but clamp to new col count
        else {
            while (drops.length < cols) drops.push(Math.random() * (H / FONT_SIZE));
            drops.length = cols;
        }
    }

    let raf;

    function draw() {
        // semi-transparent overlay creates the fading trail
        ctx.fillStyle = isDark()
            ? 'rgba(9, 9, 11, 0.055)'
            : 'rgba(250, 250, 250, 0.055)';
        ctx.fillRect(0, 0, W, H);

        ctx.font = `${FONT_SIZE}px "Fira Code", monospace`;

        for (let i = 0; i < cols; i++) {
            const char = Math.random() > 0.5 ? '1' : '0';
            const x    = i * FONT_SIZE;
            const y    = drops[i] * FONT_SIZE;

            // occasional bright "head" character
            const isHead = Math.random() > 0.92;
            ctx.fillStyle = isDark()
                ? (isHead ? 'rgba(255,100,80,0.85)' : 'rgba(255,45,32,0.18)')
                : (isHead ? 'rgba(150,20,10,0.75)'  : 'rgba(120,20,10,0.14)');

            ctx.fillText(char, x, y);

            // reset column to top randomly after passing bottom
            if (y > H && Math.random() > 0.975) drops[i] = 0;
            else drops[i] += 0.45; // slow fall speed
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) cancelAnimationFrame(raf);
        else raf = requestAnimationFrame(loop);
    });

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas.parentElement);

    function loop() { draw(); raf = requestAnimationFrame(loop); }

    resize();
    loop();
}

// ============================================
// HERO TYPING — cycles through roles
// ============================================
function initHeroTyping() {
    const el = document.getElementById('typing-text');
    if (!el) return;

    const roles = [
        'Technical Lead & Laravel Expert',
        '13+ Years Engineering Experience',
        'Conference Speaker & Mentor',
        'Performance Optimization Specialist',
        'Open Source Contributor'
    ];

    let ri = 0, ci = 0, deleting = false;
    const WRITE = 70, DELETE = 35, PAUSE = 2200, GAP = 500;

    function tick() {
        const role = roles[ri];
        if (deleting) {
            ci--;
            el.textContent = role.slice(0, ci);
            if (ci === 0) {
                deleting = false;
                ri = (ri + 1) % roles.length;
                setTimeout(tick, GAP);
                return;
            }
            setTimeout(tick, DELETE);
        } else {
            ci++;
            el.textContent = role.slice(0, ci);
            if (ci === role.length) {
                deleting = true;
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
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
    initHeroCanvas();
    initHeroTyping();
});

// ============================================
// DYNAMIC COPYRIGHT YEAR
// ============================================
const footer = document.querySelector('.footer p');
if (footer) footer.textContent = footer.textContent.replace(/\d{4}/, new Date().getFullYear());

// ============================================
// CONSOLE
// ============================================
console.log('%c👋 Hello, Developer!', 'font-size:18px;font-weight:bold;color:#FF2D20;');
console.log('%cnainesh.dev — Built with vanilla HTML, CSS & JS', 'font-size:13px;color:#A1A1AA;');

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { debounce, animateCounter };
}

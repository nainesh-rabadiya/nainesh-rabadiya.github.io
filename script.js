// ============================================
// THEME TOGGLE FUNCTIONALITY
// ============================================
const themeToggle = document.getElementById('theme-toggle');
const htmlElement = document.documentElement;

// Check for saved theme preference, fall back to OS preference, then 'light'
let savedTheme;
try {
    savedTheme = localStorage.getItem('theme');
} catch (e) {
    savedTheme = null;
}
const currentTheme = savedTheme ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
htmlElement.setAttribute('data-theme', currentTheme);

// Theme toggle event listener
themeToggle.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    htmlElement.setAttribute('data-theme', newTheme);
    try {
        localStorage.setItem('theme', newTheme);
    } catch (e) {
        // localStorage unavailable, continue without persisting
    }
});

// ============================================
// NAVIGATION FUNCTIONALITY
// ============================================
// PORTFOLIO WEBSITE - INTERACTIVE FEATURES
// ============================================

// ============================================
// NAVIGATION
// ============================================

// Get DOM elements
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');
const navLinks = document.querySelectorAll('.nav-link');

// Mobile menu toggle
navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    navToggle.classList.toggle('active');
});

// Close mobile menu when clicking a link
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
    });
});

// Navbar scroll effect
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;

    // Add scrolled class for styling
    if (currentScroll > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
});

// ============================================
// ACTIVE NAVIGATION HIGHLIGHTING
// ============================================

// Highlight active section in navigation
const sections = document.querySelectorAll('.section');

const highlightNavigation = () => {
    const scrollPosition = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    // Check if we've reached the bottom of the page
    if (Math.ceil(scrollPosition + windowHeight) >= documentHeight - 50) {
        // Find the last section (usually Contact)
        const lastSection = sections[sections.length - 1];
        if (lastSection) {
            const lastSectionId = lastSection.getAttribute('id');
            updateActiveLink(lastSectionId);
            return;
        }
    }

    // Normal section detection
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 150; // Offset for navbar + breathing room
        const sectionHeight = section.offsetHeight;
        const sectionId = section.getAttribute('id');

        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            updateActiveLink(sectionId);
        }
    });
};

const updateActiveLink = (id) => {
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
        }
    });
};

window.addEventListener('scroll', highlightNavigation);

// ============================================
// SMOOTH SCROLLING
// ============================================

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        const targetId = this.getAttribute('href');
        if (targetId === '#') return;

        const targetSection = document.querySelector(targetId);

        if (targetSection) {
            const navbarHeight = navbar.offsetHeight;
            const targetPosition = targetSection.offsetTop - navbarHeight;

            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ============================================
// SCROLL REVEAL ANIMATIONS
// ============================================

// Intersection Observer for scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            // Optionally unobserve after revealing
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe all elements with scroll-reveal class
const revealElements = document.querySelectorAll('.scroll-reveal');
revealElements.forEach(element => {
    observer.observe(element);
});

// ============================================
// STATS COUNTER ANIMATION
// ============================================

// Animate numbers in stats section
const animateCounter = (element, target, duration = 2000) => {
    // Extract numeric value, handling emoji prefixes like "⏱️ 12+"
    const numMatch = target.match(/(\d+)/);
    if (!numMatch) return;

    const numericTarget = parseInt(numMatch[1]);
    const hasPlus = target.includes('+');
    const prefix = target.substring(0, target.indexOf(numMatch[0]));

    let current = 0;
    const increment = numericTarget / (duration / 16);

    const updateCounter = () => {
        current += increment;
        if (current < numericTarget) {
            element.textContent = prefix + Math.floor(current) + (hasPlus ? '+' : '');
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = target;
        }
    };

    updateCounter();
};

// Observe stats for animation
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statNumber = entry.target.querySelector('.stat-number');
            if (statNumber && !statNumber.classList.contains('animated')) {
                const targetValue = statNumber.textContent;
                statNumber.classList.add('animated');
                animateCounter(statNumber, targetValue, 2000);
            }
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const statCards = document.querySelectorAll('.stat-card');
statCards.forEach(card => {
    statsObserver.observe(card);
});

// ============================================
// CARD HOVER EFFECTS
// ============================================

// Enhanced card interactions
const cards = document.querySelectorAll('.card');

cards.forEach(card => {
    card.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-5px)';
    });

    card.addEventListener('mouseleave', function () {
        this.style.transform = 'translateY(0)';
    });
});

// ============================================
// SKILL TAG INTERACTIONS
// ============================================

// Add click interaction to skill tags (optional)
const skillTags = document.querySelectorAll('.skill-tag');

skillTags.forEach(tag => {
    tag.addEventListener('click', function () {
        // Optional: Add functionality like filtering projects by skill
    });
});

// ============================================
// CONTACT LINK TRACKING
// ============================================

// Track contact link clicks (for analytics)
const contactLinks = document.querySelectorAll('.contact-link');

contactLinks.forEach(link => {
    link.addEventListener('click', function () {
        const linkType = this.id.replace('-link', '');
        if (typeof gtag === 'function') {
            gtag('event', 'contact_click', {
                event_category: 'engagement',
                event_label: linkType
            });
        }
    });
});

// ============================================
// PERFORMANCE OPTIMIZATIONS
// ============================================

// Debounce function for scroll events
function debounce(func, wait = 10) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Apply debounce to scroll handlers
const debouncedHighlightNav = debounce(highlightNavigation, 10);
window.removeEventListener('scroll', highlightNavigation);
window.addEventListener('scroll', debouncedHighlightNav);

// ============================================
// ACCESSIBILITY ENHANCEMENTS
// ============================================

// Keyboard navigation support
document.addEventListener('keydown', (e) => {
    // Close mobile menu with Escape key
    if (e.key === 'Escape' && navMenu.classList.contains('active')) {
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
    }
});

// Focus management for mobile menu
navToggle.addEventListener('click', () => {
    if (navMenu.classList.contains('active')) {
        // Focus first menu item when opening
        setTimeout(() => {
            const firstLink = navMenu.querySelector('.nav-link');
            if (firstLink) firstLink.focus();
        }, 100);
    }
});

// ============================================
// LOADING ANIMATIONS
// ============================================

// Add loaded class to body when page is fully loaded
window.addEventListener('load', () => {
    document.body.classList.add('loaded');

    // Trigger initial animations
    setTimeout(() => {
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) {
            heroContent.style.opacity = '1';
            heroContent.style.transform = 'translateY(0)';
        }
    }, 100);
});

// ============================================
// DYNAMIC YEAR UPDATE
// ============================================

// Update copyright year automatically
const updateCopyrightYear = () => {
    const footer = document.querySelector('.footer p');
    if (footer) {
        const currentYear = new Date().getFullYear();
        footer.textContent = footer.textContent.replace(/\d{4}/, currentYear);
    }
};

updateCopyrightYear();

// ============================================
// CONSOLE MESSAGE
// ============================================

// Fun console message for developers
console.log('%c👋 Hello, Developer!', 'font-size: 20px; font-weight: bold; color: #FF2D20;');
console.log('%cInterested in the code? Check out the repository!', 'font-size: 14px; color: #B4B8D0;');
console.log('%cBuilt with ❤️ using HTML, CSS, and Vanilla JavaScript', 'font-size: 12px; color: #6B7280;');

// ============================================
// EXPORT FOR TESTING (if needed)
// ============================================

// Export functions for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        debounce,
        animateCounter
    };
}

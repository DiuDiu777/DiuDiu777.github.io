/**
 * Academic Homepage Interactive Effects
 * - Typewriter effect for hero title
 * - Scroll reveal animations
 * - 3D flip card interactions
 */
(function () {
  // =========================================================================
  // Typewriter Effect
  // =========================================================================

  function initTypewriter() {
    const el = document.getElementById('typewriter-text');
    if (!el) return;

    const texts = JSON.parse(el.getAttribute('data-texts') || '[]');
    if (!texts.length) return;

    const cursor = el.querySelector('.cursor');
    let textIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let isPaused = false;

    function type() {
      const currentText = texts[textIndex];

      if (isPaused) {
        // Pause at full text before deleting
        setTimeout(() => {
          isPaused = false;
          isDeleting = true;
          type();
        }, 2000);
        return;
      }

      if (isDeleting) {
        el.innerHTML =
          currentText.substring(0, charIndex - 1) +
          '<span class="cursor"></span>';
        charIndex--;

        if (charIndex === 0) {
          isDeleting = false;
          textIndex = (textIndex + 1) % texts.length;
        }
        setTimeout(type, 40);
      } else {
        el.innerHTML =
          currentText.substring(0, charIndex + 1) +
          '<span class="cursor"></span>';
        charIndex++;

        if (charIndex === currentText.length) {
          isPaused = true;
          setTimeout(type, 2000);
        } else {
          setTimeout(type, 60 + Math.random() * 40);
        }
      }
    }

    // Start after a short delay
    setTimeout(type, 500);
  }

  // =========================================================================
  // Scroll Reveal Animation with Intersection Observer
  // =========================================================================

  function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal, .reveal-stagger');

    if (!revealElements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // Don't unobserve stagger containers so children animate on re-entry
            if (!entry.target.classList.contains('reveal-stagger')) {
              observer.unobserve(entry.target);
            }
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    revealElements.forEach((el) => observer.observe(el));
  }

  // =========================================================================
  // Smooth scroll for anchor links
  // =========================================================================

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // =========================================================================
  // Initialize all effects
  // =========================================================================

  function init() {
    initTypewriter();
    initScrollReveal();
    initSmoothScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/**
 * Particle Network Background
 * Canvas-based animated particle system with mouse interaction
 * Medium density: 100 particles, responsive to theme changes
 */
(function () {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Configuration
  const PARTICLE_COUNT = 100;
  const CONNECTION_DISTANCE = 100;
  const MOUSE_RADIUS = 150;
  const MOUSE_FORCE = 0.03;

  // State
  let particles = [];
  let mouse = { x: -1000, y: -1000 };
  let animationId;
  let width, height;

  // Resize handler
  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }

  // Get current theme color
  function getParticleColor() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      particle: isDark
        ? 'rgba(148, 163, 184, 0.5)'
        : 'rgba(79, 70, 229, 0.5)',
      line: isDark
        ? 'rgba(148, 163, 184, 0.08)'
        : 'rgba(79, 70, 229, 0.1)',
    };
  }

  // Particle class
  class Particle {
    constructor() {
      this.reset();
      // Random initial position so they don't all start at (0,0)
      this.x = Math.random() * width;
      this.y = Math.random() * height;
    }

    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = (Math.random() - 0.5) * 0.5;
      this.radius = Math.random() * 2 + 1;
    }

    update() {
      // Mouse interaction
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < MOUSE_RADIUS) {
        const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
        this.vx -= (dx / dist) * force * MOUSE_FORCE;
        this.vy -= (dy / dist) * force * MOUSE_FORCE;
      }

      // Apply velocity
      this.x += this.vx;
      this.y += this.vy;

      // Damping
      this.vx *= 0.99;
      this.vy *= 0.99;

      // Wrap around edges
      if (this.x < -10) this.x = width + 10;
      if (this.x > width + 10) this.x = -10;
      if (this.y < -10) this.y = height + 10;
      if (this.y > height + 10) this.y = -10;
    }

    draw(ctx, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Initialize particles
  function initParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new Particle());
    }
  }

  // Animation loop
  function animate() {
    ctx.clearRect(0, 0, width, height);

    const colors = getParticleColor();

    // Update and draw particles
    for (const p of particles) {
      p.update();
      p.draw(ctx, colors.particle);
    }

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONNECTION_DISTANCE) {
          const opacity = (1 - dist / CONNECTION_DISTANCE) * 0.5;
          ctx.strokeStyle = colors.line.replace('0.1', opacity.toFixed(2));
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    animationId = requestAnimationFrame(animate);
  }

  // Event listeners
  function onMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }

  function onTouchMove(e) {
    if (e.touches.length > 0) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
    }
  }

  function onMouseLeave() {
    mouse.x = -1000;
    mouse.y = -1000;
  }

  // Watch for theme changes to update particle colors
  function onThemeChange() {
    // Colors update on next frame automatically via getParticleColor()
  }

  // Initialize
  function init() {
    resize();
    initParticles();
    animate();

    window.addEventListener('resize', () => {
      resize();
      initParticles();
    });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);

    // Observe theme changes
    const observer = new MutationObserver(onThemeChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

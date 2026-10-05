import * as THREE from "three";
import Lenis from "lenis";

export function setupSiteEffects(root) {
  const cleanups = [];

  // Global premium smooth scrolling. This runs outside React's render cycle,
  // so scroll frames never trigger React re-renders.
  const lenis = new Lenis({
    duration: 1.65,
    smoothWheel: true,
    wheelMultiplier: 0.8,
    touchMultiplier: 1,
    anchors: true,
    autoRaf: false,
    easing: (t) => 1 - Math.pow(1 - t, 4),
  });

  document.documentElement.classList.add("lenis", "lenis-smooth");

  let lenisRafId;
  const lenisRaf = (time) => {
    lenis.raf(time);
    lenisRafId = window.requestAnimationFrame(lenisRaf);
  };
  lenisRafId = window.requestAnimationFrame(lenisRaf);

  cleanups.push(() => {
    window.cancelAnimationFrame(lenisRafId);
    lenis.destroy();
    document.documentElement.classList.remove("lenis", "lenis-smooth");
  });

  // Global scroll progress. It is compositor-friendly and never triggers React renders.
  const progress = document.createElement("div");
  progress.className = "tbm-scroll-progress";
  progress.innerHTML = "<span></span>";
  document.body.appendChild(progress);
  const progressBar = progress.firstElementChild;
  const updateProgress = ({ scroll }) => {
    const limit = Math.max(1, lenis.limit || document.documentElement.scrollHeight - window.innerHeight);
    progressBar.style.transform = `scaleX(${Math.min(1, Math.max(0, scroll / limit))})`;
  };
  lenis.on("scroll", updateProgress);
  updateProgress({ scroll: window.scrollY });
  cleanups.push(() => { lenis.off("scroll", updateProgress); progress.remove(); });

  // Continuous service marquee: duplicate each track once so the loop
  // is mathematically seamless instead of visibly jumping at the reset point.
  const marqueeTracks = [...root.querySelectorAll(".service-marquee-track")];
  marqueeTracks.forEach((track) => {
    if (track.dataset.loopReady === "true") return;
    const original = [...track.children].map((node) => node.cloneNode(true));
    original.forEach((node) => track.appendChild(node));
    track.dataset.loopReady = "true";
  });

  // Universal section reveals. Every page gets the same calm, editorial entrance language.
  const revealSelector = [
    ".site-content section:not(.hero-reference):not(.contact-hero):not(.social-detail-hero)",
    ".site-content .service-card", ".site-content .social-service-card",
    ".site-content .social-process-card", ".site-content .social-benefit-card",
    ".site-content .social-stat-grid article", ".site-content .social-faq-item",
    ".site-content .about-pillar-card", ".site-content .about-stat-card",
    ".site-content .about-logo-card", ".site-content .contact-info-card",
    ".site-content .inquiry-section", ".site-content .contact-map-section > *",
    ".site-content footer"
  ].join(",");
  const revealItems = [...root.querySelectorAll(revealSelector)];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealObserver = !reducedMotion && "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("tbm-reveal-in");
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: "0px 0px -7% 0px" })
    : null;
  revealItems.forEach((item, index) => {
    item.classList.add("tbm-reveal");
    if (index < 3) item.classList.add(`tbm-reveal-delay-${index}`);
    revealObserver?.observe(item);
    if (!revealObserver) item.classList.add("tbm-reveal-in");
  });
  cleanups.push(() => revealObserver?.disconnect());

  // Stagger direct card children when a grid enters view.
  const revealGrids = [...root.querySelectorAll(".grid, .social-services-grid, .social-process-grid, .social-benefit-grid, .social-stat-grid")];
  revealGrids.forEach((grid) => {
    [...grid.children].forEach((child, index) => {
      child.style.setProperty("--tbm-stagger", `${Math.min(index * 70, 420)}ms`);
    });
  });

  // Subtle magnetic response for primary CTAs. Disabled for touch/reduced motion.
  const magneticTargets = reducedMotion ? [] : [...root.querySelectorAll(".contact-primary-btn, .hero-liquid-button, .service-round-cta, .contact-round-cta, .contact-submit, .social-mini-form button")];
  const magneticCleanups = [];
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    magneticTargets.forEach((el) => {
      const move = (event) => {
        const r = el.getBoundingClientRect();
        const x = ((event.clientX - r.left) / r.width - .5) * 10;
        const y = ((event.clientY - r.top) / r.height - .5) * 10;
        el.style.setProperty("--mag-x", `${x}px`);
        el.style.setProperty("--mag-y", `${y}px`);
      };
      const leave = () => { el.style.setProperty("--mag-x", "0px"); el.style.setProperty("--mag-y", "0px"); };
      el.addEventListener("mousemove", move, { passive: true });
      el.addEventListener("mouseleave", leave);
      magneticCleanups.push(() => { el.removeEventListener("mousemove", move); el.removeEventListener("mouseleave", leave); });
    });
  }
  cleanups.push(() => magneticCleanups.forEach((fn) => fn()));

  // Premium magnifying cursor: keep the real browser pointer visible while a
  // glass lens sits directly on that exact point. The lens contains a scaled
  // copy of the element under the pointer, so the character beneath the
  // pointer is the character shown enlarged inside the glass.
  const cursorLens = document.createElement("div");
  cursorLens.className = "tbm-cursor-lens";
  cursorLens.setAttribute("aria-hidden", "true");
  const cursorLensContent = document.createElement("div");
  cursorLensContent.className = "tbm-cursor-lens-content";
  cursorLens.appendChild(cursorLensContent);
  document.body.appendChild(cursorLens);

  let cursorX = window.innerWidth / 2;
  let cursorY = window.innerHeight / 2;
  let activeZoomTarget = null;
  let lastZoomKey = "";
  const zoomScale = 1.75;
  const lensSize = 94;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  const getZoomTarget = (element) => {
    if (!element || !(element instanceof Element)) return null;
    return element.closest(
      "h1, h2, h3, h4, h5, h6, p, a, button, blockquote, li, .service-marquee span, .process-number, .kicker"
    );
  };

  const clearLens = () => {
    activeZoomTarget = null;
    lastZoomKey = "";
    cursorLens.classList.remove("is-visible");
    cursorLensContent.replaceChildren();
  };

  const updateLens = (event) => {
    cursorX = event.clientX;
    cursorY = event.clientY;

    // The glass is centered exactly on the real pointer. This removes the
    // previous visual offset that made the magnified character feel wrong.
    cursorLens.style.transform = `translate3d(${cursorX - lensSize / 2}px, ${cursorY - lensSize / 2}px, 0)`;

    if (!finePointer.matches) return;

    const element = document.elementFromPoint(cursorX, cursorY);
    const target = getZoomTarget(element);
    if (!target || cursorLens.contains(target)) {
      clearLens();
      return;
    }

    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      clearLens();
      return;
    }

    const key = `${target.tagName}-${target.textContent}-${Math.round(rect.width)}-${Math.round(rect.height)}`;
    if (key !== lastZoomKey) {
      const clone = target.cloneNode(true);
      clone.classList.add("tbm-cursor-lens-clone");
      clone.removeAttribute("id");
      clone.querySelectorAll?.("[id]").forEach((node) => node.removeAttribute("id"));
      clone.style.width = `${rect.width}px`;
      clone.style.height = `${rect.height}px`;
      clone.style.transform = `scale(${zoomScale})`;
      clone.style.transformOrigin = "top left";
      cursorLensContent.replaceChildren(clone);
      activeZoomTarget = target;
      lastZoomKey = key;
    }

    // Position the cloned element so the exact pixel under the pointer lands
    // at the center of the glass after magnification.
    const localX = cursorX - rect.left;
    const localY = cursorY - rect.top;
    cursorLensContent.style.width = `${rect.width * zoomScale}px`;
    cursorLensContent.style.height = `${rect.height * zoomScale}px`;
    cursorLensContent.style.left = `${lensSize / 2 - localX * zoomScale}px`;
    cursorLensContent.style.top = `${lensSize / 2 - localY * zoomScale}px`;
    cursorLens.classList.add("is-visible");
  };

  const onPointerMove = (event) => updateLens(event);
  const onPointerLeave = () => clearLens();
  window.addEventListener("mousemove", onPointerMove, { passive: true });
  document.documentElement.addEventListener("mouseleave", onPointerLeave);

  cleanups.push(() => {
    window.removeEventListener("mousemove", onPointerMove);
    document.documentElement.removeEventListener("mouseleave", onPointerLeave);
    cursorLens.remove();
  });

  const words = ["App Development.", "Website Development.", "Graphic Designing.", "Digital Marketing."];
  const rotatingElement = root.querySelector("#rotating-text");
  let rotateTimer;
  let rotateSwapTimer;
  if (rotatingElement) {
    let index = 0;
    rotateTimer = window.setTimeout(() => {
      rotateTimer = window.setInterval(() => {
        rotatingElement.style.opacity = "0";
        rotateSwapTimer = window.setTimeout(() => {
          index = (index + 1) % words.length;
          rotatingElement.textContent = words[index];
          rotatingElement.style.opacity = "1";
        }, 500);
      }, 2000);
    }, 1000);
  }
  cleanups.push(() => {
    window.clearTimeout(rotateTimer);
    window.clearInterval(rotateTimer);
    window.clearTimeout(rotateSwapTimer);
  });

  const counters = [...root.querySelectorAll(".counter")];
  const observer = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const counter = entry.target;
      const target = Number(counter.getAttribute("data-target"));
      let count = 0;
      const step = () => {
        count = Math.min(target, Math.ceil(count + target / 100));
        counter.innerText = String(count);
        if (count < target) counter._counterTimer = window.setTimeout(step, 50);
      };
      step();
      observer.unobserve(counter);
    });
  }, { threshold: 0.5 }) : null;
  counters.forEach((counter) => observer?.observe(counter));
  cleanups.push(() => {
    observer?.disconnect();
    counters.forEach((counter) => window.clearTimeout(counter._counterTimer));
  });

  const canvasContainer = root.querySelector("#network-canvas-container");
  if (canvasContainer) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 3.5;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasContainer.appendChild(renderer.domElement);

    const geometry = new THREE.IcosahedronGeometry(1.8, 2);
    const wireframe = new THREE.WireframeGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xFF6A00, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending });
    const lineSegments = new THREE.LineSegments(wireframe, lineMaterial);
    const pointsMaterial = new THREE.PointsMaterial({ color: 0xFF6A00, size: 0.06, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
    const points = new THREE.Points(geometry, pointsMaterial);
    const group = new THREE.Group();
    group.add(lineSegments);
    group.add(points);
    scene.add(group);

    let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
    const onMouseMove = (event) => {
      mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    const resize = () => {
      const width = Math.max(1, canvasContainer.clientWidth);
      const height = Math.max(1, canvasContainer.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    window.addEventListener("resize", resize);

    const clock = new THREE.Clock();
    let frameId;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      group.rotation.x += 0.0008;
      group.rotation.y += 0.0012;
      group.rotation.z += 0.0003;
      group.scale.setScalar(1 + Math.sin(elapsedTime * 1.5) * 0.04);
      targetX = mouseY * 0.1;
      targetY = mouseX * 0.1;
      group.rotation.x += (targetX - group.rotation.x) * 0.02;
      group.rotation.y += (targetY - group.rotation.y) * 0.02;
      renderer.render(scene, camera);
    };
    if (mediaQuery.matches) {
      group.rotation.set(0.5, 0.5, 0);
      renderer.render(scene, camera);
    } else {
      animate();
    }

    cleanups.push(() => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      wireframe.dispose();
      lineMaterial.dispose();
      pointsMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    });
  }


  // Services page-only motion. Keeps all service animations scoped to the new page.
  const servicePage = root.closest(".service-page") || root.querySelector(".service-page");
  if (servicePage) {
    const revealItems = [...servicePage.querySelectorAll(".service-reveal")];
    const revealObserver = "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("service-in-view");
            revealObserver.unobserve(entry.target);
          });
        }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" })
      : null;
    revealItems.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index * 45, 240)}ms`;
      revealObserver?.observe(item);
      if (!revealObserver) item.classList.add("service-in-view");
    });
    cleanups.push(() => revealObserver?.disconnect());

    // Service tiles use a restrained CSS-only hover treatment for a matte, editorial feel.
  }

  // Social media detail page-only motion.
  const socialPage = root.closest(".social-page") || root.querySelector(".social-page");
  if (socialPage) {
    const revealItems = [...socialPage.querySelectorAll(".social-reveal")];
    const revealObserver = "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("social-in-view");
            revealObserver.unobserve(entry.target);
          });
        }, { threshold: 0.1, rootMargin: "0px 0px -7% 0px" })
      : null;
    revealItems.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index * 45, 240)}ms`;
      revealObserver?.observe(item);
      if (!revealObserver) item.classList.add("social-in-view");
    });
    cleanups.push(() => revealObserver?.disconnect());
  }

  // About page-only motion. Nothing below runs on the homepage or contact page.
  const aboutPage = root.closest(".about-page") || root.querySelector(".about-page");
  if (aboutPage) {
    const revealItems = [...aboutPage.querySelectorAll(".about-reveal")];
    const revealObserver = "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("about-in-view");
              revealObserver.unobserve(entry.target);
            }
          });
        }, { threshold: 0.14 })
      : null;
    revealItems.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index * 45, 220)}ms`;
      revealObserver?.observe(item);
      if (!revealObserver) item.classList.add("about-in-view");
    });
    cleanups.push(() => revealObserver?.disconnect());

    const canvasContainer = aboutPage.querySelector("#about-porous-canvas");
    if (canvasContainer && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 0, 5.5);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      renderer.setClearColor(0x000000, 0);
      canvasContainer.appendChild(renderer.domElement);

      const group = new THREE.Group();
      scene.add(group);
      const geometry = new THREE.IcosahedronGeometry(1.45, 5);
      const pos = geometry.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).normalize();
        const noise = 1 + 0.09 * Math.sin(v.x * 8 + v.y * 5) * Math.cos(v.z * 9 + v.x * 4);
        pos.setXYZ(i, v.x * 1.45 * noise, v.y * 1.45 * noise, v.z * 1.45 * noise);
      }
      geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({
        color: 0x141414,
        roughness: 0.76,
        metalness: 0.2,
        flatShading: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);

      const wire = new THREE.WireframeGeometry(geometry);
      const wireMat = new THREE.LineBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.12 });
      const wireMesh = new THREE.LineSegments(wire, wireMat);
      group.add(wireMesh);

      const poreGeometry = new THREE.SphereGeometry(0.055, 8, 8);
      const poreMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const poreGroup = new THREE.Group();
      const poreCount = 150;
      for (let i = 0; i < poreCount; i++) {
        const u = Math.random();
        const v2 = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v2 - 1);
        const r = 1.46 + (Math.random() * 0.03);
        const p = new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        );
        const pore = new THREE.Mesh(poreGeometry, poreMaterial);
        pore.position.copy(p);
        pore.scale.setScalar(0.45 + Math.random() * 1.6);
        pore.lookAt(0, 0, 0);
        poreGroup.add(pore);
      }
      group.add(poreGroup);

      const keyLight = new THREE.DirectionalLight(0xff7a20, 2.1);
      keyLight.position.set(3, 2, 4);
      scene.add(keyLight);
      const fillLight = new THREE.PointLight(0x2563eb, 2.2, 8);
      fillLight.position.set(-3, -1, 2);
      scene.add(fillLight);
      scene.add(new THREE.AmbientLight(0x202020, 1.6));

      let targetRX = 0, targetRY = 0, currentRX = 0, currentRY = 0;
      const onAboutMouseMove = (event) => {
        targetRY = ((event.clientX / window.innerWidth) * 2 - 1) * 0.16;
        targetRX = ((event.clientY / window.innerHeight) * 2 - 1) * -0.12;
      };
      window.addEventListener("mousemove", onAboutMouseMove, { passive: true });

      let scrollTarget = 0;
      let scrollCurrent = 0;
      const onAboutScroll = () => { scrollTarget = Math.min(1, Math.max(0, window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight))); };
      window.addEventListener("scroll", onAboutScroll, { passive: true });
      onAboutScroll();

      const resize = () => {
        const width = Math.max(1, canvasContainer.clientWidth);
        const height = Math.max(1, canvasContainer.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      resize();
      window.addEventListener("resize", resize);

      const clock = new THREE.Clock();
      let frameId;
      const animateAbout = () => {
        frameId = requestAnimationFrame(animateAbout);
        const t = clock.getElapsedTime();
        currentRX += (targetRX - currentRX) * 0.035;
        currentRY += (targetRY - currentRY) * 0.035;
        scrollCurrent += (scrollTarget - scrollCurrent) * 0.035;
        group.rotation.x = currentRX + Math.sin(t * 0.18) * 0.06 + scrollCurrent * 0.65;
        group.rotation.y = currentRY + t * 0.16 + scrollCurrent * 1.45;
        group.rotation.z = scrollCurrent * -0.35;
        const s = 1 + Math.sin(t * 1.2) * 0.025 + scrollCurrent * 0.08;
        group.scale.setScalar(s);
        renderer.render(scene, camera);
      };
      animateAbout();

      cleanups.push(() => {
        cancelAnimationFrame(frameId);
        window.removeEventListener("mousemove", onAboutMouseMove);
        window.removeEventListener("scroll", onAboutScroll);
        window.removeEventListener("resize", resize);
        geometry.dispose();
        wire.dispose();
        wireMat.dispose();
        material.dispose();
        poreGeometry.dispose();
        poreMaterial.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      });
    }

    // Premium pointer-follow tilt for About cards and partner tiles.
    const tiltCards = [...aboutPage.querySelectorAll(".about-pillar-card, .about-stat-card, .about-logo-card")];
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const tiltCleanups = [];
    if (finePointer.matches) {
      tiltCards.forEach((card) => {
        const onMove = (event) => {
          const rect = card.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - 0.5;
          const y = (event.clientY - rect.top) / rect.height - 0.5;
          card.style.transform = `perspective(900px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) translateY(-6px)`;
        };
        const onLeave = () => { card.style.transform = ""; };
        card.addEventListener("mousemove", onMove, { passive: true });
        card.addEventListener("mouseleave", onLeave);
        tiltCleanups.push(() => { card.removeEventListener("mousemove", onMove); card.removeEventListener("mouseleave", onLeave); card.style.transform = ""; });
      });
    }
    cleanups.push(() => tiltCleanups.forEach((cleanup) => cleanup()));
  }


  // Performance marketing page-only motion inspired by the reference motion language.
  const performancePage = root.closest(".performance-page") || root.querySelector(".performance-page");
  if (performancePage) {
    const motionReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hero = performancePage.querySelector(".social-detail-hero");
    const heroInner = performancePage.querySelector(".social-hero-inner");
    const heroGlowOrange = performancePage.querySelector(".social-hero-glow-orange");
    const heroGlowBlue = performancePage.querySelector(".social-hero-glow-blue");
    const cards = [...performancePage.querySelectorAll(".social-service-card")];
    const processCards = [...performancePage.querySelectorAll(".social-process-card")];
    const benefitCards = [...performancePage.querySelectorAll(".social-benefit-card")];
    const imageCards = [...performancePage.querySelectorAll(".social-image-card, .social-faq-image")];
    const motionCleanups = [];

    [...cards, ...processCards, ...benefitCards].forEach((card, index) => {
      card.style.setProperty("--performance-stagger", `${Math.min(index * 65, 420)}ms`);
    });

    if (!motionReduced && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      const tiltTargets = [...cards, ...processCards, ...benefitCards];
      tiltTargets.forEach((card) => {
        const onMove = (event) => {
          const rect = card.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - 0.5;
          const y = (event.clientY - rect.top) / rect.height - 0.5;
          card.style.setProperty("--px", `${(x * 2 + .5).toFixed(2)}`);
          card.style.setProperty("--py", `${(y * 2 + .5).toFixed(2)}`);
          card.style.transform = `perspective(900px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) translateY(-7px)`;
        };
        const onLeave = () => {
          card.style.transform = "";
          card.style.setProperty("--px", ".5");
          card.style.setProperty("--py", ".5");
        };
        card.addEventListener("mousemove", onMove, { passive: true });
        card.addEventListener("mouseleave", onLeave);
        motionCleanups.push(() => {
          card.removeEventListener("mousemove", onMove);
          card.removeEventListener("mouseleave", onLeave);
          card.style.transform = "";
        });
      });
    }

    if (!motionReduced && hero) {
      let targetX = 0, targetY = 0, currentX = 0, currentY = 0, scrollY = 0, currentScroll = 0;
      const onPointer = (event) => {
        targetX = (event.clientX / window.innerWidth - 0.5) * 18;
        targetY = (event.clientY / window.innerHeight - 0.5) * 12;
      };
      const onScroll = () => { scrollY = window.scrollY; };
      window.addEventListener("mousemove", onPointer, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });

      let frameId;
      const animatePerformance = () => {
        frameId = requestAnimationFrame(animatePerformance);
        currentX += (targetX - currentX) * 0.035;
        currentY += (targetY - currentY) * 0.035;
        currentScroll += (scrollY - currentScroll) * 0.045;
        const depth = Math.min(currentScroll, 700);

        if (heroInner) heroInner.style.transform = `translate3d(${currentX * .16}px,${currentY * .12 - depth * .045}px,0)`;
        if (heroGlowOrange) heroGlowOrange.style.transform = `translate3d(${currentX * -.55}px,${currentY * -.35}px,0)`;
        if (heroGlowBlue) heroGlowBlue.style.transform = `translate3d(${currentX * .35}px,${currentY * .25}px,0)`;
      };
      animatePerformance();

      motionCleanups.push(() => {
        cancelAnimationFrame(frameId);
        window.removeEventListener("mousemove", onPointer);
        window.removeEventListener("scroll", onScroll);
        if (heroInner) heroInner.style.transform = "";
        if (heroGlowOrange) heroGlowOrange.style.transform = "";
        if (heroGlowBlue) heroGlowBlue.style.transform = "";
      });
    }

    if (!motionReduced) {
      imageCards.forEach((card) => {
        const image = card.querySelector("img");
        if (!image) return;
        const onMove = (event) => {
          const rect = card.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - .5;
          const y = (event.clientY - rect.top) / rect.height - .5;
          image.style.transform = `scale(1.045) translate3d(${x * 10}px,${y * 10}px,0)`;
        };
        const onLeave = () => { image.style.transform = ""; };
        card.addEventListener("mousemove", onMove, { passive: true });
        card.addEventListener("mouseleave", onLeave);
        motionCleanups.push(() => {
          card.removeEventListener("mousemove", onMove);
          card.removeEventListener("mouseleave", onLeave);
          image.style.transform = "";
        });
      });
    }

    cleanups.push(() => motionCleanups.forEach((cleanup) => cleanup()));
  }

  // Shared mobile navigation. Works across every generated page without React state.
  const header = root.querySelector(".main-header");
  const menuButton = header?.querySelector(".menu-button");
  const nav = header?.querySelector(".main-nav");
  const serviceDropdown = header?.querySelector(".service-nav-dropdown");
  const serviceTrigger = serviceDropdown?.querySelector(".service-dropdown-trigger");
  const toggleMenu = () => {
    if (!header) return;
    header.classList.toggle("is-menu-open");
    menuButton?.setAttribute("aria-expanded", header.classList.contains("is-menu-open") ? "true" : "false");
  };
  const closeMenu = () => { header?.classList.remove("is-menu-open"); menuButton?.setAttribute("aria-expanded", "false"); serviceDropdown?.classList.remove("is-open"); };
  const toggleServices = (event) => {
    if (!serviceDropdown || window.innerWidth > 800) return;
    event.preventDefault();
    event.stopPropagation();
    serviceDropdown.classList.toggle("is-open");
  };
  menuButton?.addEventListener("click", toggleMenu);
  serviceTrigger?.addEventListener("click", toggleServices);
  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  cleanups.push(() => {
    menuButton?.removeEventListener("click", toggleMenu);
    serviceTrigger?.removeEventListener("click", toggleServices);
    nav?.querySelectorAll("a").forEach((link) => link.removeEventListener("click", closeMenu));
  });

  const contactForm = root.querySelector("#tbm-contact-form");
  const contactStatus = root.querySelector("#contact-form-status");
  if (contactForm) {
    const onContactSubmit = (event) => {
      event.preventDefault();
      const data = new FormData(contactForm);
      const name = String(data.get("name") || "").trim();
      const email = String(data.get("email") || "").trim();
      const phone = String(data.get("phone") || "").trim();
      const company = String(data.get("company") || "").trim();
      const project = String(data.get("project") || "").trim();
      const projectType = String(data.get("projectType") || "").trim();
      const budget = String(data.get("budget") || "").trim();
      const deadline = String(data.get("deadline") || "").trim();
      const website = String(data.get("website") || "").trim();
      const services = data.getAll("services").map(String).join(", ");
      const message = String(data.get("message") || "").trim();
      const subject = encodeURIComponent(`New project inquiry from ${name || "Website visitor"}`);
      const body = encodeURIComponent([
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone}`,
        `Company: ${company}`,
        `Project: ${project}`,
        `Project type: ${projectType}`,
        `Services: ${services}`,
        `Budget: ${budget}`,
        `Deadline: ${deadline}`,
        `Existing website: ${website}`,
        "",
        "Project description:",
        message,
        "",
        "Reference file: selected in the form. Please attach it manually to the email if needed.",
      ].join("\\n"));
      window.location.href = `mailto:hello.thebuzzmedia@gmail.com?subject=${subject}&body=${body}`;
      if (contactStatus) contactStatus.textContent = "Opening your email app with the enquiry details…";
    };
    contactForm.addEventListener("submit", onContactSubmit);
    cleanups.push(() => contactForm.removeEventListener("submit", onContactSubmit));
  }

  return () => cleanups.forEach((cleanup) => cleanup());
}

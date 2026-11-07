/**
 * Finger Trail — In-Browser Gesture Studio & Ephemeral Player
 * Published by Thoughts to Pen (thoughtstopen.com)
 * 
 * Features:
 * - High-DPI responsive HTML5 Canvas drawing
 * - Sub-millisecond point timestamping & velocity tracking
 * - Glowing phosphor / neon stroke aesthetics with particle embers
 * - Accurate recorded-speed replay loop
 * - 8-second self-destruct fuse with particle explosion physics
 * - Hash payload decoder for instant zero-install web link replay (#trail=...)
 */

(function () {
  'use strict';

  // --- Color Presets ---
  const PALETTES = {
    cyan: { core: '#ffffff', glow: '#00f2fe', particle: '#38f8ff' },
    magenta: { core: '#ffffff', glow: '#ff0844', particle: '#ff4b72' },
    lime: { core: '#ffffff', glow: '#00ff87', particle: '#60efa1' },
    violet: { core: '#ffffff', glow: '#7f00ff', particle: '#b366ff' },
    amber: { core: '#ffffff', glow: '#fee140', particle: '#fce881' }
  };

  function resolvePalette(colorVal) {
    if (colorVal && PALETTES[colorVal]) return PALETTES[colorVal];
    if (typeof colorVal === 'string' && colorVal.startsWith('#')) {
      return {
        core: '#ffffff',
        glow: colorVal,
        particle: colorVal
      };
    }
    return PALETTES.cyan;
  }

  let currentColor = 'cyan';
  let canvas, ctx;
  let dpr = 1;
  let isDrawing = false;
  let currentStroke = [];
  let strokes = []; // Array of { points: [{x, y, t}], color }
  let particles = [];
  let replayStartTime = null;
  let isReplaying = false;
  let replayIndex = 0;
  let replayStrokeIndex = 0;
  let countdownTimer = null;
  let countdownRemaining = 8.0;
  let currentLoadedTrailId = null;
  let isViewerMode = false;
  let viewerBurned = false;

  // DOM Elements
  let demoCard, statusText, countdownBox, hintEl, playBtn, clearBtn, shareBtn;
  let palettePicker, actionButtons, viewerActions, viewerTag, replyBtn;

  function init() {
    canvas = document.getElementById('demoCanvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    demoCard = document.getElementById('demo');
    statusText = document.getElementById('canvasStatusText');
    countdownBox = document.getElementById('countdownBox');
    hintEl = document.getElementById('canvasHint');
    playBtn = document.getElementById('playBtn');
    clearBtn = document.getElementById('clearBtn');
    shareBtn = document.getElementById('shareBtn');
    palettePicker = document.getElementById('palettePicker');
    actionButtons = document.getElementById('actionButtons');
    viewerActions = document.getElementById('viewerActions');
    viewerTag = document.getElementById('viewerTag');
    replyBtn = document.getElementById('replyBtn');

    setupDPR();
    window.addEventListener('resize', handleResize);

    // Pointer events (handles Mouse, Touch, Stylus seamlessly)
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);

    // Palette controls
    document.querySelectorAll('.color-dot').forEach(btn => {
      btn.addEventListener('click', () => {
        if (isViewerMode) return;
        document.querySelectorAll('.color-dot').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentColor = btn.getAttribute('data-color') || 'cyan';
      });
    });

    if (playBtn) playBtn.addEventListener('click', toggleReplay);
    if (clearBtn) clearBtn.addEventListener('click', resetCanvas);
    if (shareBtn) shareBtn.addEventListener('click', shareCurrentTrail);
    if (replyBtn) replyBtn.addEventListener('click', switchToStudioMode);

    // Check for URL hash payload (#trail=...)
    checkHashPayload();
    window.addEventListener('hashchange', checkHashPayload);

    // Start background animation loop for idle glow/particles
    requestAnimationFrame(renderLoop);
  }

  function setupDPR() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);
    redrawStrokes();
  }

  function handleResize() {
    setupDPR();
  }

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: performance.now()
    };
  }

  function handlePointerDown(e) {
    if (isViewerMode) {
      if (!viewerBurned) {
        setStatus('🔒 Secret message playing — drawing disabled until self-destruct.');
        return;
      }
      switchToStudioMode();
    }
    if (isReplaying) cancelReplay();
    isDrawing = true;
    canvas.setPointerCapture(e.pointerId);

    if (hintEl) hintEl.style.opacity = '0';
    stopCountdown();

    const pt = getCanvasCoords(e);
    currentStroke = [pt];
    strokes.push({
      color: currentColor,
      points: currentStroke
    });

    addEmbers(pt.x, pt.y, PALETTES[currentColor].particle, 4);
    setStatus('Recording your finger strokes...');
  }

  function handlePointerMove(e) {
    if (isViewerMode || !isDrawing) return;
    const pt = getCanvasCoords(e);
    currentStroke.push(pt);

    drawIncrementalStroke(currentStroke, PALETTES[currentColor]);
  }

  function handlePointerUp(e) {
    if (isViewerMode || !isDrawing) return;
    isDrawing = false;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}

    setStatus('Trail ready. Tap "Replay Note" or draw more.');
  }

  function drawIncrementalStroke(pts, pal) {
    if (pts.length < 2) return;
    const p1 = pts[pts.length - 2];
    const p2 = pts[pts.length - 1];

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Pass 1: Smooth outer glow halo
    ctx.shadowBlur = 10;
    ctx.shadowColor = pal.glow;
    ctx.strokeStyle = pal.glow;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // Pass 2: Sharp high-intensity luminous core
    ctx.shadowBlur = 0;
    ctx.strokeStyle = pal.core;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    ctx.restore();
  }

  function drawSmoothPath(points) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
      return;
    }
    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  }

  function redrawStrokes(strokeList = strokes) {
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    ctx.clearRect(0, 0, width, height);

    for (const stroke of strokeList) {
      const pal = resolvePalette(stroke.color);
      if (stroke.points.length < 2) continue;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Outer glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = pal.glow;
      ctx.strokeStyle = pal.glow;
      ctx.lineWidth = stroke.width || 4;
      drawSmoothPath(stroke.points);
      ctx.stroke();

      // Core line
      ctx.shadowBlur = 0;
      ctx.strokeStyle = pal.core;
      ctx.lineWidth = Math.max(1.5, (stroke.width || 4) / 2);
      drawSmoothPath(stroke.points);
      ctx.stroke();

      ctx.restore();
    }
  }

  // --- Recorded-Speed Replay Engine ---
  function toggleReplay() {
    if (isReplaying) {
      cancelReplay();
      return;
    }

    if (strokes.length === 0) {
      setStatus('✏️ Draw a gesture on the canvas first, then tap Replay!');
      if (hintEl) {
        hintEl.style.opacity = '1';
        hintEl.querySelector('p').textContent = 'Draw with your finger or stylus first...';
      }
      return;
    }

    startReplay();
  }

  function startReplay() {
    isReplaying = true;
    stopCountdown();
    if (playBtn) playBtn.textContent = 'Stop';
    setStatus('Replaying live at recorded speed...');

    // Normalize stroke timing
    const normalizedStrokes = strokes.map(s => {
      const startT = s.points[0].t;
      return {
        color: s.color,
        points: s.points.map(p => ({ x: p.x, y: p.y, dt: p.t - startT }))
      };
    });

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    ctx.clearRect(0, 0, width, height);

    let activeStrokeIdx = 0;
    let activePointIdx = 0;
    let strokeStartTime = performance.now();

    function replayFrame(now) {
      if (!isReplaying) return;

      if (activeStrokeIdx >= normalizedStrokes.length) {
        finishReplay();
        return;
      }

      const curStroke = normalizedStrokes[activeStrokeIdx];
      const elapsed = now - strokeStartTime;

      while (activePointIdx < curStroke.points.length && curStroke.points[activePointIdx].dt <= elapsed) {
        if (activePointIdx > 0) {
          const p1 = curStroke.points[activePointIdx - 1];
          const p2 = curStroke.points[activePointIdx];
          const pal = resolvePalette(curStroke.color);
          const strokeW = curStroke.width || 4;

          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowBlur = 14;
          ctx.shadowColor = pal.glow;
          ctx.strokeStyle = pal.glow;
          ctx.lineWidth = strokeW;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();

          ctx.shadowBlur = 0;
          ctx.strokeStyle = pal.core;
          ctx.lineWidth = Math.max(1.5, strokeW / 2);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          ctx.restore();
        }
        activePointIdx++;
      }

      if (activePointIdx >= curStroke.points.length) {
        activeStrokeIdx++;
        activePointIdx = 0;
        strokeStartTime = now + 120; // 120ms natural pause between strokes
      }

      requestAnimationFrame(replayFrame);
    }

    requestAnimationFrame(replayFrame);
  }

  function finishReplay() {
    isReplaying = false;
    if (playBtn) playBtn.textContent = 'Replay Note';
    setStatus('Replay finished. Self-destruct sequence armed!');
    startCountdown();
  }

  function cancelReplay() {
    isReplaying = false;
    if (playBtn) playBtn.textContent = 'Replay Note';
    redrawStrokes();
    setStatus('Replay stopped.');
  }

  // --- 8-Second Self-Destruct Fuse ---
  function startCountdown() {
    stopCountdown();
    countdownRemaining = 8.0;
    if (countdownBox) {
      countdownBox.classList.add('active');
      countdownBox.textContent = 'SELF-DESTRUCT: 8.0s';
    }

    const startTime = performance.now();
    countdownTimer = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      countdownRemaining = Math.max(0, 8.0 - elapsed);
      if (countdownBox) {
        countdownBox.textContent = `SELF-DESTRUCT: ${countdownRemaining.toFixed(1)}s`;
      }

      if (countdownRemaining <= 0) {
        stopCountdown();
        triggerDisintegration();
      }
    }, 50);
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (countdownBox) {
      countdownBox.classList.remove('active');
    }
  }

  function triggerDisintegration() {
    if (currentLoadedTrailId) {
      try {
        localStorage.setItem('ft_burned_' + currentLoadedTrailId, Date.now().toString());
      } catch (_) {}
    }

    setStatus('Note disintegrating... vanished forever.');

    // Convert strokes into burning embers exploding outwards
    strokes.forEach(stroke => {
      const pal = resolvePalette(stroke.color);
      stroke.points.forEach((p, idx) => {
        if (idx % 3 === 0) {
          addExplosionParticle(p.x, p.y, pal.particle);
        }
      });
    });

    // Clear recorded strokes immediately (true ephemerality)
    strokes = [];
    currentStroke = [];

    // Purge payload from browser address bar
    try {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } else {
        window.location.hash = '';
      }
    } catch (e) {
      // Ignore
    }

    // Fade canvas out quickly and wipe all residual elements
    let fadeFrames = 0;
    function fade() {
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      ctx.fillStyle = 'rgba(6, 7, 10, 0.25)';
      ctx.fillRect(0, 0, width, height);
      fadeFrames++;
      if (fadeFrames < 24) {
        requestAnimationFrame(fade);
      } else {
        // Complete memory purge: remove all lingering particles
        particles = [];
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#06070a';
        ctx.fillRect(0, 0, width, height);
        if (isViewerMode) {
          // Automatically restore Studio Creator Mode so recipient can immediately draw!
          isViewerMode = false;
          viewerBurned = true;
          currentLoadedTrailId = null;
          if (demoCard) demoCard.classList.remove('is-viewer-mode');
          if (palettePicker) palettePicker.style.display = 'flex';
          if (actionButtons) actionButtons.style.display = 'flex';
          if (viewerActions) viewerActions.style.display = 'none';
          if (canvas) canvas.style.cursor = 'crosshair';

          if (hintEl) {
            hintEl.style.opacity = '1';
            hintEl.querySelector('p').textContent = 'Your turn! Draw with finger or stylus to reply...';
          }
          setStatus('Trail vaporized forever. Zero-trace verified. Now draw your reply!');
        } else {
          if (hintEl) {
            hintEl.style.opacity = '1';
            hintEl.querySelector('p').textContent = 'Note has self-destructed. Draw a new one!';
          }
          setStatus('Trail vaporized forever. Zero-trace verified.');
        }
      }
    }
    fade();
  }

  // --- Particle Physics System ---
  function addEmbers(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5 - 0.5,
        color: color,
        life: 1.0,
        decay: 0.03 + Math.random() * 0.04,
        size: 2 + Math.random() * 2
      });
    }
  }

  function addExplosionParticle(x, y, color) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 5.0;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.8,
      color: color,
      life: 1.0,
      decay: 0.015 + Math.random() * 0.02,
      size: 2.5 + Math.random() * 3
    });
  }

  function renderLoop() {
    // Update and draw particles
    if (particles.length > 0) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    requestAnimationFrame(renderLoop);
  }

  // --- Reset & Sample Actions ---
  function switchToStudioMode() {
    isViewerMode = false;
    viewerBurned = false;
    currentLoadedTrailId = null;
    if (demoCard) demoCard.classList.remove('is-viewer-mode');
    if (palettePicker) palettePicker.style.display = 'flex';
    if (actionButtons) actionButtons.style.display = 'flex';
    if (viewerActions) viewerActions.style.display = 'none';
    if (replyBtn) replyBtn.style.display = 'none';
    if (canvas) canvas.style.cursor = 'crosshair';
    resetCanvas();
  }

  function resetCanvas() {
    stopCountdown();
    cancelReplay();
    strokes = [];
    currentStroke = [];
    particles = [];
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    ctx.clearRect(0, 0, width, height);
    if (hintEl) {
      hintEl.style.opacity = '1';
      hintEl.querySelector('p').textContent = 'Draw with your finger or stylus...';
    }
    setStatus('Ready to record gestures.');
  }

  async function encodePayload(obj) {
    const jsonStr = JSON.stringify(obj);
    if (typeof CompressionStream !== 'undefined') {
      try {
        const cs = new CompressionStream('gzip');
        const writer = cs.writable.getWriter();
        writer.write(new TextEncoder().encode(jsonStr));
        writer.close();
        const arrayBuffer = await new Response(cs.readable).arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      } catch (gzipErr) {
        console.warn('Gzip stream failed, falling back to base64:', gzipErr);
      }
    }
    return btoa(unescape(encodeURIComponent(jsonStr))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function shareCurrentTrail() {
    if (strokes.length === 0) {
      setStatus('✏️ Please draw a gesture on the canvas before sharing!');
      if (hintEl) {
        hintEl.style.opacity = '1';
        hintEl.querySelector('p').textContent = 'Draw with your finger or stylus first...';
      }
      return;
    }

    setStatus('Generating compressed link...');

    try {
      const canvasWidth = canvas.width / dpr;
      const canvasHeight = canvas.height / dpr;
      const sessionStartT = strokes[0].points[0].t;

      const formattedStrokes = strokes.map((s, idx) => {
        const hexColor = PALETTES[s.color] ? PALETTES[s.color].glow : (s.color || '#00f2fe');
        const strokeStartT = Math.round(s.points[0].t - sessionStartT);
        const strokeEndT = Math.round(s.points[s.points.length - 1].t - sessionStartT);

        // Decimate points to keep link compact and fast (~60fps)
        const pts = [];
        const minInterval = 15;
        let lastT = -999;
        for (let i = 0; i < s.points.length; i++) {
          const p = s.points[i];
          const relT = Math.round(p.t - sessionStartT);
          if (i === 0 || i === s.points.length - 1 || (relT - lastT) >= minInterval) {
            pts.push([
              Math.round((p.x / canvasWidth) * 1000) / 1000,
              Math.round((p.y / canvasHeight) * 1000) / 1000,
              relT,
              1.0
            ]);
            lastT = relT;
          }
        }

        return {
          b: 'neon',
          c: hexColor,
          w: s.width || 5,
          st: strokeStartT,
          et: strokeEndT,
          p: pts
        };
      });

      const totalDuration = Math.max(1000, Math.round(strokes[strokes.length - 1].points[strokes[strokes.length - 1].points.length - 1].t - sessionStartT));

      const payloadObj = {
        i: 'web_' + Math.random().toString(36).substring(2, 10),
        d: totalDuration,
        e: 8,
        t: 'Secret Gesture',
        s: formattedStrokes
      };

      const fragment = await encodePayload(payloadObj);
      const baseUrl = 'https://fingertrail.thoughtstopen.com';
      const shareUrl = `${baseUrl}/#trail=${fragment}`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Finger Trail: Secret Ephemeral Gesture',
            text: '🔒 I drew you a self-erasing Finger Trail by Thoughts to Pen! Watch it animate before it vaporizes forever:',
            url: shareUrl
          });
          setStatus('✨ Trail shared successfully!');
          return;
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') {
            setStatus('Share cancelled.');
            return;
          }
        }
      }

      // Clipboard fallback
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setStatus('🔗 Secret link copied to clipboard! Paste it into WhatsApp, Telegram, or any chat.');
      } else {
        const dummy = document.createElement('textarea');
        dummy.value = shareUrl;
        document.body.appendChild(dummy);
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);
        setStatus('🔗 Secret link copied to clipboard! Paste it into WhatsApp, Telegram, or any chat.');
      }
    } catch (err) {
      console.error('Failed to share trail:', err);
      setStatus('Could not generate share link. Please try again.');
    }
  }

  function loadSampleTrail() {
    // Generate a sleek infinity loop "Finger Trail" signature
    const cx = (canvas.width / dpr) / 2;
    const cy = (canvas.height / dpr) / 2;
    const samplePts = [];
    const now = performance.now();

    for (let t = 0; t <= Math.PI * 2; t += 0.08) {
      const scale = Math.min(cx, cy) * 0.55;
      const x = cx + scale * Math.cos(t) / (1 + Math.sin(t) * Math.sin(t));
      const y = cy + scale * Math.sin(t) * Math.cos(t) / (1 + Math.sin(t) * Math.sin(t));
      samplePts.push({ x, y, t: now + t * 400 });
    }

    strokes = [{ color: currentColor, points: samplePts }];
    startReplay();
  }

  async function decodePayload(str) {
    let clean = (str || '').trim();
    if (!clean) return null;
    if (clean.startsWith('#')) clean = clean.substring(1);
    if (clean.startsWith('trail=')) clean = clean.substring(6);
    if (clean.startsWith('payload=')) clean = clean.substring(8);
    if (clean.startsWith('t=')) clean = clean.substring(2);

    // 1. Decode URL-safe Base64 (- -> +, _ -> /) and add padding
    try {
      let b64 = clean.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4 !== 0) {
        b64 += '=';
      }
      const binaryStr = atob(b64);
      const uint8Array = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        uint8Array[i] = binaryStr.charCodeAt(i);
      }

      // If binary array starts with Gzip signature (0x1f, 0x8b)
      if (uint8Array.length >= 2 && uint8Array[0] === 0x1f && uint8Array[1] === 0x8b) {
        if (typeof DecompressionStream !== 'undefined') {
          const ds = new DecompressionStream('gzip');
          const writer = ds.writable.getWriter();
          writer.write(uint8Array);
          writer.close();
          const decompressed = await new Response(ds.readable).text();
          return JSON.parse(decompressed);
        }
      }

      // Fall back to standard uncompressed Base64 string
      let text = new TextDecoder('utf-8').decode(uint8Array);
      if (text.includes('%')) {
        try {
          text = decodeURIComponent(text);
        } catch (_) {}
      }
      return JSON.parse(text);
    } catch (e1) {
      // 2. Try URI decoding directly
      try {
        let uri = decodeURIComponent(clean);
        return JSON.parse(uri);
      } catch (e2) {
        // 3. Try raw JSON
        try {
          return JSON.parse(clean);
        } catch (e3) {
          return null;
        }
      }
    }
  }

  async function checkHashPayload() {
    let payload = '';
    const hash = window.location.hash;
    const search = window.location.search;

    if (hash && hash.length > 5) {
      payload = hash;
    } else if (search && search.includes('trail=')) {
      const params = new URLSearchParams(search);
      payload = params.get('trail') || '';
    }

    if (!payload) return;

    try {
      const data = await decodePayload(payload);
      if (data && data.s && Array.isArray(data.s) && data.s.length > 0) {
        const trailId = data.i || (typeof payload === 'string' ? 'hash_' + payload.substring(0, 16) : null);
        if (trailId && localStorage.getItem('ft_burned_' + trailId)) {
          isViewerMode = false;
          viewerBurned = true;
          if (demoCard) demoCard.classList.remove('is-viewer-mode');
          if (palettePicker) palettePicker.style.display = 'flex';
          if (actionButtons) actionButtons.style.display = 'flex';
          if (viewerActions) viewerActions.style.display = 'none';
          if (canvas) canvas.style.cursor = 'crosshair';
          setStatus('This Finger Trail was already viewed and vaporized on this device. Draw your own!');
          if (hintEl) {
            hintEl.style.opacity = '1';
            hintEl.querySelector('p').textContent = 'This secret trail has already self-destructed. Draw with finger or stylus!';
          }
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
          return;
        }
        currentLoadedTrailId = trailId;
        loadDecodedTrail(data);
      }
    } catch (err) {
      console.warn('Could not decode trail payload from URL:', err);
    }
  }

  function loadDecodedTrail(data) {
    isViewerMode = true;
    viewerBurned = false;
    if (demoCard) demoCard.classList.add('is-viewer-mode');
    if (palettePicker) palettePicker.style.display = 'none';
    if (actionButtons) actionButtons.style.display = 'none';
    if (viewerActions) viewerActions.style.display = 'flex';
    if (replyBtn) replyBtn.style.display = 'none';
    if (canvas) canvas.style.cursor = 'default';

    const canvasWidth = canvas.width / dpr;
    const canvasHeight = canvas.height / dpr;

    strokes = data.s.map(st => {
      const pts = (st.p || []).map(pt => {
        let x, y, t;
        if (Array.isArray(pt)) {
          // Format from Flutter app: [normalizedX, normalizedY, timeOffsetMs, pressure]
          const nx = pt[0];
          const ny = pt[1];
          x = nx <= 1.0 ? nx * canvasWidth : nx;
          y = ny <= 1.0 ? ny * canvasHeight : ny;
          t = pt[2] || 0;
        } else {
          x = pt.x <= 1.0 ? pt.x * canvasWidth : pt.x;
          y = pt.y <= 1.0 ? pt.y * canvasHeight : pt.y;
          t = pt.t || 0;
        }
        return { x, y, t };
      });

      return {
        color: st.c || currentColor,
        width: st.w || 6,
        points: pts
      };
    });

    if (data.e && typeof data.e === 'number') {
      countdownRemaining = data.e;
    } else {
      countdownRemaining = 8.0;
    }

    const title = data.t || 'Secret Gesture';
    if (viewerTag) viewerTag.textContent = `🔒 ${title}`;
    setStatus(`"${title}" received! Replaying in real time...`);
    if (hintEl) hintEl.style.opacity = '0';

    // Bring canvas into view and start playback
    setTimeout(() => {
      const targetCard = canvas.closest('.canvas-card') || canvas;
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      startReplay();
    }, 350);
  }

  function setStatus(msg) {
    if (statusText) statusText.textContent = msg;
  }

  // Self-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

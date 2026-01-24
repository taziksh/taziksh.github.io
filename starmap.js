(function() {
  const canvas = document.getElementById('starmap');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Data sources
  const HYG_URL = 'https://gist.githubusercontent.com/djdmsr/c74249982d966e4038dfe0e5bc35ea83/raw/hyglight.json';
  const CONSTELLATIONS_URL = 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json';

  let stars = [];
  let constellations = [];
  let starsLoaded = false;
  let constellationsLoaded = false;

  // Star temperatures by name for color rendering
  const starTemps = {
    'Betelgeuse': 3500, 'Antares': 3600, 'Aldebaran': 3900, 'Arcturus': 4300,
    'Pollux': 4600, 'Capella': 5000, 'Procyon': 6500, 'Sirius': 9900,
    'Vega': 9600, 'Rigel': 12000, 'Spica': 25000, 'Deneb': 8500
  };

  let latitude = 37.4, longitude = -122.1;
  let viewOffsetRA = 0;  // Arrow key offset in hours (0-24)
  let viewOffsetDec = 0; // Arrow key offset in degrees (-90 to 90)
  let targetOffsetRA = 0;  // Target for smooth interpolation
  let targetOffsetDec = 0;
  const baseDpr = window.devicePixelRatio || 1;
  const dpr = baseDpr * 1.5;

  // Fetch HYG star database
  async function loadStars() {
    try {
      const response = await fetch(HYG_URL);
      const geojson = await response.json();

      stars = geojson.features.map(f => {
        const lon = f.geometry.coordinates[0];
        const lat = f.geometry.coordinates[1];
        const ra = ((lon + 180) / 360) * 24;

        return {
          ra: ra,
          dec: lat,
          mag: f.properties.mag,
          name: f.properties.name || '',
          color: parseFloat(f.properties.color) || 0,
          twinkle: Math.random() * Math.PI * 2,
          twinkleSpeed: Math.random() * 0.02 + 0.01
        };
      });

      starsLoaded = true;
      console.log(`Loaded ${stars.length} stars from HYG database`);
    } catch (err) {
      console.error('Failed to load star data:', err);
      starsLoaded = true; // Continue without stars
    }
  }

  // Fetch constellation lines from d3-celestial
  async function loadConstellations() {
    try {
      const response = await fetch(CONSTELLATIONS_URL);
      const geojson = await response.json();

      constellations = geojson.features.map(f => ({
        id: f.id,
        rank: f.properties.rank || 2,
        lines: f.geometry.coordinates // Array of line segments, each is array of [lon, lat] points
      }));

      constellationsLoaded = true;
      console.log(`Loaded ${constellations.length} constellations`);
    } catch (err) {
      console.error('Failed to load constellation data:', err);
      constellationsLoaded = true; // Continue without constellations
    }
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Convert GeoJSON lon/lat to RA/Dec
  function lonLatToRaDec(lon, lat) {
    const ra = ((lon + 180) / 360) * 24;
    return { ra, dec: lat };
  }

  function raDecToXY(ra, dec, time) {
    // Apply view offset from arrow keys
    ra = (ra + viewOffsetRA + 24) % 24;
    dec = Math.max(-90, Math.min(90, dec + viewOffsetDec));

    const dayOfYear = Math.floor((time - new Date(time.getFullYear(), 0, 0)) / 86400000);
    const hour = time.getHours() + time.getMinutes() / 60;
    const lst = (100.46 + 0.985647 * dayOfYear + longitude + 15 * hour) % 360;
    const ha = (lst - ra * 15) * Math.PI / 180;
    const decRad = dec * Math.PI / 180, latRad = latitude * Math.PI / 180;
    const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(ha);
    const alt = Math.asin(sinAlt);
    const cosAz = (Math.sin(decRad) - Math.sin(alt) * Math.sin(latRad)) / (Math.cos(alt) * Math.cos(latRad));
    let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
    if (Math.sin(ha) > 0) az = 2 * Math.PI - az;

    const w = canvas.width / dpr, h = canvas.height / dpr;
    const r = (Math.PI / 2 - alt) / (Math.PI / 2);
    const scale = Math.min(w, h) * 0.45;

    return { x: w / 2 + r * scale * Math.sin(az), y: h / 2 - r * scale * Math.cos(az), alt };
  }

  function colorIndexToRGB(bv) {
    let temp;
    if (bv < -0.4) temp = 30000;
    else if (bv < 0) temp = 10000 - bv * 20000;
    else if (bv < 0.4) temp = 10000 - bv * 10000;
    else if (bv < 1.0) temp = 6000 - (bv - 0.4) * 3000;
    else temp = 4200 - (bv - 1.0) * 1500;

    return tempToRGB(Math.max(2000, Math.min(30000, temp)));
  }

  function tempToRGB(temp) {
    let r, g, b; temp = temp / 100;
    r = temp <= 66 ? 255 : Math.max(0, Math.min(255, 329.698727446 * Math.pow(temp - 60, -0.1332047592)));
    g = temp <= 66 ? Math.max(0, Math.min(255, 99.4708025861 * Math.log(temp) - 161.1195681661)) : Math.max(0, Math.min(255, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)));
    b = temp >= 66 ? 255 : temp <= 19 ? 0 : Math.max(0, Math.min(255, 138.5177312231 * Math.log(temp - 10) - 305.0447927307));
    return `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;
  }

  function magnitudeToSize(mag) {
    return Math.max(0.5, Math.pow(10, (1 - mag) / 5) * 2);
  }

  function drawStar(x, y, mag, star) {
    const size = magnitudeToSize(mag);

    let color;
    if (star.name && starTemps[star.name]) {
      color = tempToRGB(starTemps[star.name]);
    } else {
      color = colorIndexToRGB(star.color);
    }

    const brightness = Math.max(0.3, Math.min(1, (3 - mag) / 5));

    if (mag < 2.5) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
      glow.addColorStop(0, `rgba(${color}, ${brightness * 0.5})`);
      glow.addColorStop(0.5, `rgba(${color}, ${brightness * 0.1})`);
      glow.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(x, y, size * 2, 0, Math.PI * 2); ctx.fillStyle = glow; ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.3, size * 0.5), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, brightness * 1.2)})`;
    ctx.fill();
  }

  function drawConstellationLines(now) {
    ctx.strokeStyle = 'rgba(60, 80, 120, 0.06)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 4]); // Dashed lines - more like imaginary guides

    constellations.forEach(constellation => {
      // Each constellation has multiple line segments
      constellation.lines.forEach(segment => {
        if (segment.length < 2) return;

        ctx.beginPath();
        let started = false;

        for (let i = 0; i < segment.length; i++) {
          const [lon, lat] = segment[i];
          const { ra, dec } = lonLatToRaDec(lon, lat);
          const pos = raDecToXY(ra, dec, now);

          if (!pos) continue;

          if (!started) {
            ctx.moveTo(pos.x, pos.y);
            started = true;
          } else {
            ctx.lineTo(pos.x, pos.y);
          }
        }

        ctx.stroke();
      });
    });
    ctx.setLineDash([]); // Reset dash
  }

  function draw(time) {
    // Smooth interpolation for arrow key movement
    const lerp = 0.15;
    viewOffsetRA += (targetOffsetRA - viewOffsetRA) * lerp;
    viewOffsetDec += (targetOffsetDec - viewOffsetDec) * lerp;
    if (!starsLoaded || !constellationsLoaded) {
      requestAnimationFrame(draw);
      return;
    }

    const now = new Date();
    const w = canvas.width / dpr, h = canvas.height / dpr;

    // Background gradient
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    gradient.addColorStop(0, '#080812');
    gradient.addColorStop(1, '#020204');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Draw constellation lines first (behind stars)
    drawConstellationLines(now);

    // Draw all stars
    stars.forEach(star => {
      const pos = raDecToXY(star.ra, star.dec, now);
      if (!pos) return;

      const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkle) * 0.15 + 0.85;
      const adjustedMag = star.mag + (1 - twinkle) * 0.5;

      drawStar(pos.x, pos.y, adjustedMag, star);
    });

    requestAnimationFrame(draw);
  }

  const locationInfo = document.getElementById('location-info');
  function updateLocationDisplay() {
    if (locationInfo) {
      locationInfo.textContent = `${latitude.toFixed(1)}°${latitude >= 0 ? 'N' : 'S'}, ${Math.abs(longitude).toFixed(1)}°${longitude >= 0 ? 'E' : 'W'}`;
    }
  }

  // Try IP-based geolocation first (no popup)
  async function getLocation() {
    try {
      const response = await fetch('http://ip-api.com/json/?fields=lat,lon');
      const data = await response.json();
      if (data.lat && data.lon) {
        latitude = data.lat;
        longitude = data.lon;
        updateLocationDisplay();
        return;
      }
    } catch (err) {
      console.log('IP geolocation failed, using default location');
    }
    updateLocationDisplay();
  }

  getLocation();

  window.addEventListener('resize', resize);

  // Arrow key controls for panning (smooth)
  window.addEventListener('keydown', (e) => {
    const step = 0.8;
    switch(e.key) {
      case 'ArrowLeft':
        targetOffsetRA -= step;
        break;
      case 'ArrowRight':
        targetOffsetRA += step;
        break;
      case 'ArrowUp':
        targetOffsetDec += step * 4;
        break;
      case 'ArrowDown':
        targetOffsetDec -= step * 4;
        break;
    }
    // Keep RA in 0-24 range
    targetOffsetRA = ((targetOffsetRA % 24) + 24) % 24;
    // Clamp Dec offset
    targetOffsetDec = Math.max(-90, Math.min(90, targetOffsetDec));
  });

  resize();

  // Load both data sources
  Promise.all([loadStars(), loadConstellations()]).then(() => {
    draw(0);
  });
})();

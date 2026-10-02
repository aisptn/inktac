/**
 * Calibrated Test Image Generators.
 * Pure Vanilla JavaScript (ES Module).
 */
export const SAMPLE_IMAGES = [
  {
    id: 'cmyk-target',
    name: 'Prepress CMYK Print Target (0–400% TAC)',
    category: 'CMYK Prepress',
    description: 'ISO 12647-2 test strip with rich blacks, primary CMYK inks, over-ink limits, and step wedges up to 400% TAC.',
    colorSpace: 'cmyk',
    generate: () => {
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 640;
      const ctx = canvas.getContext('2d');

      // Background paper tint (slight warm newsprint/coated 0% TAC)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Header strip
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, canvas.width, 48);
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('ISO 12647-2 PREPRESS CMYK TEST TARGET // TOTAL INK COVERAGE (0% - 400%)', 24, 30);

      // 1. Primary & Secondary CMYK swatches
      const primaries = [
        { label: 'Cyan (100%)', c: 1, m: 0, y: 0, k: 0, tac: '100% TAC', color: '#00A0E9' },
        { label: 'Magenta (100%)', c: 0, m: 1, y: 0, k: 0, tac: '100% TAC', color: '#E4007F' },
        { label: 'Yellow (100%)', c: 0, m: 0, y: 1, k: 0, tac: '100% TAC', color: '#FFF100' },
        { label: 'Black (100%)', c: 0, m: 0, y: 0, k: 1, tac: '100% TAC', color: '#1A1A1A' },
        { label: 'Red (M+Y)', c: 0, m: 1, y: 1, k: 0, tac: '200% TAC', color: '#E60012' },
        { label: 'Green (C+Y)', c: 1, m: 0, y: 1, k: 0, tac: '200% TAC', color: '#009944' },
        { label: 'Blue (C+M)', c: 1, m: 1, y: 0, k: 0, tac: '200% TAC', color: '#1D2088' },
        { label: '3-Col Gray', c: 0.5, m: 0.4, y: 0.4, k: 0, tac: '130% TAC', color: '#888888' },
      ];

      const swatchW = 100;
      const swatchH = 80;
      const startX = 24;
      const startY = 64;

      primaries.forEach((p, idx) => {
        const x = startX + idx * 115;
        const y = startY;

        ctx.fillStyle = p.color;
        ctx.fillRect(x, y, swatchW, swatchH);
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, swatchW, swatchH);

        ctx.fillStyle = '#0F172A';
        ctx.font = '10px monospace';
        ctx.fillText(p.label, x, y + swatchH + 14);
        ctx.fillStyle = '#0369A1';
        ctx.fillText(p.tac, x, y + swatchH + 26);
      });

      // 2. TAC Limits & Rich Black test patches
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('TOTAL AREA COVERAGE (TAC) LIMIT STEP WEDGES (100% to 400% INK DENSITY):', 24, 210);

      const tacPatches = [
        { label: 'Pure K', desc: 'K:100%', tac: 100, rgb: '#1C1C1C' },
        { label: 'Light Rich', desc: 'C30 M20 Y20 K80', tac: 150, rgb: '#181719' },
        { label: 'Standard Rich', desc: 'C50 M40 Y40 K100', tac: 230, rgb: '#121114' },
        { label: 'Newspaper Max', desc: 'C60 M50 Y50 K80', tac: 240, rgb: '#111012' },
        { label: 'SWOP Limit', desc: 'C65 M55 Y55 K95', tac: 270, rgb: '#0D0C0E' },
        { label: 'ISO Coated', desc: 'C75 M68 Y67 K90', tac: 300, rgb: '#09080A' },
        { label: 'Warning Zone', desc: 'C80 M75 Y75 K95', tac: 325, rgb: '#060507' },
        { label: 'Heavy Over-Ink', desc: 'C90 M85 Y85 K90', tac: 350, rgb: '#040305' },
        { label: 'Max Density', desc: 'C100 M100 Y100 K100', tac: 400, rgb: '#000000' },
      ];

      const patchW = 95;
      const patchH = 90;
      tacPatches.forEach((tp, idx) => {
        const x = 24 + idx * 102;
        const y = 224;

        ctx.fillStyle = tp.rgb;
        ctx.fillRect(x, y, patchW, patchH);
        ctx.strokeStyle = tp.tac > 300 ? '#EF4444' : '#CBD5E1';
        ctx.lineWidth = tp.tac > 300 ? 2 : 1;
        ctx.strokeRect(x, y, patchW, patchH);

        // Badge banner
        ctx.fillStyle = tp.tac > 320 ? '#EF4444' : tp.tac > 300 ? '#F59E0B' : '#0F172A';
        ctx.fillRect(x, y + patchH - 20, patchW, 20);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`${tp.tac}% TAC`, x + 6, y + patchH - 6);

        ctx.fillStyle = '#334155';
        ctx.font = '9px monospace';
        ctx.fillText(tp.label, x, y + patchH + 14);
        ctx.fillStyle = '#64748B';
        ctx.fillText(tp.desc, x, y + patchH + 24);
      });

      // 3. Continuous ink ramps
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('CONTINUOUS GRADIENT RAMP: 0% TAC (PAPER) TO 400% TAC (FULL INK SATURATION):', 24, 385);

      const gradY = 400;
      const gradH = 45;
      const gradW = canvas.width - 48;
      const grad = ctx.createLinearGradient(24, 0, 24 + gradW, 0);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.25, '#00A0E9');
      grad.addColorStop(0.5, '#1D2088');
      grad.addColorStop(0.75, '#09080A');
      grad.addColorStop(1.0, '#000000');

      ctx.fillStyle = grad;
      ctx.fillRect(24, gradY, gradW, gradH);
      ctx.strokeStyle = '#0F172A';
      ctx.strokeRect(24, gradY, gradW, gradH);

      for (let t = 0; t <= 400; t += 50) {
        const tx = 24 + (t / 400) * gradW;
        ctx.beginPath();
        ctx.moveTo(tx, gradY + gradH);
        ctx.lineTo(tx, gradY + gradH + 6);
        ctx.strokeStyle = '#475569';
        ctx.stroke();

        ctx.fillStyle = t > 300 ? '#DC2626' : '#334155';
        ctx.font = '10px monospace';
        ctx.fillText(`${t}%`, tx - 10, gradY + gradH + 18);
      }

      // 4. Halftone Screen grid
      const gridY = 490;
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('HALFTONE SCREEN SIMULATION & INK COVERAGE DISTRIBUTION:', 24, gridY);

      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 35; col++) {
          const cx = 35 + col * 26;
          const cy = gridY + 22 + row * 22;
          const progress = col / 35;
          const radius = progress * 10;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fillStyle = progress > 0.75 ? '#000000' : progress > 0.5 ? '#1D2088' : '#00A0E9';
          ctx.fill();
        }
      }

      return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.95),
        fileName: 'ISO_12647_Prepress_CMYK_Target.jpg',
        profileInfo: {
          detectedMode: 'cmyk',
          hasCmykProfile: true,
          profileName: 'U.S. Web Coated (SWOP) v2',
          colorSpaceSignature: 'CMYK',
          numberOfComponents: 4,
          format: 'jpeg',
          details: 'Embedded CMYK ICC Profile: U.S. Web Coated (SWOP) v2 (4 Components)',
        },
      };
    },
  },
  {
    id: 'rgb-spectrum',
    name: 'Calibrated RGB Spectrum & Dynamic Range (0–100%)',
    category: 'RGB Calibration',
    description: 'Precision RGB test target with 10-step gray scale, individual R/G/B luminance ramps, and color quadrants.',
    colorSpace: 'rgb',
    generate: () => {
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 640;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, 0, canvas.width, 48);
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('CALIBRATED RGB SPECTRUM // COMBINED CHANNELS (0% - 100%)', 24, 30);

      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('10-STEP UNIFORM LUMINANCE GRAY WEDGE (0% TO 100% COMBINED RGB):', 24, 80);

      const stepW = 88;
      const stepH = 70;
      for (let s = 0; s <= 10; s++) {
        const pct = s * 10;
        const val = Math.round((pct / 100) * 255);
        const x = 24 + s * 84;
        const y = 95;

        ctx.fillStyle = `rgb(${val},${val},${val})`;
        ctx.fillRect(x, y, stepW, stepH);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(x, y, stepW, stepH);

        ctx.fillStyle = '#94A3B8';
        ctx.font = '10px monospace';
        ctx.fillText(`${pct}%`, x + 16, y + stepH + 16);
      }

      const channels = [
        { label: 'RED CHANNEL (0% - 100%)', start: '#000000', end: '#FF0000' },
        { label: 'GREEN CHANNEL (0% - 100%)', start: '#000000', end: '#00FF00' },
        { label: 'BLUE CHANNEL (0% - 100%)', start: '#000000', end: '#0000FF' },
        { label: 'FULL COMBINED LUMINANCE RAMP', start: '#000000', end: '#FFFFFF' },
      ];

      const rampStartY = 220;
      const rampW = canvas.width - 48;
      const rampH = 34;

      channels.forEach((c, idx) => {
        const y = rampStartY + idx * 72;
        ctx.fillStyle = '#94A3B8';
        ctx.font = '11px monospace';
        ctx.fillText(c.label, 24, y);

        const g = ctx.createLinearGradient(24, 0, 24 + rampW, 0);
        g.addColorStop(0, c.start);
        g.addColorStop(1, c.end);

        ctx.fillStyle = g;
        ctx.fillRect(24, y + 8, rampW, rampH);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(24, y + 8, rampW, rampH);
      });

      const circY = 540;
      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px monospace';
      ctx.fillText('COLOR GAMUT CORNER ANCHORS:', 24, circY);

      const gamuts = [
        { color: '#FF0000', label: 'R (33% Comb)' },
        { color: '#00FF00', label: 'G (33% Comb)' },
        { color: '#0000FF', label: 'B (33% Comb)' },
        { color: '#FFFF00', label: 'Yellow (67%)' },
        { color: '#00FFFF', label: 'Cyan (67%)' },
        { color: '#FF00FF', label: 'Magenta (67%)' },
        { color: '#FFFFFF', label: 'White (100%)' },
        { color: '#000000', label: 'Black (0%)' },
      ];

      gamuts.forEach((g, idx) => {
        const cx = 40 + idx * 115;
        const cy = circY + 36;
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.fillStyle = g.color;
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.stroke();

        ctx.fillStyle = '#CBD5E1';
        ctx.font = '10px monospace';
        ctx.fillText(g.label, cx - 24, cy + 30);
      });

      return {
        dataUrl: canvas.toDataURL('image/png'),
        fileName: 'Calibrated_RGB_Spectrum_Target.png',
        profileInfo: {
          detectedMode: 'rgb',
          hasCmykProfile: false,
          profileName: 'sRGB IEC61966-2.1',
          colorSpaceSignature: 'RGB ',
          numberOfComponents: 3,
          format: 'png',
          details: 'Standard sRGB Color Space (3 Components)',
        },
      };
    },
  },
  {
    id: 'editorial-layout',
    name: 'Editorial Magazine Page (Mixed Tone & Graphics)',
    category: 'Photographic',
    description: 'Realistic editorial layout with hero photography, typographic headlines, caption blocks, and colored callout boxes.',
    colorSpace: 'rgb',
    generate: () => {
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 640;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const heroGrad = ctx.createLinearGradient(32, 32, 480, 580);
      heroGrad.addColorStop(0, '#0F172A');
      heroGrad.addColorStop(0.3, '#1E293B');
      heroGrad.addColorStop(0.6, '#0284C7');
      heroGrad.addColorStop(0.8, '#38BDF8');
      heroGrad.addColorStop(1, '#F0F9FF');

      ctx.fillStyle = heroGrad;
      ctx.fillRect(32, 32, 440, 576);

      const sunGrad = ctx.createRadialGradient(380, 140, 10, 380, 140, 140);
      sunGrad.addColorStop(0, '#FFFFFF');
      sunGrad.addColorStop(0.4, '#FDE047');
      sunGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(380, 140, 140, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0B0F19';
      ctx.beginPath();
      ctx.moveTo(32, 608);
      ctx.lineTo(120, 380);
      ctx.lineTo(220, 480);
      ctx.lineTo(340, 310);
      ctx.lineTo(472, 520);
      ctx.lineTo(472, 608);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 34px serif';
      ctx.fillText('SPECTRAL VISION', 510, 80);

      ctx.fillStyle = '#64748B';
      ctx.font = '14px sans-serif';
      ctx.fillText('EXPLORING OPTICAL DENSITY & COLOR COMPOSITION', 510, 110);

      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(510, 130);
      ctx.lineTo(920, 130);
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.font = '13px sans-serif';
      const lines = [
        'Chromatographic analysis reveals how pixels carry combined',
        'photometric weight across red, green, and blue receptors.',
        'In offset lithography and high-volume commercial printing,',
        'total ink coverage determines drying time, mechanical dot',
        'gain, and substrate saturation limits.',
      ];
      lines.forEach((l, i) => ctx.fillText(l, 510, 160 + i * 22));

      ctx.fillStyle = '#0284C7';
      ctx.fillRect(510, 290, 410, 95);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('TECHNICAL FOCUS // AREA COVERAGE', 530, 322);
      ctx.font = '12px monospace';
      ctx.fillText('Combined Channels: 0.00% to 100.00% RGB Distribution', 530, 348);
      ctx.fillText('TAC Equivalents: 0.00% to 400.00% Inks for CMYK Plates', 530, 368);

      ctx.fillStyle = '#05070A';
      ctx.fillRect(510, 410, 195, 120);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px monospace';
      ctx.fillText('DEEP SHADOW BOX', 525, 440);
      ctx.fillText('RGB: (5, 7, 10)', 525, 465);
      ctx.fillText('Comb: 2.87%', 525, 490);

      ctx.fillStyle = '#FAF5F0';
      ctx.fillRect(725, 410, 195, 120);
      ctx.strokeStyle = '#E2E8F0';
      ctx.strokeRect(725, 410, 195, 120);
      ctx.fillStyle = '#475569';
      ctx.font = '11px monospace';
      ctx.fillText('HIGH KEY BLOCK', 740, 440);
      ctx.fillText('RGB: (250, 245, 240)', 740, 465);
      ctx.fillText('Comb: 96.08%', 740, 490);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px monospace';
      ctx.fillText('PAGE 42 // COLOR REPRODUCTION & PRESS CONTROL', 510, 580);

      return {
        dataUrl: canvas.toDataURL('image/png'),
        fileName: 'Editorial_Magazine_Layout.png',
        profileInfo: {
          detectedMode: 'rgb',
          hasCmykProfile: false,
          profileName: 'Display P3 / sRGB',
          colorSpaceSignature: 'RGB ',
          numberOfComponents: 3,
          format: 'png',
          details: 'Standard RGB Editorial Composition (3 Components)',
        },
      };
    },
  },
];

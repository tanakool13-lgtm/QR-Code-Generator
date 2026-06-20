import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import QRCode from "qrcode";

// Calculate CRC-16 CCITT False checksum
function crc16CcittFalse(text: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Handle direct image/png generation endpoint
  const handleQrGeneration = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const status = req.query.status as string;
    const payload = req.query.payload as string;
    const w = req.query.w as string;
    const h = req.query.h as string;

    const isDirectQrEndpoint = req.path === '/api/qr';
    const isStatusD = status === 'd';

    if ((isDirectQrEndpoint || isStatusD) && payload) {
      try {
        // Calculate EMVCo CRC-16 Checksum and append
        const finalPayload = payload + crc16CcittFalse(payload);

        // Parse user dimensions style (defaults to 512px for clear mapping in PowerApps)
        const parseDimension = (val: string, defaultValue: number): number => {
          if (!val) return defaultValue;
          const cleaned = val.replace(/[^0-9]/g, '');
          const num = parseInt(cleaned, 10);
          return isNaN(num) || num <= 0 ? defaultValue : num;
        };

        const widthPx = parseDimension(w, 512);
        const heightPx = parseDimension(h, 512);
        const targetSize = Math.max(widthPx, heightPx);

        // Generate clear QR Code as a raw PNG binary Buffer
        const buffer = await QRCode.toBuffer(finalPayload, {
          width: targetSize,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#000000', // pure black
            light: '#ffffff' // pure white
          }
        });

        // Reply immediately with the required Content-Type header
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        return res.send(buffer);
      } catch (err: any) {
        console.error('QR Generator failed:', err);
        return res.status(500).type('text/plain').send(`QR Generation Error: ${err.message}`);
      }
    }

    next();
  };

  // Register image middleware on root and custom API route
  app.get('/api/qr', handleQrGeneration);
  app.get('/', handleQrGeneration);

  // Vite development integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on port ${PORT}`);
  });
}

startServer();

# SoilSense AI

A Next.js application for cautious, image-based observation of visible soil characteristics, with India-first and Andhra Pradesh context.

## Features
- Soil image upload (JPG, PNG, WebP; up to 8 MB)
- AI-assisted visual soil class, texture, color, apparent surface wetness, drainage clues, and visible organic matter clues
- Optional Indian state and district context
- Explicit limits: a photo does **not** measure actual moisture percentage, pH, N-P-K, electrical conductivity/salinity, or contaminants
- Responsive interface and server-side API key handling

## Run locally
Requirements: Node.js 20 or newer.

```bash
npm install
```

Create `.env.local` (never commit this file):

```env
GEMINI_API_KEY=your_google_gemini_api_key
```

Then run:

```bash
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel
1. Import this GitHub repository into Vercel, with the project root set to the repository root.
2. Add `GEMINI_API_KEY` under Project Settings → Environment Variables for Preview and Production.
3. Redeploy after adding or changing the key.

The API key is read only on the server. Never use a `NEXT_PUBLIC_` prefix for it.

## Scientific limitations
This prototype uses a vision-language model to describe visible evidence. It is **not** a validated agronomic classifier and must not be used as a substitute for laboratory testing. Apparent wetness is qualitative and cannot be converted into volumetric water content from a normal RGB photo. Soil pH, nutrients (N-P-K), salinity/EC, contaminants, and reliable crop/fertilizer recommendations require appropriate tests or validated models and data. Image appearance changes with lighting, camera, and sample preparation.

## Verification
Run `npm run build` before deployment. Live image analysis requires a valid `GEMINI_API_KEY` environment variable.

# SoilSense AI — soil image observations and measured-property support

A Next.js app for cautious soil-image observations, India-first with Andhra Pradesh context. It keeps visual estimates separate from manually entered sensor/laboratory measurements and can optionally call a separately deployed image-classification endpoint.

## What it does
- JPG, PNG, and WebP soil image upload (3 MB limit).
- Gemini vision observations: likely visual class, texture impression, color, apparent wetness, visible drainage clues, and organic-matter clues.
- Optional measurements from a calibrated sensor or lab report: moisture (% VWC), pH, N/P/K (mg/kg), and electrical conductivity (dS/m).
- Optional external image-classification endpoint, configured server-side, with label/score shown separately from the Gemini visual description.
- Server-side API keys, input validation, timeouts, and clear scientific limitations.

## Run locally
Requirements: Node.js 20 or newer.

```bash
npm install
```

Create `.env.local` (never commit this file):

```env
GEMINI_API_KEY=your_google_gemini_api_key
# Optional: an HTTPS image-classification inference endpoint that accepts raw image bytes
SOIL_CLASSIFIER_ENDPOINT=
SOIL_CLASSIFIER_TOKEN=
SOIL_CLASSIFIER_MODEL=
```

Then run `npm run dev` and open http://localhost:3000.

## Configure the optional classifier
Set `SOIL_CLASSIFIER_ENDPOINT` to your own deployed HTTPS inference endpoint. It must accept a POST request with the image bytes and the image MIME type as Content-Type, and return JSON in a format like `[{"label":"Red soil","score":0.82}]` or `{"predictions":[{"label":"Red soil","score":0.82}]}`. If authentication is required, set `SOIL_CLASSIFIER_TOKEN`. Set `SOIL_CLASSIFIER_MODEL` to a descriptive model identifier for display.

The adapter is deliberately optional: no model endpoint or model weights are bundled in this repository, and the app must not claim a validated model is active unless this endpoint is configured and returns a prediction. Any externally hosted classifier must be evaluated on a held-out, correctly labelled Indian dataset—preferably including Andhra Pradesh samples—before its output is treated as reliable.

## Deploy to Vercel
1. Import this repository into Vercel with the repository root as the project root.
2. Add `GEMINI_API_KEY` in Project Settings → Environment Variables for Preview and Production.
3. Optionally add the three `SOIL_CLASSIFIER_*` variables if a compatible classifier endpoint is already deployed.
4. Redeploy and verify a production build and real image request.

Never use a `NEXT_PUBLIC_` prefix for secret keys. Do not commit `.env.local`.

## Scientific limits
A normal RGB photo can suggest visible appearance but does not measure volumetric moisture, pH, nutrients, salinity/EC, or contamination. The measurement fields display values supplied by the user from a sensor or lab report; the app does not manufacture these values. Use a calibrated soil-moisture sensor for moisture percentage and an appropriate laboratory/soil-test method for chemistry. A model's confidence score is not the same as field accuracy.

## Relevant research and data context
- An Indian study reports a soil-image dataset of 392 soil samples collected from agricultural fields in Andhra Pradesh, with labels established using sieve and hydrometer analysis; its reported result is study-specific and should not be assumed to generalize to all phones, soils, or field conditions: https://www.sciencedirect.com/science/article/pii/S0957417423026878
- India's Open Government Data platform lists district/state soil-moisture data derived from a VIC model; this is modeled area-level data, not a reading from the uploaded soil sample: https://ap.data.gov.in/catalog/soil-moisture

## Verification
Run `npm run build` before deploying. The live image-analysis workflow requires a valid `GEMINI_API_KEY`. The optional classifier requires a deployed compatible endpoint and is not bundled with this repository.

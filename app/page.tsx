"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";

type Analysis = {
  soil_type: string;
  texture: string;
  color: string;
  moisture_visual: string;
  drainage_visual: string;
  organic_matter_visual: string;
  visible_properties: string[];
  cannot_determine: string[];
  confidence: string;
  explanation: string;
  regional_context: string;
};

const initialAnalysis: Analysis | null = null;

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [region, setRegion] = useState("Andhra Pradesh");
  const [district, setDistrict] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(initialAnalysis);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function chooseFile(next: File | undefined) {
    setError("");
    setAnalysis(null);
    if (!next) return;
    if (!next.type.startsWith("image/")) { setError("Please select a JPG, PNG, or WebP image."); return; }
    if (next.size > 8 * 1024 * 1024) { setError("Image is too large. Please use an image under 3 MB."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0]);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    chooseFile(event.dataTransfer.files?.[0]);
  }

  async function analyze() {
    if (!file) { setError("Upload a soil photo first."); return; }
    setLoading(true); setError(""); setAnalysis(null);
    try {
      const imageData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image."));
        reader.onerror = () => reject(new Error("Could not read image."));
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData, region, district }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed. Please try again.");
      setAnalysis(data.analysis as Analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error. Please try again.");
    } finally { setLoading(false); }
  }

  return (
    <main>
      <nav className="topbar">
        <a className="brand" href="#"><span className="brand-icon">S</span><span>SoilSense <b>AI</b><small>FIELD INTELLIGENCE</small></span></a>
        <span className="region-pill"><span className="pulse" /> INDIA-FIRST · ANDHRA PRADESH</span>
      </nav>

      <section className="hero">
        <div className="eyebrow"><span /> SOIL IMAGE INTELLIGENCE</div>
        <h1>Know your soil.<br /><em>Grow with confidence.</em></h1>
        <p className="hero-copy">Upload a clear soil photo to explore its visible soil type, texture, color, and apparent moisture. Designed with Indian farming conditions in mind.</p>
        <div className="trust-row"><span>✳ Image-based analysis</span><span>✳ Andhra Pradesh context</span><span>✳ Honest confidence limits</span></div>
      </section>

      <section className="workspace">
        <div className="panel upload-panel">
          <div className="section-head"><div><span className="step">01</span><h2>Upload soil image</h2></div><span className="required">REQUIRED</span></div>
          <p className="muted">For best results, photograph exposed soil in natural daylight. Avoid filters and include a close-up of the soil surface.</p>
          <div className={`dropzone ${preview ? "has-image" : ""}`} onDragOver={e => e.preventDefault()} onDrop={onDrop} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} hidden />
            {preview ? <><img src={preview} alt="Selected soil sample preview" className="preview-image" /><div className="image-overlay"><span>↻ Change image</span></div></> : <div className="upload-placeholder"><div className="upload-icon">↑</div><strong>Drop your soil photo here</strong><span>or <u>browse files</u></span><small>JPG, PNG or WebP · Maximum 3 MB</small></div>}
          </div>
          {file && <div className="file-row"><span className="file-icon">▧</span><div><b>{file.name}</b><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></div><button className="remove" onClick={e => { e.stopPropagation(); if (preview) URL.revokeObjectURL(preview); setFile(null); setPreview(""); setAnalysis(null); }} aria-label="Remove image">×</button></div>}
          <div className="section-head region-head"><div><span className="step">02</span><h2>Sample location</h2></div><span className="optional">OPTIONAL</span></div>
          <div className="field-grid">
            <label>State / region<select value={region} onChange={e => setRegion(e.target.value)}><option>Andhra Pradesh</option><option>Telangana</option><option>Tamil Nadu</option><option>Karnataka</option><option>Kerala</option><option>Maharashtra</option><option>Odisha</option><option>Other Indian state</option><option>Outside India</option></select></label>
            <label>District (if known)<input value={district} onChange={e => setDistrict(e.target.value)} placeholder="e.g. Kadapa" maxLength={80} /></label>
          </div>
          <button className="analyze-button" onClick={analyze} disabled={!file || loading}>{loading ? <><span className="spinner" /> Examining image…</> : <>Analyze soil image <span>→</span></>}</button>
          <p className="privacy-note">Your image is sent securely to the configured AI vision provider for analysis. Do not upload personal or sensitive photos.</p>
          {error && <div className="error-box" role="alert"><b>Could not analyze image</b><p>{error}</p>{error.toLowerCase().includes("api key") && <p>Set <code>GEMINI_API_KEY</code> in your Vercel project environment variables, then redeploy.</p>}</div>}
        </div>

        <div className="panel results-panel">
          <div className="section-head"><div><span className="step">03</span><h2>Soil insights</h2></div><span className={`status ${analysis ? "status-done" : ""}`}>{analysis ? "ANALYSIS READY" : "AWAITING IMAGE"}</span></div>
          {!analysis ? <div className="empty-state"><div className="soil-art"><div className="sun" /><div className="soil-layer layer-one" /><div className="soil-layer layer-two" /><div className="soil-layer layer-three" /><span className="sprout">♧</span></div><h3>Your soil story starts here</h3><p>Upload a soil photo and run the analysis to see visible characteristics and regional context here.</p><div className="empty-checks"><span>○ Soil type & texture</span><span>○ Apparent surface moisture</span><span>○ Visible properties & limitations</span></div></div> : <div className="results-content">
            <div className="classification-card"><span className="mini-label">LIKELY VISUAL CLASS</span><h3>{analysis.soil_type}</h3><p>{analysis.explanation}</p><div className="confidence"><span>Visual confidence</span><b>{analysis.confidence}</b></div><small>AI visual estimate — not a laboratory result.</small></div>
            <div className="metric-grid">
              <div className="metric"><span className="metric-symbol">◈</span><small>TEXTURE</small><b>{analysis.texture}</b></div>
              <div className="metric"><span className="metric-symbol">◉</span><small>COLOR</small><b>{analysis.color}</b></div>
              <div className="metric"><span className="metric-symbol">◌</span><small>APPARENT MOISTURE</small><b>{analysis.moisture_visual}</b></div>
              <div className="metric"><span className="metric-symbol">⌁</span><small>VISIBLE DRAINAGE CLUES</small><b>{analysis.drainage_visual}</b></div>
            </div>
            <div className="detail-block"><h4>Visible properties</h4><ul>{analysis.visible_properties?.map((x,i) => <li key={i}>{x}</li>)}</ul></div>
            <div className="detail-block"><h4>Organic matter clues</h4><p>{analysis.organic_matter_visual}</p></div>
            <div className="detail-block regional"><h4>Regional context</h4><p>{analysis.regional_context}</p></div>
            <div className="warning-block"><b>What a photo cannot reliably tell you</b><ul>{analysis.cannot_determine?.map((x,i) => <li key={i}>{x}</li>)}</ul></div>
            <button className="secondary-button" onClick={() => { setAnalysis(null); }}>Analyze another image ↗</button>
          </div>}
        </div>
      </section>
      <section className="reality-check"><div className="reality-icon">i</div><div><b>Important: image analysis is not a soil lab test.</b><p>A photograph can suggest visible soil characteristics and apparent wetness, but it cannot accurately measure volumetric water content, pH, N-P-K nutrients, electrical conductivity, or contamination. Use a calibrated moisture sensor and an accredited soil test for those measurements.</p></div></section>
      <footer><span>SoilSense AI <b>·</b> Built for Indian field conditions</span><span>Research prototype · Verify before making farm decisions</span></footer>
    </main>
  );
}

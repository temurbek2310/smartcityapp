import os
import subprocess
import tempfile
from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(REPO_ROOT, "public")
ICONS_DIR = os.path.join(PUBLIC_DIR, "icons")
OG_DIR = os.path.join(PUBLIC_DIR, "og")
CHROME_BIN = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

os.makedirs(ICONS_DIR, exist_ok=True)
os.makedirs(OG_DIR, exist_ok=True)

APPLE_ICON_HTML = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 180px;
    height: 180px;
    overflow: hidden;
    background: #080E1C;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .container {
    width: 180px;
    height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at 50% 30%, #152442 0%, #0F172A 55%, #080E1C 100%);
  }
  svg {
    width: 180px;
    height: 180px;
  }
</style>
</head>
<body>
<div class="container">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="scIndigo" x1="120" y1="120" x2="380" y2="390" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#A78BFA"/>
      <stop offset="45%" stop-color="#6C47E0"/>
      <stop offset="100%" stop-color="#4326A6"/>
    </linearGradient>

    <linearGradient id="scTeal" x1="140" y1="120" x2="370" y2="380" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="50%" stop-color="#06B6D4"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>

    <linearGradient id="scBeam" x1="330" y1="100" x2="400" y2="180" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7DF8E8"/>
      <stop offset="100%" stop-color="#06B6D4"/>
    </linearGradient>

    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#6C47E0" flood-opacity="0.45"/>
    </filter>
  </defs>

  <!-- Ambient pulse -->
  <circle cx="366" cy="146" r="75" fill="url(#scBeam)" opacity="0.16"/>
  <circle cx="256" cy="256" r="150" fill="#6C47E0" opacity="0.15"/>

  <!-- Centered emblem scaled for Apple touch icon safe margin -->
  <g transform="translate(256, 256) scale(0.80) translate(-256, -270)" filter="url(#glow)">
    <!-- Architectural Smart Skyline Backdrop -->
    <rect x="208" y="208" width="24" height="106" rx="6" fill="url(#scTeal)" opacity="0.32"/>
    <rect x="244" y="166" width="24" height="148" rx="6" fill="url(#scTeal)" opacity="0.5"/>
    <rect x="280" y="196" width="24" height="118" rx="6" fill="url(#scTeal)" opacity="0.36"/>

    <!-- Primary 'S' Monogram - Upper Curve -->
    <path d="M352 168 C338 140, 302 124, 252 124 C184 124, 146 162, 146 208 C146 250, 180 274, 238 290 L274 300 C322 314, 348 334, 348 372 C348 418, 308 444, 248 444 C192 444, 154 416, 142 388" 
          fill="none" 
          stroke="url(#scIndigo)" 
          stroke-width="50" 
          stroke-linecap="round" 
          stroke-linejoin="round"/>

    <!-- High-Tech Neon Flow Core -->
    <path d="M346 172 C330 144, 298 132, 252 132 C190 132, 156 166, 156 208 C156 244, 186 266, 242 282 L278 292 C328 308, 356 332, 356 372 C356 422, 314 444, 248 444 C196 444, 160 418, 148 392" 
          fill="none" 
          stroke="url(#scTeal)" 
          stroke-width="16" 
          stroke-linecap="round" 
          stroke-linejoin="round"/>

    <!-- Central Transit Waypoints (Flow dots) -->
    <circle cx="252" cy="132" r="7.5" fill="#FFFFFF"/>
    <circle cx="260" cy="287" r="7.5" fill="#FFFFFF"/>
    <circle cx="248" cy="444" r="7.5" fill="#FFFFFF"/>

    <!-- Smart Beacon / Location Node (Top-right pulse) -->
    <circle cx="366" cy="146" r="30" fill="url(#scTeal)"/>
    <circle cx="366" cy="146" r="14" fill="#FFFFFF"/>
    <circle cx="366" cy="146" r="46" fill="none" stroke="#38BDF8" stroke-width="3.5" stroke-dasharray="7 5" opacity="0.85"/>
  </g>
</svg>
</div>
</body>
</html>
"""

SMARTCITY_OG_HTML = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 1200px;
    height: 630px;
    overflow: hidden;
    background: #080E1C;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #F8FAFC;
    -webkit-font-smoothing: antialiased;
  }
  .card {
    position: relative;
    width: 1200px;
    height: 630px;
    background: #080E1C;
    background-image: 
      radial-gradient(ellipse 650px 500px at 85% 50%, rgba(108, 71, 224, 0.22) 0%, transparent 70%),
      radial-gradient(ellipse 500px 400px at 15% 20%, rgba(6, 182, 212, 0.15) 0%, transparent 65%),
      radial-gradient(circle at 50% 100%, rgba(15, 23, 42, 0.8) 0%, transparent 100%);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 72px 84px;
    overflow: hidden;
  }

  /* Grid overlay */
  .grid-bg {
    position: absolute;
    inset: 0;
    background-size: 48px 48px;
    background-image: 
      linear-gradient(to right, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
    pointer-events: none;
    z-index: 1;
  }

  /* Content area */
  .content {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex: 1;
  }

  .left-col {
    max-width: 640px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: rgba(6, 182, 212, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.35);
    padding: 8px 18px;
    border-radius: 9999px;
    width: fit-content;
  }

  .badge-dot {
    width: 8px;
    height: 8px;
    background: #06B6D4;
    border-radius: 50%;
    box-shadow: 0 0 10px #38BDF8;
  }

  .badge-text {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #38BDF8;
  }

  .brand-title {
    font-size: 68px;
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: -1.5px;
  }

  .title-smart {
    color: #FFFFFF;
  }

  .title-city {
    background: linear-gradient(135deg, #38BDF8 0%, #818CF8 50%, #C084FC 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .tagline {
    font-size: 24px;
    font-weight: 600;
    color: #E2E8F0;
    line-height: 1.35;
  }

  .desc {
    font-size: 16px;
    line-height: 1.55;
    color: #94A3B8;
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 6px;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(30, 41, 59, 0.65);
    border: 1px solid rgba(71, 85, 105, 0.45);
    backdrop-filter: blur(8px);
    padding: 8px 16px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    color: #CBD5E1;
  }

  .pill-icon {
    font-size: 15px;
  }

  /* Right column: emblem */
  .right-col {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 380px;
    height: 380px;
  }

  .emblem-glow {
    position: absolute;
    width: 360px;
    height: 360px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(108, 71, 224, 0.35) 0%, rgba(6, 182, 212, 0.15) 50%, transparent 70%);
    filter: blur(24px);
    z-index: -1;
  }

  .emblem-ring {
    position: absolute;
    width: 390px;
    height: 390px;
    border-radius: 50%;
    border: 1px dashed rgba(56, 189, 248, 0.25);
    z-index: -1;
  }

  /* Footer bar */
  .footer {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 24px;
    border-top: 1px solid rgba(51, 65, 85, 0.5);
    font-size: 15px;
  }

  .footer-cities {
    display: flex;
    align-items: center;
    gap: 16px;
    color: #64748B;
    font-weight: 500;
  }

  .city-active {
    color: #94A3B8;
  }

  .footer-meta {
    display: flex;
    align-items: center;
    gap: 20px;
    font-family: "JetBrains Mono", Consolas, monospace;
    color: #38BDF8;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
</style>
</head>
<body>
<div class="card">
  <div class="grid-bg"></div>

  <div class="content">
    <div class="left-col">
      <div class="badge">
        <div class="badge-dot"></div>
        <div class="badge-text">Smart Urban Mobility • Uzbekistan</div>
      </div>

      <div>
        <h1 class="brand-title">
          <span class="title-smart">Smart</span><span class="title-city">City</span>
        </h1>
        <p class="tagline">Next-Gen Smart Parking Platform</p>
      </div>

      <p class="desc">
        O‘zbekistonda parking topish, bo‘sh joylarni onlayn ko‘rish, oldindan bron qilish va qulay to‘lash uchun yagona aqlli tizim.
      </p>

      <div class="pills">
        <div class="pill">
          <span class="pill-icon">⚡</span>
          <span>Jonli bo‘sh joylar</span>
        </div>
        <div class="pill">
          <span class="pill-icon">📍</span>
          <span>1-Tap Navigatsiya</span>
        </div>
        <div class="pill">
          <span class="pill-icon">⏱️</span>
          <span>Oldindan bron qilish</span>
        </div>
        <div class="pill">
          <span class="pill-icon">💳</span>
          <span>Click • Payme • Uzum</span>
        </div>
      </div>
    </div>

    <div class="right-col">
      <div class="emblem-glow"></div>
      <div class="emblem-ring"></div>

      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="340" height="340">
        <defs>
          <linearGradient id="ogIndigo" x1="120" y1="120" x2="380" y2="390" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#A78BFA"/>
            <stop offset="45%" stop-color="#6C47E0"/>
            <stop offset="100%" stop-color="#472BB3"/>
          </linearGradient>

          <linearGradient id="ogTeal" x1="140" y1="120" x2="370" y2="380" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#38BDF8"/>
            <stop offset="50%" stop-color="#06B6D4"/>
            <stop offset="100%" stop-color="#10B981"/>
          </linearGradient>

          <linearGradient id="ogBeam" x1="330" y1="100" x2="400" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#7DF8E8"/>
            <stop offset="100%" stop-color="#06B6D4"/>
          </linearGradient>

          <filter id="ogShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#030712" flood-opacity="0.6"/>
          </filter>
        </defs>

        <!-- Ambient pulse -->
        <circle cx="366" cy="146" r="62" fill="url(#ogBeam)" opacity="0.18"/>
        <circle cx="256" cy="256" r="140" fill="#6C47E0" opacity="0.15"/>

        <g filter="url(#ogShadow)">
          <!-- Architectural Smart Skyline Backdrop -->
          <rect x="208" y="208" width="24" height="106" rx="6" fill="url(#ogTeal)" opacity="0.32"/>
          <rect x="244" y="166" width="24" height="148" rx="6" fill="url(#ogTeal)" opacity="0.5"/>
          <rect x="280" y="196" width="24" height="118" rx="6" fill="url(#ogTeal)" opacity="0.36"/>

          <!-- Primary 'S' Monogram - Upper Curve -->
          <path d="M352 168 C338 140, 302 124, 252 124 C184 124, 146 162, 146 208 C146 250, 180 274, 238 290 L274 300 C322 314, 348 334, 348 372 C348 418, 308 444, 248 444 C192 444, 154 416, 142 388" 
                fill="none" 
                stroke="url(#ogIndigo)" 
                stroke-width="48" 
                stroke-linecap="round" 
                stroke-linejoin="round"/>

          <!-- High-Tech Neon Flow Core -->
          <path d="M346 172 C330 144, 298 132, 252 132 C190 132, 156 166, 156 208 C156 244, 186 266, 242 282 L278 292 C328 308, 356 332, 356 372 C356 422, 314 444, 248 444 C196 444, 160 418, 148 392" 
                fill="none" 
                stroke="url(#ogTeal)" 
                stroke-width="16" 
                stroke-linecap="round" 
                stroke-linejoin="round"/>

          <!-- Central Transit Waypoints (Flow dots) -->
          <circle cx="252" cy="132" r="7" fill="#FFFFFF"/>
          <circle cx="260" cy="287" r="7" fill="#FFFFFF"/>
          <circle cx="248" cy="444" r="7" fill="#FFFFFF"/>

          <!-- Smart Beacon / Location Node (Top-right pulse) -->
          <circle cx="366" cy="146" r="30" fill="url(#ogTeal)"/>
          <circle cx="366" cy="146" r="14" fill="#FFFFFF"/>
          <circle cx="366" cy="146" r="46" fill="none" stroke="#38BDF8" stroke-width="3" stroke-dasharray="7 5" opacity="0.8"/>
        </g>
      </svg>
    </div>
  </div>

  <div class="footer">
    <div class="footer-cities">
      <span class="city-active">Toshkent</span>
      <span>•</span>
      <span>Samarqand</span>
      <span>•</span>
      <span>Buxoro</span>
      <span>•</span>
      <span>Farg‘ona</span>
    </div>
    <div class="footer-meta">
      <span>smartcity.uz</span>
    </div>
  </div>
</div>
</body>
</html>
"""

def render_html_to_png(html_content, target_path, width, height):
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(html_content)
        temp_html = f.name

    temp_png = temp_html.replace(".html", ".png")

    try:
        cmd = [
            CHROME_BIN,
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            f"--window-size={width},{height}",
            f"--screenshot={temp_png}",
            f"file:///{os.path.abspath(temp_html).replace(os.sep, '/')}"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"Chrome failed with code {res.returncode}: {res.stderr}")

        if not os.path.exists(temp_png):
            raise FileNotFoundError(f"Screenshot file was not created: {temp_png}")

        with Image.open(temp_png) as im:
            # Crop/resize exactly to target size if window decoration added any offset
            cropped = im.crop((0, 0, width, height))
            cropped.save(target_path, "PNG", optimize=True)

        size = os.path.getsize(target_path)
        print(f"Successfully generated {target_path} ({width}x{height}, {size:,} bytes)")
    finally:
        if os.path.exists(temp_html):
            os.remove(temp_html)
        if os.path.exists(temp_png):
            os.remove(temp_png)

if __name__ == "__main__":
    apple_icon_path = os.path.join(ICONS_DIR, "apple-touch-icon.png")
    og_image_path = os.path.join(OG_DIR, "smartcity-og.png")

    print("Generating apple-touch-icon.png (180x180)...")
    render_html_to_png(APPLE_ICON_HTML, apple_icon_path, 180, 180)

    print("Generating smartcity-og.png (1200x630)...")
    render_html_to_png(SMARTCITY_OG_HTML, og_image_path, 1200, 630)

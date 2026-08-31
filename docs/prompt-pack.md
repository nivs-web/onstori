# Gemini 앱용 프롬프트 팩 (API 결제 대기 중 무료 생성 워크플로)

**사용법 (AI Pro 구독 = 앱에서 무료):**
1. [gemini.google.com](https://gemini.google.com) 접속 → 아래 프롬프트를 복사해 이미지 생성 (한 프롬프트로 2~4장씩 변형 요청 가능: "4 variations")
2. 마음에 드는 것만 다운로드 → 폴더에 모으기 (예: `C:/bank-drop/interior-hero/`)
3. 등록: `npx tsx --env-file=.env.local scripts/bank-ingest.ts --dir C:/bank-drop/interior-hero --industry interior --mood clean --role hero`
4. https://onstori.com/admin/bank 에서 검수(승인/점수) → 즉시 생성기에 반영

**팁:** 히어로가 최우선(각 업종 4~8장 목표). 이상하게 나온 건 다운로드하지 말 것 — 선별이 품질을 만듭니다.
글자·워터마크가 박히면 버리세요. 업로드 시 자동으로 중복 검사·WebP 변환됩니다.

---

## 인테리어 (--industry interior)

### 히어로 (--role hero --mood clean)

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: freshly renovated Korean apartment living room with new flooring and built-in storage. Bright neutral daylight, white and light-gray palette, airy, minimal styling. morning light, eye-level angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: modern kitchen renovation with matte cabinets and tiled backsplash. Bright neutral daylight, white and light-gray palette, airy, minimal styling. late afternoon light, slightly low angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

### 갤러리 (--role gallery --mood clean)

```
4:3 or square detail shot, editorial photography, one clear subject, tight composition, natural imperfections kept for realism. Scene: modern kitchen renovation with matte cabinets and tiled backsplash. Bright neutral daylight, white and light-gray palette, airy, minimal styling. overcast soft light, three-quarter view. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

## 건설·시공 (--industry construction)

### 히어로 (--role hero --mood clean)

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: small commercial building under neat renovation with scaffolding. Bright neutral daylight, white and light-gray palette, airy, minimal styling. morning light, eye-level angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: newly finished storefront exterior with clean lines. Bright neutral daylight, white and light-gray palette, airy, minimal styling. late afternoon light, slightly low angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

### 갤러리 (--role gallery --mood clean)

```
4:3 or square detail shot, editorial photography, one clear subject, tight composition, natural imperfections kept for realism. Scene: newly finished storefront exterior with clean lines. Bright neutral daylight, white and light-gray palette, airy, minimal styling. overcast soft light, three-quarter view. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

## 도배·장판 (--industry wallpaper)

### 히어로 (--role hero --mood clean)

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: wallpaper rolls and smoothing tools on a clean workbench. Bright neutral daylight, white and light-gray palette, airy, minimal styling. morning light, eye-level angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: freshly papered bright room corner with perfect seams. Bright neutral daylight, white and light-gray palette, airy, minimal styling. late afternoon light, slightly low angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

### 갤러리 (--role gallery --mood clean)

```
4:3 or square detail shot, editorial photography, one clear subject, tight composition, natural imperfections kept for realism. Scene: freshly papered bright room corner with perfect seams. Bright neutral daylight, white and light-gray palette, airy, minimal styling. overcast soft light, three-quarter view. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

## 타일·욕실 (--industry tile)

### 히어로 (--role hero --mood clean)

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: large-format porcelain tiles freshly laid in a bathroom. Bright neutral daylight, white and light-gray palette, airy, minimal styling. morning light, eye-level angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: mosaic tile detail with perfect grout lines. Bright neutral daylight, white and light-gray palette, airy, minimal styling. late afternoon light, slightly low angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

### 갤러리 (--role gallery --mood clean)

```
4:3 or square detail shot, editorial photography, one clear subject, tight composition, natural imperfections kept for realism. Scene: mosaic tile detail with perfect grout lines. Bright neutral daylight, white and light-gray palette, airy, minimal styling. overcast soft light, three-quarter view. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

## 전기 (--industry electric)

### 히어로 (--role hero --mood clean)

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: neatly organized electrical panel with labeled breakers. Bright neutral daylight, white and light-gray palette, airy, minimal styling. morning light, eye-level angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: recessed ceiling lights in a freshly finished room. Bright neutral daylight, white and light-gray palette, airy, minimal styling. late afternoon light, slightly low angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

### 갤러리 (--role gallery --mood clean)

```
4:3 or square detail shot, editorial photography, one clear subject, tight composition, natural imperfections kept for realism. Scene: recessed ceiling lights in a freshly finished room. Bright neutral daylight, white and light-gray palette, airy, minimal styling. overcast soft light, three-quarter view. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

## 설비·배관 (--industry plumbing)

### 히어로 (--role hero --mood clean)

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: gleaming copper and PVC pipework neatly installed. Bright neutral daylight, white and light-gray palette, airy, minimal styling. morning light, eye-level angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: modern boiler installation in a clean utility room. Bright neutral daylight, white and light-gray palette, airy, minimal styling. late afternoon light, slightly low angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

### 갤러리 (--role gallery --mood clean)

```
4:3 or square detail shot, editorial photography, one clear subject, tight composition, natural imperfections kept for realism. Scene: modern boiler installation in a clean utility room. Bright neutral daylight, white and light-gray palette, airy, minimal styling. overcast soft light, three-quarter view. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

## 가구제작 (--industry furniture)

### 히어로 (--role hero --mood warm)

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: custom built-in wardrobe in light oak, just installed. Golden-hour warm light, beige and wood tones, cozy and inviting. morning light, eye-level angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: woodworking bench with chisels and wood shavings. Golden-hour warm light, beige and wood tones, cozy and inviting. late afternoon light, slightly low angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

### 갤러리 (--role gallery --mood warm)

```
4:3 or square detail shot, editorial photography, one clear subject, tight composition, natural imperfections kept for realism. Scene: woodworking bench with chisels and wood shavings. Golden-hour warm light, beige and wood tones, cozy and inviting. overcast soft light, three-quarter view. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

## 청소 (--industry cleaning)

### 히어로 (--role hero --mood clean)

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: sunlit empty apartment freshly deep-cleaned, sparkling floor. Bright neutral daylight, white and light-gray palette, airy, minimal styling. morning light, eye-level angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: professional cleaning caddy with eco supplies, no labels. Bright neutral daylight, white and light-gray palette, airy, minimal styling. late afternoon light, slightly low angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

### 갤러리 (--role gallery --mood clean)

```
4:3 or square detail shot, editorial photography, one clear subject, tight composition, natural imperfections kept for realism. Scene: professional cleaning caddy with eco supplies, no labels. Bright neutral daylight, white and light-gray palette, airy, minimal styling. overcast soft light, three-quarter view. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

## 이사 (--industry moving)

### 히어로 (--role hero --mood clean)

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: neatly stacked moving boxes in a bright empty room. Bright neutral daylight, white and light-gray palette, airy, minimal styling. morning light, eye-level angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: moving truck interior loaded with blanket-wrapped furniture. Bright neutral daylight, white and light-gray palette, airy, minimal styling. late afternoon light, slightly low angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

### 갤러리 (--role gallery --mood clean)

```
4:3 or square detail shot, editorial photography, one clear subject, tight composition, natural imperfections kept for realism. Scene: moving truck interior loaded with blanket-wrapped furniture. Bright neutral daylight, white and light-gray palette, airy, minimal styling. overcast soft light, three-quarter view. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

## 수리 (--industry repair)

### 히어로 (--role hero --mood clean)

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: well-worn quality hand tools arranged on canvas roll. Bright neutral daylight, white and light-gray palette, airy, minimal styling. morning light, eye-level angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: repaired door hinge close-up, clean workmanship. Bright neutral daylight, white and light-gray palette, airy, minimal styling. late afternoon light, slightly low angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

### 갤러리 (--role gallery --mood clean)

```
4:3 or square detail shot, editorial photography, one clear subject, tight composition, natural imperfections kept for realism. Scene: repaired door hinge close-up, clean workmanship. Bright neutral daylight, white and light-gray palette, airy, minimal styling. overcast soft light, three-quarter view. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

## 설치 (--industry install)

### 히어로 (--role hero --mood clean)

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: new window frames freshly installed with clean sealant lines. Bright neutral daylight, white and light-gray palette, airy, minimal styling. morning light, eye-level angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: air-conditioning unit neatly mounted, cabling hidden. Bright neutral daylight, white and light-gray palette, airy, minimal styling. late afternoon light, slightly low angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

### 갤러리 (--role gallery --mood clean)

```
4:3 or square detail shot, editorial photography, one clear subject, tight composition, natural imperfections kept for realism. Scene: air-conditioning unit neatly mounted, cabling hidden. Bright neutral daylight, white and light-gray palette, airy, minimal styling. overcast soft light, three-quarter view. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

## 렌탈 (--industry rental)

### 히어로 (--role hero --mood clean)

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: clean stack of rental equipment in an organized warehouse. Bright neutral daylight, white and light-gray palette, airy, minimal styling. morning light, eye-level angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

### 갤러리 (--role gallery --mood clean)

```
4:3 or square detail shot, editorial photography, one clear subject, tight composition, natural imperfections kept for realism. Scene: clean stack of rental equipment in an organized warehouse. Bright neutral daylight, white and light-gray palette, airy, minimal styling. overcast soft light, three-quarter view. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

## 카페 (--industry cafe)

### 히어로 (--role hero --mood warm)

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: specialty coffee bar with espresso machine and warm wood counter. Golden-hour warm light, beige and wood tones, cozy and inviting. morning light, eye-level angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: latte art being poured, close-up, steam rising. Golden-hour warm light, beige and wood tones, cozy and inviting. late afternoon light, slightly low angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

### 갤러리 (--role gallery --mood warm)

```
4:3 or square detail shot, editorial photography, one clear subject, tight composition, natural imperfections kept for realism. Scene: latte art being poured, close-up, steam rising. Golden-hour warm light, beige and wood tones, cozy and inviting. overcast soft light, three-quarter view. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

## 식당 (--industry restaurant)

### 히어로 (--role hero --mood warm)

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: korean charcoal grill table with glowing embers, appetizing. Golden-hour warm light, beige and wood tones, cozy and inviting. morning light, eye-level angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

```
Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay. Scene: chef's hands plating a beautiful dish, no face. Golden-hour warm light, beige and wood tones, cozy and inviting. late afternoon light, slightly low angle. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

### 갤러리 (--role gallery --mood warm)

```
4:3 or square detail shot, editorial photography, one clear subject, tight composition, natural imperfections kept for realism. Scene: chef's hands plating a beautiful dish, no face. Golden-hour warm light, beige and wood tones, cozy and inviting. overcast soft light, three-quarter view. Photorealistic, ultra high quality. No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.
```

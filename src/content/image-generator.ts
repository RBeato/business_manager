/**
 * Blog Image Generator
 * Uses Google Gemini API (nano banana) to generate featured images for blog posts
 * Cost: ~$0.03 per image
 */

import * as fs from 'fs'
import * as path from 'path'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const MODEL = 'gemini-2.5-flash-image'

type Website = 'healthopenpage' | 'meditnation' | 'riffroutine'

const IMAGE_STYLE_CONFIG: Record<Website, {
  style: string
  subjects: string
  palette: string
  avoid: string
}> = {
  healthopenpage: {
    style: 'Professional medical illustration, clean modern design, soft gradients, photorealistic quality',
    subjects: 'lab equipment, healthy lifestyle scenes, medical illustrations, biomarker visualizations, blood test tubes, microscopes, health dashboards',
    palette: 'Blue and white tones, clinical but warm, teal accents, soft lighting',
    avoid: 'No photos of real patients, no scary medical imagery, no text in image, no watermarks, no logos',
  },
  meditnation: {
    style: 'Serene digital art, peaceful atmosphere, soft warm lighting, dreamy quality',
    subjects: 'meditation poses, peaceful nature scenes, zen gardens, mindfulness imagery, calm water, lotus flowers, sunrise/sunset',
    palette: 'Golden yellows, soft purples, warm earth tones, pastel gradients',
    avoid: 'No religious symbols, no text in image, no faces showing strain, no watermarks, no logos',
  },
  riffroutine: {
    style: 'Dynamic illustration, energetic, music-themed, modern digital art, cinematic lighting',
    subjects: 'electric guitars, acoustic guitars, musicians practicing, music studios, amplifiers, guitar fretboards, concert stages',
    palette: 'Violet and purple tones, dark backgrounds with vibrant accents, neon highlights',
    avoid: 'No brand logos, no text in image, no copyrighted guitar designs, no watermarks',
  },
}

const WEBSITE_PATHS: Record<Website, string> = {
  healthopenpage: '/Users/rbsou/Documents/CODE/open_page',
  meditnation: '/Users/rbsou/Documents/CODE/meditnation_website',
  riffroutine: '/Users/rbsou/Documents/CODE/riff_routine',
}

interface GenerateBlogImageParams {
  title: string
  website: Website
  slug: string
  targetKeyword?: string
}

/**
 * Generate a featured blog image using Google Gemini API
 * Saves the image to the target website's /public/images/blog/ directory
 */
export async function generateBlogImage(params: GenerateBlogImageParams): Promise<{
  imagePath: string
  relativePath: string
  imageBuffer: Buffer
}> {
  const { title, website, slug, targetKeyword } = params

  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY || process.env.NANO_BANANA_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_AI_STUDIO_API_KEY not set in .env')
  }

  const styleConfig = IMAGE_STYLE_CONFIG[website]

  const prompt = `Generate a featured blog image for an article titled "${title}".
Topic: ${targetKeyword || title}

Style requirements:
- ${styleConfig.style}
- Professional quality, suitable as a hero image on a blog
- ${styleConfig.palette}
- Clean composition with clear focal point

Subject matter: ${styleConfig.subjects}
Related to: ${title}

${styleConfig.avoid}`

  console.log(`[Image] Generating for "${title.substring(0, 50)}..."`)

  const response = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: `Generate an image: ${prompt}` }],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '16:9' },
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  const imagePart = parts.find((p: { inlineData?: { mimeType: string; data: string } }) =>
    p.inlineData?.mimeType?.startsWith('image/')
  )

  if (!imagePart?.inlineData?.data) {
    throw new Error('No image generated in response')
  }

  const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64')

  // Save to the website's public/images/blog/ directory
  const websitePath = WEBSITE_PATHS[website]
  const imageDir = path.join(websitePath, 'public/images/blog')
  fs.mkdirSync(imageDir, { recursive: true })

  const imagePath = path.join(imageDir, `${slug}.png`)
  fs.writeFileSync(imagePath, imageBuffer)

  const relativePath = `/images/blog/${slug}.png`
  console.log(`[Image] Saved: ${imagePath}`)

  return { imagePath, relativePath, imageBuffer }
}

/**
 * Check if a blog image already exists for a given slug (checks .png and .jpg)
 */
export function blogImageExists(website: Website, slug: string): boolean {
  const websitePath = WEBSITE_PATHS[website]
  const dir = path.join(websitePath, 'public/images/blog')
  return fs.existsSync(path.join(dir, `${slug}.png`)) || fs.existsSync(path.join(dir, `${slug}.jpg`))
}

/**
 * Get the image extension for an existing blog image
 */
export function getBlogImageExt(website: Website, slug: string): string | null {
  const websitePath = WEBSITE_PATHS[website]
  const dir = path.join(websitePath, 'public/images/blog')
  if (fs.existsSync(path.join(dir, `${slug}.png`))) return 'png'
  if (fs.existsSync(path.join(dir, `${slug}.jpg`))) return 'jpg'
  return null
}

// --- Routine Cover Image Generation ---

interface RoutineCoverStyle {
  style: string
  palette: string
}

const ROUTINE_COVER_STYLES: Record<string, RoutineCoverStyle> = {
  jazz: {
    style: 'A smoky jazz club corner — a single spotlight illuminating an empty microphone stand and a worn barstool, with blurred cocktail glasses and vinyl records in the background. Intimate, cinematic.',
    palette: 'Warm amber, deep brown, soft gold, muted cream',
  },
  rock: {
    style: 'A pair of drumsticks crossed on a snare drum, with stage lights casting dramatic red and orange beams through haze in the background. Raw, energetic, concert atmosphere.',
    palette: 'Deep red, charcoal black, steel gray, fiery orange',
  },
  blues: {
    style: 'A neon "BLUES" sign glowing in a rain-soaked window at night, reflected in puddles on the sidewalk. Moody, soulful, urban.',
    palette: 'Deep indigo, electric blue neon, warm amber reflections, dark asphalt gray',
  },
  song: {
    style: 'An overhead shot of handwritten sheet music on aged paper, with a cup of black coffee and a pencil beside it. Morning light streaming in. Studious, focused.',
    palette: 'Cream, sepia, dark charcoal, warm bronze',
  },
  classical: {
    style: 'A grand piano lid reflecting candlelight in a dimly lit concert hall. Elegant, timeless, refined atmosphere.',
    palette: 'Deep black, warm ivory, rich mahogany, soft candlelight gold',
  },
}

// Per-routine overrides for maximum visual variety
const ROUTINE_COVER_OVERRIDES: Record<string, RoutineCoverStyle> = {
  'template-jazz-beginner': {
    style: 'A close-up of piano keys with soft golden light falling across them, a few jazz chord charts blurred in the background. Warm, inviting, beginner-friendly.',
    palette: 'Ivory, warm gold, soft black, honey amber',
  },
  'template-rock-beginner': {
    style: 'A single guitar pick resting on a vinyl record, shot from above. Simple, bold, iconic. Clean studio lighting.',
    palette: 'Jet black, cherry red, silver, white',
  },
  'template-blues-beginner': {
    style: 'A harmonica and a bottleneck slide resting on a worn wooden bar counter, warm tungsten light. Simple, rustic, inviting.',
    palette: 'Warm walnut brown, copper, faded gold, soft cream',
  },
  'template-jazz-intermediate': {
    style: 'A saxophone lying on a velvet-lined case, shot from a low angle with bokeh city lights visible through a window behind it. Sophisticated, urban jazz.',
    palette: 'Deep midnight blue, brass gold, soft violet, warm white',
  },
  'template-rock-intermediate': {
    style: 'A row of guitar effect pedals on a dark pedalboard, colorful LED indicators glowing. Overhead shot, moody stage lighting.',
    palette: 'Dark charcoal, neon green, electric blue, amber LED glow',
  },
  'template-blues-intermediate': {
    style: 'A crossroads at dusk — two dirt roads meeting, with a single old wooden signpost and a dramatic sky. Mythical, evocative, the legend of the blues.',
    palette: 'Burnt orange sunset, deep purple sky, dusty brown, silhouette black',
  },
  'template-song-giant-steps': {
    style: 'A vintage turntable playing a vinyl record, the needle in the groove, warm light casting long shadows. Close-up, nostalgic, classic jazz era.',
    palette: 'Rich mahogany, warm amber, vintage cream, soft black',
  },
  'demo-jazz-guitar-fundamentals': {
    style: 'A close-up of a jazz real book open to a lead sheet, reading glasses resting on the page, warm desk lamp light. Studious, approachable.',
    palette: 'Warm cream, soft amber, dark navy, muted gold',
  },
  'demo-blues-improvisation-mastery': {
    style: 'A moody close-up of a microphone in a smoky blues bar, with warm stage lights creating lens flare. Empty stage, anticipation.',
    palette: 'Smoky gray, electric blue, warm amber spotlight, deep black',
  },
  'demo-advanced-jazz-standards': {
    style: 'An upright bass standing in the corner of a jazz club, warm wood tones, a single spotlight, blurred audience chairs in the background.',
    palette: 'Rich walnut, deep amber, soft cream, warm spotlight yellow',
  },
  'demo-chopin-etudes-preparation': {
    style: 'A close-up of ivory piano keys with a single red rose petal resting on them. Dramatic side lighting, classical concert atmosphere.',
    palette: 'Ivory white, crimson red, deep black, warm gold',
  },
  'demo-hanon-exercises-reimagined': {
    style: 'A metronome ticking on top of a piano, shot with shallow depth of field. Soft natural light from a nearby window. Calm, methodical, practice room feel.',
    palette: 'Soft wood tones, warm white, gentle shadow, brass accents',
  },
}

interface GenerateRoutineCoverParams {
  routineId: string
  title: string
  genre: string
  skillLevel: string
  templateCategory: string
}

/**
 * Generate a simple, clean cover image for a practice routine card
 * Saves to /riff_routine/public/images/routines/{routineId}.png
 */
export async function generateRoutineCover(params: GenerateRoutineCoverParams): Promise<{
  imagePath: string
  relativePath: string
}> {
  const { routineId, title, genre, templateCategory } = params

  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY || process.env.NANO_BANANA_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_AI_STUDIO_API_KEY not set in .env')
  }

  // Use per-routine override if available, otherwise fall back to genre style
  const styleKey = templateCategory === 'song' ? 'song' : (genre.toLowerCase() as string)
  const coverStyle = ROUTINE_COVER_OVERRIDES[routineId] || ROUTINE_COVER_STYLES[styleKey] || ROUTINE_COVER_STYLES['rock']

  const prompt = `Generate a simple, clean cover image for a guitar practice routine called "${title}".

Style: ${coverStyle.style}
Color palette: ${coverStyle.palette}

IMPORTANT rules:
- Keep it SIMPLE and MINIMAL. No busy compositions, no flashy effects.
- No text, no logos, no watermarks, no words anywhere in the image.
- No people or faces.
- Clean, professional, understated design.
- Suitable as a small card thumbnail (will be displayed at ~400x200px).
- Photorealistic or clean digital art style.`

  console.log(`[Cover] Generating for "${title}"`)

  const response = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: `Generate an image: ${prompt}` }],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '16:9' },
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  const imagePart = parts.find((p: { inlineData?: { mimeType: string; data: string } }) =>
    p.inlineData?.mimeType?.startsWith('image/')
  )

  if (!imagePart?.inlineData?.data) {
    throw new Error('No image generated in response')
  }

  const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64')

  const imageDir = path.join(WEBSITE_PATHS.riffroutine, 'public/images/routines')
  fs.mkdirSync(imageDir, { recursive: true })

  const imagePath = path.join(imageDir, `${routineId}.png`)
  fs.writeFileSync(imagePath, imageBuffer)

  const relativePath = `/images/routines/${routineId}.png`
  console.log(`[Cover] Saved: ${imagePath}`)

  return { imagePath, relativePath }
}

/**
 * Check if a routine cover image already exists
 */
export function routineCoverExists(routineId: string): boolean {
  const dir = path.join(WEBSITE_PATHS.riffroutine, 'public/images/routines')
  return fs.existsSync(path.join(dir, `${routineId}.png`))
}

/**
 * Sleep helper for rate limiting
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

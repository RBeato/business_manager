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

/**
 * Sleep helper for rate limiting
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Icon generator script (ESM)
 * Converts SVG icon to Windows ICO format for electron-builder
 * Usage: node scripts/generate-icon.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function generateIcon() {
  const svgPath = path.join(__dirname, '..', 'build', 'icon.svg')
  const icoPath = path.join(__dirname, '..', 'build', 'icon.ico')

  console.log('🖼️  Generating application icon...')

  try {
    // Read the SVG file
    const svgBuffer = fs.readFileSync(svgPath)

    // Create temp directory for PNG files
    const tempDir = path.join(__dirname, '..', 'build', '.temp-icons')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    // Generate PNGs at each required size
    const sizes = [16, 32, 48, 64, 128, 256]
    const pngPaths = await Promise.all(
      sizes.map(async (size) => {
        const pngPath = path.join(tempDir, `icon-${size}.png`)
        await sharp(svgBuffer)
          .resize(size, size)
          .png()
          .toFile(pngPath)
        return pngPath
      })
    )

    // Create multi-size ICO from the PNG file paths
    const icoBuffer = await pngToIco(pngPaths)
    fs.writeFileSync(icoPath, icoBuffer)
    console.log(`  ✅ Multi-size ICO created (${sizes.join(', ')}px)`)

    // Cleanup temp files
    for (const pngPath of pngPaths) {
      fs.unlinkSync(pngPath)
    }
    fs.rmdirSync(tempDir)

    // Also generate a 256x256 PNG for the build/ directory (useful for Linux/macOS)
    const png256Path = path.join(__dirname, '..', 'build', 'icon-256.png')
    await sharp(svgBuffer)
      .resize(256, 256)
      .png()
      .toFile(png256Path)
    console.log(`  ✅ 256x256 PNG created: build/icon-256.png`)

    console.log('  ✅ Icon generation complete!')
    console.log('')
    console.log('📁 Files:')
    console.log('  build/icon.svg     - Source SVG (window icon, favicon)')
    console.log('  build/icon.ico     - Windows ICO (electron-builder)')
    console.log('  build/icon-256.png - 256x256 PNG (Linux/macOS)')
  } catch (err) {
    console.error('❌ Icon generation failed:', err.message)
    process.exit(1)
  }
}

generateIcon()
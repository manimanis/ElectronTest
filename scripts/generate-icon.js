/**
 * Icon generator script
 * Converts the SVG icon to ICO format for electron-builder (Windows)
 * Usage: node scripts/generate-icon.js
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const { toIco } = require('png-to-ico')

async function generateIcon() {
  const svgPath = path.join(__dirname, '..', 'build', 'icon.svg')
  const icoPath = path.join(__dirname, '..', 'build', 'icon.ico')
  const pngPath = path.join(__dirname, '..', 'build', 'icon-256.png')

  console.log('🖼️  Generating application icon...')

  try {
    // Read the SVG file
    const svgBuffer = fs.readFileSync(svgPath)

    // Convert SVG to PNG 256x256 using sharp
    const pngBuffer = await sharp(svgBuffer)
      .resize(256, 256)
      .png()
      .toBuffer()

    // Save PNG (useful for other purposes)
    fs.writeFileSync(pngPath, pngBuffer)
    console.log(`  ✅ PNG created: ${pngPath}`)

    // Convert PNG to ICO
    const icoBuffer = await toIco([pngBuffer])
    fs.writeFileSync(icoPath, icoBuffer)
    console.log(`  ✅ ICO created: ${icoPath}`)

    // Also generate required sizes for Electron (16x16, 32x32, 48x48, 64x64, 128x128, 256x256)
    const sizes = [16, 32, 48, 64, 128, 256]
    const pngBuffers = await Promise.all(
      sizes.map(size =>
        sharp(svgBuffer)
          .resize(size, size)
          .png()
          .toBuffer()
      )
    )

    // Create multi-size ICO with all sizes
    const multiIcoBuffer = await toIco(pngBuffers)
    fs.writeFileSync(icoPath, multiIcoBuffer)
    console.log(`  ✅ Multi-size ICO created (${sizes.join(', ')}px)`)

    // Cleanup single-size PNG
    // fs.unlinkSync(pngPath)

    console.log('  ✅ Icon generation complete!')
    console.log('')
    console.log('📁 Files:')
    console.log('  build/icon.svg  - Source SVG (window icon, favicon)')
    console.log('  build/icon.ico  - Windows ICO (electron-builder)')
  } catch (err) {
    console.error('❌ Icon generation failed:', err.message)
    process.exit(1)
  }
}

generateIcon()
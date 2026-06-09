import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const publicDir = path.join(process.cwd(), 'public')
const input = path.join(publicDir, 'logo.png')

if (!fs.existsSync(input)) {
  console.error('No se encontró public/logo.png')
  process.exit(1)
}

const outputs = [
  { name: 'logo.webp', opts: { format: 'webp', quality: 85 } },
  { name: 'logo-192.png', opts: { format: 'png', size: 192 } },
  { name: 'logo-96.png', opts: { format: 'png', size: 96 } },
  { name: 'logo-48.png', opts: { format: 'png', size: 48 } },
]

async function generate() {
  try {
    // WebP
    await sharp(input).webp({ quality: 85 }).toFile(path.join(publicDir, 'logo.webp'))
    console.log('Generado: public/logo.webp')

    // PNG sizes
    for (const out of outputs.slice(1)) {
      const size = out.opts.size
      await sharp(input).resize(size, size, { fit: 'inside' }).png({ compressionLevel: 9 }).toFile(path.join(publicDir, out.name))
      console.log(`Generado: public/${out.name}`)
    }

    console.log('Todas las imágenes generadas correctamente.')
  } catch (err) {
    console.error('Error generando imágenes:', err)
    process.exit(2)
  }
}

generate()

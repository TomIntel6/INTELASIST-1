import type { Report } from '@/lib/supabase'

const COMPANY_NAME = 'INTELASIST'
const RESPONSIBLE_ROLE = 'Gerente de cabina'
const RESPONSIBLE_PERSON = 'Manuel Barria'
const MAX_EVIDENCE_IMAGE_BYTES = 12 * 1024 * 1024
type Rgb = readonly [number, number, number]

const COLORS = {
  navy: [15, 35, 62] as Rgb,
  cyan: [8, 145, 178] as Rgb,
  text: [30, 41, 59] as Rgb,
  muted: [100, 116, 139] as Rgb,
  border: [226, 232, 240] as Rgb,
  soft: [248, 250, 252] as Rgb,
  white: [255, 255, 255] as Rgb,
}

const STATUS_COLORS: Record<string, { background: Rgb; border: Rgb; text: Rgb }> = {
  'Caso Finalizado': { background: [209, 250, 229], border: [16, 185, 129], text: [5, 150, 105] },
  'Seguimiento de caso': { background: [254, 243, 199], border: [245, 158, 11], text: [180, 83, 9] },
  'Falta de Informacion': { background: [254, 226, 226], border: [239, 68, 68], text: [185, 28, 28] },
  Informativo: { background: [209, 250, 229], border: [16, 185, 129], text: [5, 150, 105] },
  Validacion: { background: [237, 233, 254], border: [139, 92, 246], text: [109, 40, 217] },
  Cotizacion: { background: [224, 242, 254], border: [14, 165, 233], text: [3, 105, 161] },
}

function printableValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const datePart = date.toLocaleDateString('es-PA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const timePart = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  return `${datePart} ${timePart}`
}

function sanitizeFilename(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'INFORME'
}

type EmbeddedEvidenceImage = {
  data: string
  width: number
  height: number
}

async function loadEvidenceImage(url: string): Promise<EmbeddedEvidenceImage> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`La evidencia respondió con estado ${response.status}.`)
  }

  const imageBlob = await response.blob()
  if (imageBlob.size > MAX_EVIDENCE_IMAGE_BYTES) {
    throw new Error('La evidencia supera el límite para incrustarla en el PDF.')
  }
  if (imageBlob.type && !imageBlob.type.startsWith('image/')) {
    throw new Error('El archivo adjunto no es una imagen.')
  }

  const objectUrl = URL.createObjectURL(imageBlob)
  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()

    const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('No se pudo preparar la imagen para el PDF.')
    }

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    return { data: canvas.toDataURL('image/jpeg', 0.9), width, height }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function downloadReportPdf(report: Report) {
  const { jsPDF } = await import('jspdf')
  const generatedAt = new Date()
  const generatedAtText = new Intl.DateTimeFormat('es-PA', {
    dateStyle: 'long',
    timeStyle: 'medium',
  }).format(generatedAt)
  const pdf = new jsPDF({ format: 'a4', unit: 'mm' })
  pdf.setCreationDate(generatedAt)
  pdf.setProperties({
    title: `Informe ${report.id} - ${COMPANY_NAME}`,
    subject: `Informe de ${report.insured_name}`,
    author: `${COMPANY_NAME} - ${RESPONSIBLE_ROLE}: ${RESPONSIBLE_PERSON}`,
    creator: COMPANY_NAME,
  })

  const margin = 14
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const contentWidth = pageWidth - margin * 2
  const bodyTop = 32
  const bodyBottom = pageHeight - 18
  const lineHeight = 4.1
  const reportPdfResult = { embeddedEvidence: 0, unavailableEvidence: 0 }
  let y = bodyTop

  const addPageHeader = () => {
    pdf.setFillColor(...COLORS.white)
    pdf.rect(0, 0, pageWidth, 27, 'F')
    pdf.setFillColor(...COLORS.cyan)
    pdf.rect(0, 0, pageWidth, 1.5, 'F')
    pdf.setFillColor(...COLORS.cyan)
    pdf.roundedRect(margin, 6, 12, 12, 2, 2, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(...COLORS.white)
    pdf.text('IA', margin + 6, 13.5, { align: 'center' })
    pdf.setTextColor(...COLORS.navy)
    pdf.setFontSize(11)
    pdf.text(COMPANY_NAME, margin + 17, 11)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...COLORS.muted)
    pdf.text('DETALLE DE INFORME', margin + 17, 17)
    pdf.setTextColor(...COLORS.navy)
    pdf.text(`ID: ${report.id}`, pageWidth - margin, 11, { align: 'right' })
    pdf.setTextColor(...COLORS.muted)
    pdf.text(`Generado: ${generatedAtText}`, pageWidth - margin, 17, { align: 'right' })
    pdf.setDrawColor(...COLORS.border)
    pdf.line(margin, 25, pageWidth - margin, 25)
    y = bodyTop
  }

  const addPage = () => {
    pdf.addPage()
    addPageHeader()
  }

  const ensureSpace = (height: number) => {
    if (y + height > bodyBottom) {
      addPage()
    }
  }

  const addSectionHeading = (title: string) => {
    ensureSpace(10)
    pdf.setFillColor(...COLORS.cyan)
    pdf.roundedRect(margin, y + 0.5, 2, 5.5, 0.7, 0.7, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(...COLORS.navy)
    pdf.text(title.toLocaleUpperCase('es-PA'), margin + 6, y + 4.5)
    y += 9
  }

  const drawStatusBadge = (status: string, x: number, top: number, maxWidth: number) => {
    const style = STATUS_COLORS[status] ?? {
      background: COLORS.soft,
      border: COLORS.border,
      text: COLORS.navy,
    }
    const text = printableValue(status).toLocaleUpperCase('es-PA')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    const width = Math.min(maxWidth, pdf.getTextWidth(text) + 7)
    const lines = pdf.splitTextToSize(text, Math.max(10, width - 6)) as string[]
    const height = Math.max(6, lines.length * 3.2 + 2.5)
    pdf.setFillColor(...style.background)
    pdf.setDrawColor(...style.border)
    pdf.roundedRect(x, top, width, height, 2, 2, 'FD')
    pdf.setTextColor(...style.text)
    pdf.text(lines, x + 3.5, top + 4)
    return { width, height }
  }

  const addHeroCard = () => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    const titleLines = pdf.splitTextToSize(printableValue(report.insured_name), contentWidth - 10) as string[]
    const titleHeight = Math.max(8, titleLines.length * 8)
    const subtitle = `Placa: ${printableValue(report.plate)}    |    Servicio: ${printableValue(report.service_type)}`
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    const subtitleLines = pdf.splitTextToSize(subtitle, contentWidth - 10) as string[]
    const cardHeight = 13 + titleHeight + subtitleLines.length * 4.2 + 12
    ensureSpace(cardHeight + 4)

    pdf.setFillColor(...COLORS.white)
    pdf.setDrawColor(...COLORS.border)
    pdf.roundedRect(margin, y, contentWidth, cardHeight, 2, 2, 'FD')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    pdf.setTextColor(...COLORS.navy)
    pdf.text(titleLines, margin + 5, y + 9)

    const subtitleY = y + 9 + titleHeight + 1
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(...COLORS.muted)
    pdf.text(subtitleLines, margin + 5, subtitleY)
    const badgeY = subtitleY + subtitleLines.length * 4.2 + 2
    drawStatusBadge(report.status, margin + 5, badgeY, contentWidth - 10)
    y += cardHeight + 5
  }

  const addSummaryCards = () => {
    const gap = 3
    const cardWidth = (contentWidth - gap * 2) / 3
    const cardHeight = 23
    const cards = [
      { label: 'PERIODO', value: `${report.month} ${report.year}` },
      { label: 'ESTADO', value: report.status },
      { label: 'CATEGORIA', value: report.report_category },
    ]
    ensureSpace(cardHeight + 5)

    cards.forEach((card, index) => {
      const x = margin + index * (cardWidth + gap)
      const style = card.label === 'ESTADO' ? STATUS_COLORS[card.value] : undefined
      pdf.setFillColor(...(style?.background ?? COLORS.soft))
      pdf.setDrawColor(...(style?.border ?? COLORS.border))
      pdf.roundedRect(x, y, cardWidth, cardHeight, 1.8, 1.8, 'FD')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(...COLORS.muted)
      pdf.text(card.label, x + 4, y + 6)
      if (card.label === 'ESTADO') {
        drawStatusBadge(card.value, x + 4, y + 10, cardWidth - 8)
      } else {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(8.5)
        pdf.setTextColor(...COLORS.navy)
        const valueLines = pdf.splitTextToSize(card.value, cardWidth - 8) as string[]
        pdf.text(valueLines, x + 4, y + 12)
      }
    })

    y += cardHeight + 5
  }

  type Field = { label: string; value: string | number | null | undefined }
  type FieldLayout = { labelLines: string[]; valueLines: string[]; height: number }

  const layoutField = (field: Field, width: number): FieldLayout => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    const labelLines = pdf.splitTextToSize(field.label, width - 8) as string[]
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    const valueLines = pdf.splitTextToSize(printableValue(field.value), width - 8) as string[]
    const height = 4 + labelLines.length * 3.1 + 1.5 + valueLines.length * lineHeight + 4
    return { labelLines, valueLines, height }
  }

  const drawFieldCard = (x: number, top: number, width: number, field: Field, layout: FieldLayout, continuation = false) => {
    pdf.setFillColor(...COLORS.white)
    pdf.setDrawColor(...COLORS.border)
    pdf.roundedRect(x, top, width, layout.height, 1.6, 1.6, 'FD')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...COLORS.muted)
    const labelLines = continuation
      ? pdf.splitTextToSize(`${field.label} (continuacion)`, width - 8) as string[]
      : layout.labelLines
    pdf.text(labelLines, x + 4, top + 4)
    const valueY = top + 4 + labelLines.length * 3.1 + 1.5
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(...COLORS.text)
    pdf.text(layout.valueLines, x + 4, valueY)
  }

  const addLongField = (section: string, field: Field) => {
    const layout = layoutField(field, contentWidth)
    const maxCardHeight = bodyBottom - bodyTop - 18
    const maxLines = Math.max(1, Math.floor((maxCardHeight - 13) / lineHeight))
    const chunks: string[][] = []
    for (let index = 0; index < layout.valueLines.length; index += maxLines) {
      chunks.push(layout.valueLines.slice(index, index + maxLines))
    }

    chunks.forEach((valueLines, index) => {
      const labelLines = index === 0
        ? layout.labelLines
        : pdf.splitTextToSize(`${field.label} (continuacion)`, contentWidth - 8) as string[]
      const chunkHeight = 4 + labelLines.length * 3.1 + 1.5 + valueLines.length * lineHeight + 4
      if (y + chunkHeight > bodyBottom) {
        addPage()
        addSectionHeading(`${section} (continuacion)`)
      }
      drawFieldCard(margin, y, contentWidth, field, { labelLines, valueLines, height: chunkHeight }, index > 0)
      y += chunkHeight + 3
    })
  }

  const addInfoGrid = (title: string, fields: Field[]) => {
    if (fields.length === 0) return
    addSectionHeading(title)
    const gap = 3
    const halfWidth = (contentWidth - gap) / 2
    const maxCardHeight = bodyBottom - bodyTop - 18
    let index = 0

    while (index < fields.length) {
      const firstField = fields[index]
      const secondField = fields[index + 1]
      const firstWidth = secondField ? halfWidth : contentWidth
      const firstLayout = layoutField(firstField, firstWidth)

      if (firstLayout.height > maxCardHeight) {
        addLongField(title, firstField)
        index += 1
        continue
      }

      if (secondField) {
        const secondLayout = layoutField(secondField, halfWidth)
        if (secondLayout.height > maxCardHeight) {
          drawFieldCard(margin, y, contentWidth, firstField, layoutField(firstField, contentWidth))
          y += layoutField(firstField, contentWidth).height + 3
          index += 1
          continue
        }

        const rowHeight = Math.max(firstLayout.height, secondLayout.height)
        if (y + rowHeight > bodyBottom) {
          addPage()
          addSectionHeading(`${title} (continuacion)`)
        }
        drawFieldCard(margin, y, halfWidth, firstField, { ...firstLayout, height: rowHeight })
        drawFieldCard(margin + halfWidth + gap, y, halfWidth, secondField, { ...secondLayout, height: rowHeight })
        y += rowHeight + 3
        index += 2
        continue
      }

      if (y + firstLayout.height > bodyBottom) {
        addPage()
        addSectionHeading(`${title} (continuacion)`)
      }
      drawFieldCard(margin, y, contentWidth, firstField, firstLayout)
      y += firstLayout.height + 3
      index += 1
    }

    y += 2
  }

  const addTextSection = (title: string, text: string, reason?: string) => {
    addSectionHeading(title)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    const textLines = pdf.splitTextToSize(printableValue(text), contentWidth - 10) as string[]
    const reasonLines = reason
      ? pdf.splitTextToSize(`Motivo: ${reason}`, contentWidth - 10) as string[]
      : []
    const maxCardHeight = bodyBottom - bodyTop - 18
    const reasonHeight = reasonLines.length ? reasonLines.length * 4 + 3 : 0
    const maxTextLines = Math.max(1, Math.floor((maxCardHeight - reasonHeight - 12) / lineHeight))
    const chunks: string[][] = []
    for (let index = 0; index < textLines.length; index += maxTextLines) {
      chunks.push(textLines.slice(index, index + maxTextLines))
    }

    chunks.forEach((lines, index) => {
      const isContinuation = index > 0
      const showReason = !isContinuation && reasonLines.length > 0
      const cardHeight = 7 + (showReason ? reasonHeight : 0) + lines.length * lineHeight + 5
      if (y + cardHeight > bodyBottom) {
        addPage()
        addSectionHeading(`${title} (continuacion)`)
      }

      pdf.setFillColor(...COLORS.white)
      pdf.setDrawColor(...COLORS.border)
      pdf.roundedRect(margin, y, contentWidth, cardHeight, 1.8, 1.8, 'FD')
      let textY = y + 6
      if (showReason) {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(8)
        pdf.setTextColor(...COLORS.muted)
        pdf.text(reasonLines, margin + 5, textY)
        textY += reasonHeight
      }
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(...COLORS.text)
      pdf.text(lines, margin + 5, textY)
      y += cardHeight + 4
    })
  }

  const addEvidenceCard = async (filename: string, url: string) => {
    let image: EmbeddedEvidenceImage | null = null
    try {
      image = await loadEvidenceImage(url)
      reportPdfResult.embeddedEvidence += 1
    } catch {
      reportPdfResult.unavailableEvidence += 1
    }

    const caption = printableValue(filename)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    const captionLines = pdf.splitTextToSize(caption, contentWidth - 10) as string[]
    const captionHeight = Math.max(5, captionLines.length * 3.6)
    let imageWidth = 0
    let imageHeight = 0
    if (image) {
      const maxImageWidth = contentWidth - 12
      const maxImageHeight = 145
      const scale = Math.min(maxImageWidth / image.width, maxImageHeight / image.height)
      imageWidth = image.width * scale
      imageHeight = image.height * scale
    }
    const noteHeight = image ? 0 : 7
    const cardHeight = 8 + captionHeight + imageHeight + noteHeight + 5
    if (y + cardHeight > bodyBottom) {
      addPage()
      addSectionHeading('Evidencias subidas (continuacion)')
    }

    pdf.setFillColor(...COLORS.white)
    pdf.setDrawColor(...COLORS.border)
    pdf.roundedRect(margin, y, contentWidth, cardHeight, 1.8, 1.8, 'FD')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(...COLORS.text)
    pdf.text(captionLines, margin + 5, y + 6)
    pdf.link(margin + 3, y + 2, contentWidth - 6, Math.max(7, captionHeight + 5), { url })

    if (image) {
      const imageX = margin + (contentWidth - imageWidth) / 2
      const imageY = y + 8 + captionHeight
      pdf.addImage(image.data, 'JPEG', imageX, imageY, imageWidth, imageHeight)
      pdf.link(imageX, imageY, imageWidth, imageHeight, { url })
    } else {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(...COLORS.muted)
      pdf.text('Vista previa no disponible. El nombre del archivo conserva el enlace a la evidencia.', margin + 5, y + 8 + captionHeight + 4)
    }

    y += cardHeight + 4
  }

  const addUpdateCard = (update: NonNullable<Report['report_updates']>[number], index: number) => {
    const commentLines = pdf.splitTextToSize(printableValue(update.comment || 'Sin comentario.'), contentWidth - 10) as string[]
    const author = [update.added_by_name, update.added_by_email].filter(Boolean).join(' | ') || 'Usuario no especificado'
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    const authorLines = pdf.splitTextToSize(author, contentWidth - 10) as string[]
    const authorHeight = authorLines.length * 3.4 + 4
    let lineIndex = 0

    while (lineIndex < commentLines.length) {
      const reservedHeight = 15 + authorHeight
      let availableLines = Math.floor((bodyBottom - y - reservedHeight - 3) / lineHeight)
      if (availableLines < 1) {
        addPage()
        addSectionHeading('Actualizaciones del informe (continuacion)')
        availableLines = Math.max(1, Math.floor((bodyBottom - y - reservedHeight - 3) / lineHeight))
      }

      const blockLines = commentLines.slice(lineIndex, lineIndex + availableLines)
      const isLastBlock = lineIndex + blockLines.length >= commentLines.length
      const cardHeight = 13 + blockLines.length * lineHeight + (isLastBlock ? authorHeight : 3)
      if (y + cardHeight > bodyBottom) {
        addPage()
        addSectionHeading('Actualizaciones del informe (continuacion)')
      }

      pdf.setFillColor(...COLORS.white)
      pdf.setDrawColor(...COLORS.border)
      pdf.roundedRect(margin, y, contentWidth, cardHeight, 1.8, 1.8, 'FD')
      const badge = drawStatusBadge(update.status, margin + 4, y + 3, contentWidth - 55)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(...COLORS.muted)
      pdf.text(formatDate(update.created_at), pageWidth - margin - 4, y + 7, { align: 'right' })
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(...COLORS.text)
      pdf.text(blockLines, margin + 5, y + Math.max(13, badge.height + 6))

      if (isLastBlock) {
        const authorY = y + cardHeight - authorHeight + 2
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        pdf.setTextColor(...COLORS.muted)
        pdf.text(authorLines, margin + 5, authorY)
      }

      y += cardHeight + 4
      lineIndex += blockLines.length
    }
  }

  addPageHeader()
  addHeroCard()
  addSummaryCards()

  addInfoGrid('Información del asegurado', [
    { label: 'Nombre', value: report.insured_name },
    { label: 'Placa', value: report.plate },
    { label: 'Póliza', value: report.policy },
    { label: 'Servicio', value: report.service_type },
    { label: 'Estado', value: report.status },
    { label: 'Mes', value: `${report.month} ${report.year}` },
  ])

  const additionalFields: Field[] = [
    { label: 'Tipo de documento', value: report.document_type },
    { label: 'Otro documento', value: report.document_other },
    { label: 'Tipo de ambulancia', value: report.ambulance_type },
    { label: 'Paramédico', value: report.paramedic_name },
    { label: 'Cobertura', value: report.coverage || 'No' },
  ].filter((field) => field.value !== null && field.value !== undefined && field.value !== '')

  addInfoGrid('Detalles del expediente', [
    { label: 'ID del informe', value: report.id },
    { label: 'Periodo', value: `${report.month} ${report.year}` },
    { label: 'Categoría', value: report.report_category },
    { label: 'Creado por', value: report.created_by_name || report.created_by_email || 'Usuario no especificado' },
    { label: 'Correo del creador', value: report.created_by_email },
    { label: 'Fecha de creación', value: formatDate(report.created_at) },
    { label: 'Última actualización', value: formatDate(report.updated_at) },
    { label: 'Fecha de generación del PDF', value: generatedAtText },
    { label: RESPONSIBLE_ROLE, value: RESPONSIBLE_PERSON },
    ...additionalFields,
  ])

  addInfoGrid('Datos del vehículo', [
    { label: 'Marca', value: report.brand },
    { label: 'Modelo', value: report.model },
    { label: 'Color', value: report.color },
    { label: 'Año', value: report.year_vehicle },
  ])

  const observation = report.observation_comment || ''
  const [firstObservationLine, ...observationRest] = observation.split(/\r?\n/)
  const observationReason = firstObservationLine?.startsWith('Motivo:')
    ? firstObservationLine.slice('Motivo:'.length).trim()
    : ''
  const observationText = observationReason
    ? observationRest.join('\n').trim() || 'Sin observación adicional.'
    : observation || 'Sin observación adicional.'
  addTextSection('Observación inicial', observationText, observationReason || undefined)

  addSectionHeading('Evidencias subidas')
  const evidences = report.evidence_urls?.length
    ? report.evidence_urls
    : report.evidence_url
      ? [{ url: report.evidence_url, filename: report.evidence_filename ?? '', path: report.evidence_path ?? '' }]
      : []
  if (evidences.length === 0) {
    const emptyEvidence = { label: 'Archivos adjuntos', value: 'No hay evidencias adjuntas.' }
    const layout = layoutField(emptyEvidence, contentWidth)
    ensureSpace(layout.height)
    drawFieldCard(margin, y, contentWidth, emptyEvidence, layout)
    y += layout.height + 4
  } else {
    for (const [index, evidence] of evidences.entries()) {
      await addEvidenceCard(evidence.filename || `Evidencia ${index + 1}`, evidence.url)
    }
  }

  addSectionHeading('Actualizaciones del informe')
  const updates = report.report_updates ?? []
  if (updates.length === 0) {
    const emptyUpdates = { label: 'Actualizaciones', value: 'No hay actualizaciones registradas.' }
    const layout = layoutField(emptyUpdates, contentWidth)
    ensureSpace(layout.height)
    drawFieldCard(margin, y, contentWidth, emptyUpdates, layout)
    y += layout.height + 3
  } else {
    updates.forEach(addUpdateCard)
  }

  const pageCount = pdf.getNumberOfPages()
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    pdf.setPage(pageNumber)
    pdf.setDrawColor(...COLORS.border)
    pdf.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...COLORS.muted)
    pdf.text(`${COMPANY_NAME} | Documento de informe`, margin, pageHeight - 7)
    pdf.text(`Página ${pageNumber} de ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' })
  }

  const filename = `${sanitizeFilename(report.insured_name)}_${sanitizeFilename(report.plate)}_${COMPANY_NAME}.pdf`
  pdf.save(filename)
  return reportPdfResult
}

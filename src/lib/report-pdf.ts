import type { Report } from '@/lib/supabase'

const COMPANY_NAME = 'INTELASIST'
const RESPONSIBLE_ROLE = 'Gerente de cabina'
const RESPONSIBLE_PERSON = 'Manuel Barria'
const MAX_EVIDENCE_IMAGE_BYTES = 12 * 1024 * 1024
const COLORS = {
  navy: [15, 35, 62] as const,
  cyan: [8, 145, 178] as const,
  text: [30, 41, 59] as const,
  muted: [100, 116, 139] as const,
  border: [226, 232, 240] as const,
  soft: [248, 250, 252] as const,
}

function printableValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return String(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[dato de contacto omitido]')
}

function redactEmails(value: string) {
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[dato de contacto omitido]')
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const datePart = date.toLocaleDateString('es', {
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
  return redactEmails(value)
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

    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight))
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
    return { data: canvas.toDataURL('image/jpeg', 0.86), width, height }
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
    subject: `Informe de ${redactEmails(report.insured_name)}`,
    author: `${COMPANY_NAME} - ${RESPONSIBLE_ROLE}: ${RESPONSIBLE_PERSON}`,
    creator: COMPANY_NAME,
  })

  const margin = 17
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const contentWidth = pageWidth - margin * 2
  const bodyBottom = pageHeight - 23
  let y = 39
  let fieldIndex = 0
  const reportPdfResult = { embeddedEvidence: 0, unavailableEvidence: 0 }

  const addPageHeader = () => {
    pdf.setFillColor(...COLORS.navy)
    pdf.rect(0, 0, pageWidth, 31, 'F')
    pdf.setFillColor(...COLORS.cyan)
    pdf.roundedRect(margin, 7, 15, 15, 2, 2, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(255, 255, 255)
    pdf.text('IA', margin + 7.5, 16.5, { align: 'center' })
    pdf.setFontSize(12)
    pdf.text(COMPANY_NAME, margin + 20, 13)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(203, 213, 225)
    pdf.text('GESTIÓN DE ASISTENCIAS', margin + 20, 18)
    pdf.text(`Ref. ${report.id}`, pageWidth - margin, 11, { align: 'right' })
    pdf.text(`PDF generado: ${generatedAtText}`, pageWidth - margin, 17, { align: 'right' })
    pdf.text(`${RESPONSIBLE_ROLE}: ${RESPONSIBLE_PERSON}`, pageWidth - margin, 23, { align: 'right' })
    y = 39
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

  const addSection = (title: string) => {
    ensureSpace(14)
    pdf.setFillColor(...COLORS.cyan)
    pdf.roundedRect(margin, y - 4, 2, 7, 0.7, 0.7, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(...COLORS.navy)
    pdf.text(title.toLocaleUpperCase('es-PA'), margin + 6, y + 1)
    y += 6
    pdf.setDrawColor(...COLORS.border)
    pdf.line(margin, y, pageWidth - margin, y)
    y += 5
  }

  const addField = (label: string, value: string | number | null | undefined, url?: string) => {
    const lines = pdf.splitTextToSize(printableValue(value), contentWidth - 8) as string[]
    const lineHeight = 4.2
    let lineIndex = 0
    let isFirstBlock = true

    while (lineIndex < lines.length) {
      if (y + 13 > bodyBottom) {
        addPage()
      }

      const availableLines = Math.max(1, Math.floor((bodyBottom - y - 9) / lineHeight))
      const blockLines = lines.slice(lineIndex, lineIndex + availableLines)
      const labelText = isFirstBlock ? label : `${label} (continuación)`
      const labelLines = pdf.splitTextToSize(labelText, 48) as string[]
      const blockHeight = Math.max(labelLines.length * lineHeight, blockLines.length * lineHeight) + 7

      if (fieldIndex % 2 === 0) {
        pdf.setFillColor(...COLORS.soft)
      } else {
        pdf.setFillColor(255, 255, 255)
      }
      pdf.setDrawColor(...COLORS.border)
      pdf.roundedRect(margin, y, contentWidth, blockHeight, 1.2, 1.2, 'FD')

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.setTextColor(...COLORS.muted)
      pdf.text(labelLines, margin + 4, y + 5)

      const valueX = margin + 55
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      if (url) {
        pdf.setTextColor(...COLORS.cyan)
      } else {
        pdf.setTextColor(...COLORS.text)
      }
      pdf.text(blockLines, valueX, y + 5)
      if (url) {
        pdf.link(valueX, y + 1, contentWidth - 59, blockLines.length * lineHeight, { url })
      }

      y += blockHeight + 2
      lineIndex += blockLines.length
      isFirstBlock = false
      fieldIndex += 1

      if (lineIndex < lines.length) {
        addPage()
      }
    }
  }

  const addSummaryCards = () => {
    const gap = 3
    const cardWidth = (contentWidth - gap * 2) / 3
    const cardHeight = 21
    const cards = [
      { label: 'PERÍODO', value: `${report.month} ${report.year}` },
      { label: 'ESTADO', value: report.status },
      { label: 'CATEGORÍA', value: report.report_category },
    ]

    cards.forEach((card, index) => {
      const x = margin + index * (cardWidth + gap)
      pdf.setFillColor(...COLORS.soft)
      pdf.setDrawColor(...COLORS.border)
      pdf.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, 'FD')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(...COLORS.muted)
      pdf.text(card.label, x + 4, y + 6)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.setTextColor(...COLORS.navy)
      const valueLines = pdf.splitTextToSize(card.value, cardWidth - 8).slice(0, 2)
      pdf.text(valueLines, x + 4, y + 12)
    })

    y += cardHeight + 8
  }

  const addEvidencePreview = (filename: string, image: EmbeddedEvidenceImage) => {
    const captionLines = pdf.splitTextToSize(printableValue(filename), contentWidth - 10) as string[]
    const captionHeight = captionLines.length * 3.5 + 6
    const maxImageWidth = contentWidth - 10
    const maxImageHeight = 95
    const scale = Math.min(maxImageWidth / image.width, maxImageHeight / image.height)
    const imageWidth = image.width * scale
    const imageHeight = image.height * scale
    const cardHeight = captionHeight + imageHeight + 8
    ensureSpace(cardHeight + 2)

    pdf.setFillColor(255, 255, 255)
    pdf.setDrawColor(...COLORS.border)
    pdf.roundedRect(margin, y, contentWidth, cardHeight, 1.5, 1.5, 'FD')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(...COLORS.muted)
    pdf.text(captionLines, margin + 5, y + 5)
    pdf.addImage(image.data, 'JPEG', margin + (contentWidth - imageWidth) / 2, y + captionHeight, imageWidth, imageHeight)
    y += cardHeight + 4
  }

  const addUpdateCard = (update: NonNullable<Report['report_updates']>[number], index: number) => {
    const commentLines = pdf.splitTextToSize(
      printableValue(update.comment || 'Sin comentario.'),
      contentWidth - 12,
    ) as string[]
    const lineHeight = 4.2
    const userName = printableValue(update.added_by_name || 'Usuario no especificado')
    let lineIndex = 0
    let isFirstBlock = true

    while (lineIndex < commentLines.length) {
      if (y + 22 > bodyBottom) {
        addPage()
      }

      const availableLines = Math.max(1, Math.floor((bodyBottom - y - 22) / lineHeight))
      const blockLines = commentLines.slice(lineIndex, lineIndex + availableLines)
      const isLastBlock = lineIndex + blockLines.length >= commentLines.length
      const cardHeight = 15 + blockLines.length * lineHeight + (isLastBlock ? 7 : 0)

      pdf.setFillColor(255, 255, 255)
      pdf.setDrawColor(...COLORS.border)
      pdf.roundedRect(margin, y, contentWidth, cardHeight, 1.5, 1.5, 'FD')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.setTextColor(...COLORS.navy)
      pdf.text(
        isFirstBlock ? `Actualización ${index + 1} | ${printableValue(update.status)}` : `Actualización ${index + 1} | Continuación`,
        margin + 5,
        y + 6,
      )
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(...COLORS.muted)
      pdf.text(formatDate(update.created_at), pageWidth - margin - 5, y + 6, { align: 'right' })
      pdf.setFontSize(9)
      pdf.setTextColor(...COLORS.text)
      pdf.text(blockLines, margin + 5, y + 12)

      if (isLastBlock) {
        pdf.setFontSize(7)
        pdf.setTextColor(...COLORS.muted)
        pdf.text(`Actualizado por: ${userName}`, margin + 5, y + cardHeight - 3)
      }

      y += cardHeight + 3
      lineIndex += blockLines.length
      isFirstBlock = false
      if (lineIndex < commentLines.length) {
        addPage()
      }
    }
  }

  addPageHeader()
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(...COLORS.cyan)
  pdf.text('INFORME DE ASISTENCIA', margin, y)
  y += 8
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(19)
  pdf.setTextColor(...COLORS.navy)
  const insuredNameLines = pdf.splitTextToSize(printableValue(report.insured_name), contentWidth) as string[]
  pdf.text(insuredNameLines, margin, y)
  y += insuredNameLines.length * 8 + 1
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(...COLORS.muted)
  const summaryLine = pdf.splitTextToSize(
    `Placa: ${printableValue(report.plate)}    |    Servicio: ${printableValue(report.service_type)}`,
    contentWidth,
  )
  pdf.text(summaryLine, margin, y)
  y += 8
  addSummaryCards()

  addSection('Datos del informe')
  const reportFields: Array<[string, string | number | null | undefined]> = [
    ['ID del informe', report.id],
    ['Mes del informe', report.month],
    ['Año del informe', report.year],
    ['Fecha de creación del informe', formatDate(report.created_at)],
    ['Última actualización', formatDate(report.updated_at)],
    ['Fecha y hora de generación del PDF', generatedAtText],
    [RESPONSIBLE_ROLE, RESPONSIBLE_PERSON],
  ]
  reportFields.forEach(([label, value]) => addField(label, value))

  addSection('Asegurado y servicio')
  const serviceFields: Array<[string, string | number | null | undefined]> = [
    ['Nombre del asegurado', report.insured_name],
    ['Placa', report.plate],
    ['Póliza', report.policy],
    ['Servicio', report.service_type],
    ['Cobertura', report.coverage || 'No'],
  ]
  serviceFields.forEach(([label, value]) => addField(label, value))

  addSection('Datos del vehículo')
  const vehicleFields: Array<[string, string | number | null | undefined]> = [
    ['Marca', report.brand],
    ['Modelo', report.model],
    ['Color', report.color],
    ['Año del vehículo', report.year_vehicle],
  ]
  vehicleFields.forEach(([label, value]) => addField(label, value))

  const additionalFields: Array<[string, string | number | null | undefined]> = [
    ['Tipo de documento', report.document_type],
    ['Otro documento', report.document_other],
    ['Tipo de ambulancia', report.ambulance_type],
    ['Paramédico', report.paramedic_name],
  ]
  const populatedAdditionalFields = additionalFields.filter(([, value]) => value !== null && value !== undefined && value !== '')
  if (populatedAdditionalFields.length > 0) {
    addSection('Información adicional')
    populatedAdditionalFields.forEach(([label, value]) => addField(label, value))
  }

  addSection('Observación inicial')
  const observation = report.observation_comment || ''
  const [firstObservationLine, ...observationRest] = observation.split(/\r?\n/)
  const observationReason = firstObservationLine?.startsWith('Motivo:')
    ? firstObservationLine.slice('Motivo:'.length).trim()
    : ''
  const observationText = observationReason
    ? observationRest.join('\n').trim()
    : observation
  if (observationReason) {
    addField('Motivo', observationReason)
  }
  addField('Observación', observationText || 'Sin observación adicional.')

  addSection('Registro del informe')
  addField('Creado por', report.created_by_name || 'Usuario no especificado')

  addSection('Evidencias')
  const evidences = report.evidence_urls?.length
    ? report.evidence_urls
    : report.evidence_url
      ? [{ url: report.evidence_url, filename: report.evidence_filename ?? '', path: report.evidence_path ?? '' }]
      : []
  if (evidences.length === 0) {
    addField('Archivos adjuntos', 'No hay evidencias adjuntas.')
  } else {
    for (const [index, evidence] of evidences.entries()) {
      addField(`Evidencia ${index + 1}`, evidence.filename || 'Abrir evidencia', evidence.url)
      try {
        const image = await loadEvidenceImage(evidence.url)
        addEvidencePreview(evidence.filename || `Evidencia ${index + 1}`, image)
        reportPdfResult.embeddedEvidence += 1
      } catch {
        addField('Vista previa', 'No se pudo incrustar la imagen; use el enlace adjunto.')
        reportPdfResult.unavailableEvidence += 1
      }
    }
  }

  addSection('Historial de actualizaciones')
  const updates = report.report_updates ?? []
  if (updates.length === 0) {
    addField('Actualizaciones', 'No hay actualizaciones registradas.')
  } else {
    updates.forEach(addUpdateCard)
  }

  const pageCount = pdf.getNumberOfPages()
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    pdf.setPage(pageNumber)
    pdf.setDrawColor(...COLORS.border)
    pdf.line(margin, pageHeight - 17, pageWidth - margin, pageHeight - 17)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...COLORS.muted)
    pdf.text(`${COMPANY_NAME} | Documento de informe`, margin, pageHeight - 11)
    pdf.text(`Página ${pageNumber} de ${pageCount}`, pageWidth - margin, pageHeight - 11, { align: 'right' })
  }

  const filename = `${sanitizeFilename(report.insured_name)}_${sanitizeFilename(report.plate)}_${COMPANY_NAME}.pdf`
  pdf.save(filename)
  return reportPdfResult
}

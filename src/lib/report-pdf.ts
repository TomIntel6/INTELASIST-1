import type { Report } from '@/lib/supabase'

const COMPANY_NAME = 'INTELASIST'
const RESPONSIBLE_PERSON = 'Cabin Manager Manuel Barrria'

function printableValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return String(value)
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-PA')
}

function sanitizeFilename(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'INFORME'
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
    author: `${COMPANY_NAME} - ${RESPONSIBLE_PERSON}`,
    creator: COMPANY_NAME,
  })
  const margin = 16
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const contentWidth = pageWidth - margin * 2
  let y = 18

  const addPageHeader = () => {
    pdf.setFillColor(8, 145, 178)
    pdf.rect(0, 0, pageWidth, 5, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(8, 92, 117)
    pdf.text(COMPANY_NAME, margin, 13)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(100, 116, 139)
    pdf.text(`Informe ${report.id}`, pageWidth - margin, 13, { align: 'right' })
    pdf.setFontSize(7)
    pdf.text(`Responsable: ${RESPONSIBLE_PERSON}`, margin, 18)
    pdf.text(`PDF generado: ${generatedAtText}`, pageWidth - margin, 18, { align: 'right' })
    y = 24
  }

  const addPage = () => {
    pdf.addPage()
    addPageHeader()
  }

  const ensureSpace = (height: number) => {
    if (y + height > pageHeight - margin) {
      addPage()
    }
  }

  const addSection = (title: string) => {
    ensureSpace(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(15, 23, 42)
    pdf.text(title, margin, y)
    y += 2
    pdf.setDrawColor(203, 213, 225)
    pdf.line(margin, y, pageWidth - margin, y)
    y += 6
  }

  const addField = (label: string, value: string | number | null | undefined, url?: string) => {
    const text = printableValue(value)
    const lines = pdf.splitTextToSize(text, contentWidth)
    const lineHeight = 4.5
    ensureSpace(9 + lines.length * lineHeight)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(71, 85, 105)
    pdf.text(`${label}:`, margin, y)
    y += 4.5
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(url ? 8 : 30, url ? 145 : 41, url ? 178 : 59)
    pdf.text(lines, margin, y)
    if (url) {
      pdf.link(margin, y - 3.5, contentWidth, lines.length * lineHeight, { url })
    }
    y += lines.length * lineHeight + 3
  }

  addPageHeader()
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.setTextColor(15, 23, 42)
  pdf.text('Informe registrado', margin, y + 3)
  y += 10
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(71, 85, 105)
  pdf.text(`${report.insured_name} · ${report.plate}`, margin, y)
  y += 10

  addSection('Datos del informe')
  const reportFields: Array<[string, string | number | null | undefined]> = [
    ['ID del informe', report.id],
    ['Categoría', report.report_category],
    ['Mes', report.month],
    ['Año', report.year],
    ['Estado', report.status],
    ['Fecha de creación', formatDate(report.created_at)],
    ['Última actualización', formatDate(report.updated_at)],
    ['Fecha y hora de generación del PDF', generatedAtText],
    ['Responsable', RESPONSIBLE_PERSON],
  ]
  reportFields.forEach(([label, value]) => addField(label, value))

  addSection('Información del asegurado y servicio')
  const serviceFields: Array<[string, string | number | null | undefined]> = [
    ['Nombre del asegurado', report.insured_name],
    ['Placa', report.plate],
    ['Póliza', report.policy],
    ['Servicio', report.service_type],
    ['Cobertura', report.coverage],
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

  addSection('Datos adicionales')
  const additionalFields: Array<[string, string | number | null | undefined]> = [
    ['Tipo de documento', report.document_type],
    ['Otro documento', report.document_other],
    ['Tipo de ambulancia', report.ambulance_type],
    ['Paramédico', report.paramedic_name],
    ['Observación', report.observation_comment],
    ['Creado por', report.created_by_name],
    ['Correo del creador', report.created_by_email],
  ]
  additionalFields.forEach(([label, value]) => addField(label, value))

  addSection('Evidencias')
  const evidences = report.evidence_urls?.length
    ? report.evidence_urls
    : report.evidence_url
      ? [{ url: report.evidence_url, filename: report.evidence_filename ?? '', path: report.evidence_path ?? '' }]
      : []
  if (evidences.length === 0) {
    addField('Archivos', 'No hay evidencias adjuntas.')
  } else {
    evidences.forEach((evidence, index) => {
      addField(`Evidencia ${index + 1} · archivo`, evidence.filename || 'Sin nombre')
      addField(`Evidencia ${index + 1} · enlace`, evidence.url, evidence.url)
      addField(`Evidencia ${index + 1} · ruta`, evidence.path)
    })
  }

  addSection('Actualizaciones del informe')
  const updates = report.report_updates ?? []
  if (updates.length === 0) {
    addField('Actualizaciones', 'No hay actualizaciones registradas.')
  } else {
    updates.forEach((update, index) => {
      addField(`Actualización ${index + 1} · fecha`, formatDate(update.created_at))
      addField(`Actualización ${index + 1} · estado`, update.status)
      addField(`Actualización ${index + 1} · comentario`, update.comment)
      addField(`Actualización ${index + 1} · usuario`, update.added_by_name || update.added_by_email)
      addField(`Actualización ${index + 1} · correo`, update.added_by_email)
    })
  }

  const filename = `${sanitizeFilename(report.insured_name)}_${sanitizeFilename(report.plate)}_${COMPANY_NAME}.pdf`
  pdf.save(filename)
}

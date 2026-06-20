export const REPORT_REQUIRED_FIELDS = [
  'service_type',
  'insured_name',
  'plate',
  'policy',
  'brand',
  'model',
  'color',
  'status',
  'observation_comment',
] as const

export type ReportAlertFieldKey = (typeof REPORT_REQUIRED_FIELDS)[number] | 'motivo'

export type ReportFieldSummaryItem = {
  field: ReportAlertFieldKey
  label: string
  value: string
}

const REPORT_FIELD_LABELS: Record<ReportAlertFieldKey, string> = {
  service_type: 'tipo de servicio',
  insured_name: 'nombre del asegurado',
  plate: 'placa del vehículo',
  policy: 'número de póliza',
  brand: 'marca del vehículo',
  model: 'modelo del vehículo',
  color: 'color del vehículo',
  status: 'estado del caso',
  observation_comment: 'descripción del caso',
  motivo: 'motivo del caso',
}

function isFieldFilled(value: unknown) {
  if (value === null || value === undefined) {
    return false
  }

  if (typeof value === 'string') {
    return value.trim() !== ''
  }

  return true
}

function formatFieldValue(value: unknown) {
  if (value === null || value === undefined) {
    return 'Sin diligenciar'
  }

  if (typeof value === 'string') {
    return value.trim() || 'Sin diligenciar'
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ') || 'Sin diligenciar'
  }

  return String(value)
}

export function buildIncompleteReportSummary(formValues: Record<string, unknown>) {
  const status = String(formValues.status ?? '')
  const requiredFields: ReportAlertFieldKey[] = [...REPORT_REQUIRED_FIELDS]

  if (status === 'Validacion' || status === 'Informativo') {
    requiredFields.push('motivo')
  }

  const completedFields = requiredFields.filter(field => isFieldFilled(formValues[field]))
  const missingFields = requiredFields.filter(field => !isFieldFilled(formValues[field]))

  const completedFieldEntries: ReportFieldSummaryItem[] = completedFields.map(field => ({
    field,
    label: REPORT_FIELD_LABELS[field],
    value: formatFieldValue(formValues[field]),
  }))

  const missingFieldEntries: ReportFieldSummaryItem[] = missingFields.map(field => ({
    field,
    label: REPORT_FIELD_LABELS[field],
    value: 'Sin diligenciar',
  }))

  return {
    completedFields: completedFields as ReportAlertFieldKey[],
    missingFields: missingFields as ReportAlertFieldKey[],
    completedFieldLabels: completedFields.map(field => REPORT_FIELD_LABELS[field]),
    missingFieldLabels: missingFields.map(field => REPORT_FIELD_LABELS[field]),
    completedFieldEntries,
    missingFieldEntries,
  }
}

export function getReportFieldLabel(field: string) {
  return REPORT_FIELD_LABELS[field as ReportAlertFieldKey] ?? field
}

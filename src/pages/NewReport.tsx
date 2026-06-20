import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getDefaultApiBase } from '@/lib/supabase'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { SERVICE_TYPES, REPORT_STATUSES, MONTHS, type ReportStatus, createReport, uploadEvidenceFile } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { usePermissions } from '@/lib/permissions-context'
import { AuditService } from '@/lib/audit-service'
import type { PermissionKey } from '@/lib/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ArrowLeft, Save, Upload, X } from 'lucide-react'
import { buildIncompleteReportSummary } from '@/lib/report-alerts'

export default function NewReport() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { hasPermission } = usePermissions()
  const canCreateReports = hasPermission(PERMISSIONS.REPORTS.CREATE as PermissionKey)
  const canUploadEvidence = hasPermission(PERMISSIONS.EVIDENCE.UPLOAD as PermissionKey)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [periodDate, setPeriodDate] = React.useState(() => new Date())

  const currentMonthIdx = periodDate.getMonth()
  const currentYear = periodDate.getFullYear()

  const COVERAGE_OPTIONS = ['No', 'KC', 'K1', 'K8', 'VA', 'FAB', 'FAP', 'FAV', 'FP', 'FAM', 'FAE', 'CB', 'CP', 'CV'] as const
  const INFORMATIVE_MOTIVOS = ['SERVICIO UTILIZADO', 'NO CUBIERTO POR LA POLIZA', 'OTROS'] as const
  const VALIDATION_MOTIVOS = ['SOAT', 'SALDO MOROSO', 'RENOVACION NO PAGADA', 'BENEFICIO EN 24H', 'POLIZA CANCELADA', 'OTROS'] as const

type NewReportForm = {
  month: string
  year: number
  insured_name: string
  plate: string
  policy: string
  service_type: string
  coverage: string
  brand: string
  model: string
  color: string
  year_vehicle: string
  status: ReportStatus | ''
  observation_comment: string
  motivo: string
}

const [form, setForm] = React.useState<NewReportForm>({
    month: MONTHS[currentMonthIdx],
    year: currentYear,
    insured_name: '',
    plate: '',
    policy: '',
    service_type: '',
    coverage: '',
    brand: '',
    model: '',
    color: '',
    year_vehicle: '',
    status: '',
    observation_comment: '',
    motivo: '',
  })

  const latestFormRef = React.useRef(form)
  const failedAttemptRegisteredRef = React.useRef(false)
  const isMountedRef = React.useRef(true)

  React.useEffect(() => {
    latestFormRef.current = form
  }, [form])

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  type EvidenceItem = { file: File; preview: string }
  const [evidenceItems, setEvidenceItems] = React.useState<EvidenceItem[]>([])
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const pasteTextareaRef = React.useRef<HTMLTextAreaElement | null>(null)

  const buildFailedAttemptPayload = React.useCallback((currentForm: NewReportForm, displayName: string) => {
    const summary = buildIncompleteReportSummary(currentForm as Record<string, unknown>)

    return {
      user_id: user?.id || null,
      user_email: user?.email || '',
      user_name: displayName,
      missing_fields: summary.missingFields,
      completed_fields: summary.completedFields,
      missing_field_labels: summary.missingFieldLabels,
      completed_field_labels: summary.completedFieldLabels,
      missing_details: summary.missingFieldEntries,
      completed_details: summary.completedFieldEntries,
    }
  }, [user])

  const setClipboardImage = (blob: Blob) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const preview = e.target?.result as string
      const extension = blob.type ? `.${blob.type.split('/')[1] ?? 'png'}` : '.png'
      const clipboardFile = new File([blob], `clipboard-${Date.now()}${extension}`, { type: blob.type || 'image/png' })
      setEvidenceItems(prev => [...prev, { file: clipboardFile, preview }])
      setError(null)
    }
    reader.onerror = () => {
      setError('No se pudo leer la imagen del portapapeles.')
    }
    reader.readAsDataURL(blob)
  }

  const handleClipboardPaste = (clipboardEvent: ClipboardEvent | React.ClipboardEvent) => {
    const clipboardData = (clipboardEvent as ClipboardEvent).clipboardData ?? (clipboardEvent as React.ClipboardEvent).clipboardData
    if (!clipboardData) return

    const imageItem = Array.from(clipboardData.items || []).find(item => item.type.startsWith('image/'))
    if (imageItem) {
      const blob = imageItem.getAsFile()
      if (blob) {
        setClipboardImage(blob)
        return
      }
    }

    const text = clipboardData.getData('text')?.trim()
    if (text) {
      try {
        new URL(text)
        setEvidenceItems(prev => [...prev, { file: new File([], `clipboard-url-${Date.now()}.png`), preview: text }])
        setError(null)
      } catch {
        setError('Por favor pega una imagen desde el portapapeles.')
      }
    }
  }

  // Función para registrar intento fallido (reutilizable)
  const registerFailedAttempt = React.useCallback(async () => {
    if (failedAttemptRegisteredRef.current) {
      console.log('⏹️ Intento fallido ya registrado, se omite duplicado')
      return
    }

    const currentForm = latestFormRef.current
    const summary = buildIncompleteReportSummary(currentForm as Record<string, unknown>)

    const hasSomeInput = summary.completedFields.length > 0
    const hasIncompleteData = summary.missingFields.length > 0

    if (hasSomeInput && hasIncompleteData) {
      const displayName = user?.user_metadata?.full_name ?? user?.email ?? ''
      const data = buildFailedAttemptPayload(currentForm, displayName)
      
      console.log(`📤 Registrando intento fallido al abandonar (via ${window.location.pathname}):`, data)
      
      const API_BASE_URL = getDefaultApiBase()
      
      try {
        // Intentar fetch primero (más rápido)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 2000)
        
        const response = await fetch(`${API_BASE_URL}/failed-report-attempts/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          credentials: 'include',
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          failedAttemptRegisteredRef.current = true
          console.log(`✅ Intento fallido registrado (abandono de ruta)`)
          window.dispatchEvent(new CustomEvent('failedAttemptRegistered', { detail: { email: data.user_email } }))
          localStorage.setItem('failedAttemptSignal', JSON.stringify({ ts: Date.now(), email: data.user_email }))
        }
      } catch (err) {
        console.log('⚠️ Fetch falló en cleanup, intentando sendBeacon:', err)
        try {
          const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
          const sent = navigator.sendBeacon(`${API_BASE_URL}/failed-report-attempts/register`, blob)
          if (sent) {
            failedAttemptRegisteredRef.current = true
            console.log(`✅ SendBeacon enviado en cleanup`)
            window.dispatchEvent(new CustomEvent('failedAttemptRegistered', { detail: { email: data.user_email } }))
            localStorage.setItem('failedAttemptSignal', JSON.stringify({ ts: Date.now(), email: data.user_email }))
          }
        } catch (beaconErr) {
          console.error('❌ Error con sendBeacon en cleanup:', beaconErr)
        }
      }
    }
  }, [user])

  // Efecto para detectar cuando el usuario abandona la página (desmonta el componente)
  React.useEffect(() => {
    return () => {
      // Este efecto de cleanup se ejecuta cuando el componente se desmonta
      // Por lo tanto se ejecuta cuando el usuario navega fuera de NewReport
      console.log('🚪 Componente NewReport desmontado, verificando intento fallido...')
      registerFailedAttempt()
    }
  }, [registerFailedAttempt])

  // Efecto para detectar y registrar cuando el usuario abandona sin guardar (cierra pestaña, recarga, etc)
  React.useEffect(() => {
    const summary = buildIncompleteReportSummary(form as Record<string, unknown>)
    const hasSomeInput = summary.completedFields.length > 0
    const hasIncompleteData = summary.missingFields.length > 0

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasSomeInput || !hasIncompleteData || saving) {
        return
      }

      console.log('⚠️ beforeunload detectado - Usuario intenta cerrar/recargar con datos parciales')

      // Si hay campos faltantes, registrar intento fallido
      if (summary.missingFields.length > 0) {
        const displayName = user?.user_metadata?.full_name ?? user?.email ?? ''
        
        try {
          // Usar Blob de JSON para sendBeacon (más compatible que FormData)
          const data = buildFailedAttemptPayload(form, displayName)
          const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
          const API_BASE_URL = getDefaultApiBase()
          const sent = navigator.sendBeacon(`${API_BASE_URL}/failed-report-attempts/register`, blob)
          if (sent) {
            failedAttemptRegisteredRef.current = true
          }
          console.log('✅ Enviado vía sendBeacon (beforeunload):', sent)
        } catch (err) {
          console.error('❌ Error con sendBeacon:', err)
        }
      }

      // Mostrar diálogo de confirmación
      e.preventDefault()
      e.returnValue = '¿Estás seguro de que quieres salir? Los cambios no serán guardados.'
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [form, user, saving])

  React.useEffect(() => {
    const now = new Date()
    const nextMidnight = new Date(now)
    nextMidnight.setHours(24, 0, 0, 0)

    const timer = window.setTimeout(() => setPeriodDate(new Date()), nextMidnight.getTime() - now.getTime())

    return () => window.clearTimeout(timer)
  }, [periodDate])

  React.useEffect(() => {
    setForm(prev => ({
      ...prev,
      month: MONTHS[periodDate.getMonth()],
      year: periodDate.getFullYear(),
    }))
  }, [periodDate])

  const set = (field: string, value: string | number) =>
    setForm(prev => ({ ...prev, [field]: value }))

  React.useEffect(() => {
    if (form.status === 'Informativo' && form.motivo && !INFORMATIVE_MOTIVOS.includes(form.motivo as any)) {
      set('motivo', '')
      return
    }

    if (form.status === 'Validacion' && form.motivo && !VALIDATION_MOTIVOS.includes(form.motivo as any)) {
      set('motivo', '')
      return
    }

    if (form.status !== 'Validacion' && form.status !== 'Informativo' && form.motivo) {
      set('motivo', '')
    }
  }, [form.status, form.motivo])

  const handleEvidenceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canUploadEvidence) {
      setError('No tienes permisos para subir evidencias.')
      return
    }

    const files = event.target.files ? Array.from(event.target.files) : []
    if (files.length === 0) return

    const acceptedFiles: EvidenceItem[] = []
    const errors: string[] = []

    files.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        errors.push(`El archivo ${file.name} no es una imagen válida.`)
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        errors.push(`La imagen ${file.name} no debe superar 5MB.`)
        return
      }

      acceptedFiles.push({ file, preview: '' })
    })

    if (errors.length > 0) {
      setError(errors.join(' '))
    }

    if (acceptedFiles.length > 0) {
      acceptedFiles.forEach((item, index) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const preview = e.target?.result as string
          setEvidenceItems(prev => [...prev, { file: item.file, preview }])
        }
        reader.readAsDataURL(item.file)
      })
      setError(null)
    }
  }

  const removeEvidence = (index: number) => {
    setEvidenceItems(prev => prev.filter((_, idx) => idx !== index))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check permission to create reports
    if (!canCreateReports) {
      setError('No tienes permisos para crear informes.')
      return
    }
    
    // Validar campos requeridos
    const requiredFields = {
      service_type: 'tipo de servicio',
      insured_name: 'nombre del asegurado',
      plate: 'placa del vehículo',
      policy: 'número de póliza',
      brand: 'marca del vehículo',
      model: 'modelo del vehículo',
      color: 'color del vehículo',
      status: 'estado del caso',
    }
    
    for (const [field, label] of Object.entries(requiredFields)) {
      const value = form[field as keyof typeof form]
      if (!value || String(value).trim() === '') {
        setError(`Por favor completa el ${label}.`)
        setSaving(false)
        return
      }
    }

    if ((form.status === 'Validacion' || form.status === 'Informativo') && !form.motivo) {
      setError('Por favor selecciona un motivo.')
      setSaving(false)
      return
    }

    if (!form.observation_comment.trim()) {
      setError('Por favor describe lo sucedido en la llamada.')
      setSaving(false)
      return
    }

    if (!isMountedRef.current) {
      return
    }

    setSaving(true)
    setError(null)

    const displayName = user?.user_metadata?.full_name ?? user?.email ?? ''

    let evidencePayload: {
      evidence_url: string | null
      evidence_filename: string | null
      evidence_path: string | null
      evidence_urls: Array<{ url: string; filename: string; path: string }> | null
    } = {
      evidence_url: null,
      evidence_filename: null,
      evidence_path: null,
      evidence_urls: null,
    }

    if (evidenceItems.length > 0) {
      try {
        const uploadedItems = await Promise.all(
          evidenceItems.map(async (item) => {
            const uploaded = await uploadEvidenceFile(item.file)
            return {
              url: uploaded.url,
              filename: uploaded.filename,
              path: uploaded.path,
            }
          })
        )

        if (!isMountedRef.current) {
          return
        }

        evidencePayload = {
          evidence_url: uploadedItems[0]?.url ?? null,
          evidence_filename: uploadedItems[0]?.filename ?? null,
          evidence_path: uploadedItems[0]?.path ?? null,
          evidence_urls: uploadedItems,
        }
      } catch (uploadError) {
        if (isMountedRef.current) {
          setSaving(false)
          setError(uploadError instanceof Error ? uploadError.message : 'No se pudieron subir las imágenes.')
        }
        return
      }
    }

    const observationComment = form.observation_comment.trim()
    const fullObservationComment = (form.status === 'Validacion' || form.status === 'Informativo') && form.motivo
      ? `Motivo: ${form.motivo}${observationComment ? `\n\n${observationComment}` : ''}`
      : observationComment

    const basePayload = {
      month: form.month,
      year: form.year,
      insured_name: form.insured_name.trim(),
      plate: form.plate.toUpperCase().trim(),
      policy: form.policy.trim(),
      service_type: form.service_type,
      brand: form.brand.trim(),
      model: form.model.trim(),
      color: form.color.trim(),
      year_vehicle: form.year_vehicle ? parseInt(form.year_vehicle) : null,
      status: form.status as ReportStatus,
      observation_comment: fullObservationComment,
      ...evidencePayload,
      created_by: user?.id ?? null,
      created_by_name: displayName,
      created_by_email: user?.email ?? '',
    }

    const payload = form.coverage
      ? {
          ...basePayload,
          coverage: form.coverage,
        }
      : basePayload

    try {
      const createdReport = await createReport(payload)
      
      if (!isMountedRef.current) {
        return
      }

      // Validar que el ID existe y es válido
      if (!createdReport?.id || typeof createdReport.id !== 'string' || createdReport.id.trim() === '') {
        throw new Error('El servidor no retornó un ID válido para el informe.')
      }
      
      // Log audit event for report creation
      try {
        await AuditService.logReportCreated(createdReport.id, {
          insured_name: createdReport.insured_name,
          plate: createdReport.plate,
          policy: createdReport.policy,
          service_type: createdReport.service_type,
          status: createdReport.status,
        })
      } catch (auditErr) {
        console.error('Error logging audit event:', auditErr)
        // Don't fail the operation if audit logging fails
      }
      
      setSaving(false)
      navigate(`/informes/${createdReport.id}`)
    } catch (err) {
      if (isMountedRef.current) {
        setSaving(false)
        setError(err instanceof Error ? err.message : 'No se pudo guardar el informe.')
      }
    }
  }

  const vehicleYears = Array.from({ length: currentYear - 1969 }, (_, i) => currentYear - i)

  const handleNavigateBack = async () => {
    const summary = buildIncompleteReportSummary(form as Record<string, unknown>)
    const missingFields = summary.missingFields
    
    console.log('🔍 handleNavigateBack - Form actual:', form)
    for (const field of summary.missingFields) {
      console.log(`  - ${field}: vacío`)
    }

    const hasSomeInput = summary.completedFields.length > 0
    const hasIncompleteData = missingFields.length > 0

    console.log(`📊 hasSomeInput: ${hasSomeInput}, hasIncompleteData: ${hasIncompleteData}`)

    if (hasSomeInput && hasIncompleteData) {
      const displayName = user?.user_metadata?.full_name ?? user?.email ?? ''
      
      console.log(`✏️ Registrando intento fallido para: ${displayName} (${user?.email})`)
      
      const data = buildFailedAttemptPayload(form, displayName)
      
      console.log(`📤 Enviando:`, data)
      
      const API_BASE_URL = getDefaultApiBase()
      
      try {
        // Usar fetch con timeout más generoso para asegurar que se intente enviar
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 segundos de timeout
        
        const response = await fetch(`${API_BASE_URL}/failed-report-attempts/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          credentials: 'include',
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        console.log(`📤 Respuesta recibida: ${response.status} ${response.statusText}`)
        
        if (response.ok) {
          failedAttemptRegisteredRef.current = true
          const responseData = await response.json()
          console.log(`✅ Intento fallido registrado correctamente:`, responseData)
          // Señal local para que la UI recargue alertas inmediatamente
          window.dispatchEvent(new CustomEvent('failedAttemptRegistered', { detail: { email: data.user_email } }))
          localStorage.setItem('failedAttemptSignal', JSON.stringify({ ts: Date.now(), email: data.user_email }))
        } else {
          console.warn(`⚠️ Respuesta del servidor: ${response.status} ${response.statusText}`)
          const errorData = await response.json().catch(() => ({}))
          console.warn('  Error del servidor:', errorData)
        }
      } catch (err) {
        console.error('❌ Error con fetch:', err)
        // Intentar sendBeacon como fallback si fetch falla o timeout
        try {
          const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
          const sent = navigator.sendBeacon(`${API_BASE_URL}/failed-report-attempts/register`, blob)
          if (sent) {
            failedAttemptRegisteredRef.current = true
            // Emitir evento de todas formas ya que sendBeacon se envió
            window.dispatchEvent(new CustomEvent('failedAttemptRegistered', { detail: { email: data.user_email } }))
            localStorage.setItem('failedAttemptSignal', JSON.stringify({ ts: Date.now(), email: data.user_email }))
          }
          console.log(`✅ SendBeacon fallback resultado: ${sent}`)
        } catch (beaconErr) {
          console.error('❌ Error con sendBeacon fallback:', beaconErr)
        }
      }
    } else {
      console.log('⏭️ No hay datos parciales, no se registra nada')
    }

    navigate(-1)
  }

  if (!canCreateReports) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <p className="text-lg font-semibold text-destructive">No tienes permisos para crear informes.</p>
        <p className="mt-2 text-sm text-muted-foreground">Solicita a un administrador el permiso correspondiente.</p>
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Volver
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={handleNavigateBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Nuevo Informe</h1>
          <p className="text-sm text-muted-foreground">Completa la información del servicio</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Período</CardTitle>
            <CardDescription>El período se toma automáticamente del mes y año actual.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border/70 bg-muted/50 px-4 py-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Mes y año del informe</p>
              <p className="mt-1 font-semibold text-foreground">{form.month} {form.year}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Información del Asegurado</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="insured_name">Nombre del Asegurado <span className="text-destructive">*</span></Label>
              <Input
                id="insured_name"
                required
                value={form.insured_name}
                onChange={e => set('insured_name', e.target.value)}
                placeholder="Nombre completo"
                className="bg-muted/50 border-border/70"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plate">Placa <span className="text-destructive">*</span></Label>
              <Input
                id="plate"
                required
                value={form.plate}
                onChange={e => set('plate', e.target.value.toUpperCase())}
                placeholder="ABC-1234"
                className="uppercase bg-muted/50 border-border/70"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="policy">Póliza <span className="text-destructive">*</span></Label>
              <Input
                id="policy"
                required
                value={form.policy}
                onChange={e => set('policy', e.target.value)}
                placeholder="Número de póliza"
                className="bg-muted/50 border-border/70"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Servicio <span className="text-destructive">*</span></Label>
              <Select value={form.service_type} onValueChange={v => set('service_type', v)}>
                <SelectTrigger className={`bg-muted/50 border-border/70 ${!form.service_type ? 'text-muted-foreground' : ''}`}>
                  <SelectValue placeholder="Seleccionar servicio" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cobertura</Label>
              <Select value={form.coverage} onValueChange={v => set('coverage', v)}>
                <SelectTrigger className={`bg-muted/50 border-border/70 ${!form.coverage ? 'text-muted-foreground' : ''}`}>
                  <SelectValue placeholder="Seleccionar cobertura" />
                </SelectTrigger>
                <SelectContent className="max-h-52 w-[18rem]">
                  {COVERAGE_OPTIONS.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Datos del Vehículo</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="brand">Marca <span className="text-destructive">*</span></Label>
              <Input id="brand" required value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="Toyota" className="bg-muted/50 border-border/70" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">Modelo <span className="text-destructive">*</span></Label>
              <Input id="model" required value={form.model} onChange={e => set('model', e.target.value)} placeholder="Corolla" className="bg-muted/50 border-border/70" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="color">Color <span className="text-destructive">*</span></Label>
              <Input id="color" required value={form.color} onChange={e => set('color', e.target.value)} placeholder="Blanco" className="bg-muted/50 border-border/70" />
            </div>
            <div className="space-y-1.5 col-span-2 lg:col-span-2">
              <Label>Año del Vehículo</Label>
              <Select value={form.year_vehicle} onValueChange={v => set('year_vehicle', v)}>
                <SelectTrigger className={`bg-muted/50 border-border/70 ${!form.year_vehicle ? 'text-muted-foreground' : ''}`}>
                  <SelectValue placeholder="Seleccionar año" />
                </SelectTrigger>
                <SelectContent className="max-h-52 w-[18rem]">
                  {vehicleYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Observación</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Estado del Caso <span className="text-destructive">*</span></Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger className="bg-muted/50 border-border/70">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_STATUSES.filter(s => s !== 'Falta de Informacion' && s !== 'Cotizacion' && s !== 'Caso Finalizado').map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(form.status === 'Validacion' || form.status === 'Informativo') && (
              <div className="space-y-1.5">
                <Label>Motivo</Label>
                <Select value={form.motivo} onValueChange={v => set('motivo', v)}>
                  <SelectTrigger className="bg-muted/50 border-border/70">
                    <SelectValue placeholder="Seleccionar motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(form.status === 'Informativo' ? INFORMATIVE_MOTIVOS : VALIDATION_MOTIVOS).map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="observation_comment">Comentario <span className="text-destructive">*</span></Label>
              <Textarea
                id="observation_comment"
                required
                value={form.observation_comment}
                onChange={e => set('observation_comment', e.target.value)}
                placeholder="Describe lo sucedido en el servicio..."
                className="min-h-[100px] resize-y bg-muted/50 border-border/70"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Evidencia (Imágenes)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <textarea
                ref={pasteTextareaRef}
                onPaste={handleClipboardPaste}
                placeholder="Pega tus imágenes aquí (Ctrl+V)"
                className="w-full min-h-[120px] p-3 border border-border/70 rounded-lg bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex gap-2 items-center flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => canUploadEvidence ? fileInputRef.current?.click() : undefined}
                  disabled={!canUploadEvidence}
                >
                  <Upload className="size-4 mr-1" /> Agregar imágenes
                </Button>
                <span className="text-xs text-muted-foreground">Puedes seleccionar varias imágenes.</span>
              </div>
              {!canUploadEvidence && (
                <p className="text-xs text-muted-foreground">No tienes permisos para subir evidencias.</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleEvidenceChange}
                disabled={!canUploadEvidence}
              />
            </div>
            {evidenceItems.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {evidenceItems.map((item, index) => (
                  <div key={`${item.file.name}-${index}`} className="relative rounded-lg overflow-hidden border border-border/70 bg-background">
                    <img
                      src={item.preview}
                      alt={`Evidencia ${index + 1}`}
                      className="h-28 w-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      className="absolute top-2 right-2"
                      onClick={() => removeEvidence(index)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">{error}</p>
        )}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={handleNavigateBack}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="gap-2 bg-destructive hover:bg-destructive/90 text-white min-w-[140px]"
          >
            {saving ? <Spinner className="size-4" /> : <Save className="size-4" />}
            {saving ? 'Guardando...' : 'Guardar Informe'}
          </Button>
        </div>
      </form>

    </div>
  )
}

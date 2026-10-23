'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TIPOS_IDENTIFICACION,
  TIPOS_PERSONA,
  REGIMENES,
  DEPARTAMENTOS_CO,
  TIPOS_ID_EXTRANJEROS,
  calcularDvNit,
  type CustomerFiscal,
} from '@/lib/alegra-fiscal'

interface AlegraFiscalFieldsProps {
  value: CustomerFiscal
  onChange: (patch: Partial<CustomerFiscal>) => void
  errors?: Record<string, string | undefined>
  /** Qué campos renderizar aquí — omitir los que el formulario contenedor ya tiene. */
  showEmail?: boolean
  showCiudad?: boolean
  showPais?: boolean
}

/**
 * Datos fiscales obligatorios para clientes de hackÜ SAS: con ellos se crea
 * automáticamente el contacto en Alegra (facturación electrónica DIAN).
 */
export function AlegraFiscalFields({ value, onChange, errors = {}, showEmail = true, showCiudad = false, showPais = false }: AlegraFiscalFieldsProps) {
  const tipo = value.tipo_identificacion ?? ''
  const extranjero = TIPOS_ID_EXTRANJEROS.includes(tipo)
  const numero = value.numero_identificacion ?? ''

  function err(field: keyof CustomerFiscal) {
    return errors[field] ? <p className="text-xs text-red-600 mt-1">{errors[field]}</p> : null
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-3">
      <div>
        <p className="text-sm font-medium">Datos fiscales (Alegra) *</p>
        <p className="text-xs text-muted-foreground">
          Obligatorios para hackÜ SAS: el cliente se crea automáticamente en Alegra al guardar.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Tipo de identificación *</Label>
          <Select value={tipo || undefined} onValueChange={(v) => onChange({ tipo_identificacion: v, dv: v === 'NIT' && numero ? calcularDvNit(numero) : null })}>
            <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              {TIPOS_IDENTIFICACION.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {err('tipo_identificacion')}
        </div>
        <div className="grid grid-cols-[1fr_4rem] gap-2">
          <div>
            <Label className="text-xs">Número *</Label>
            <Input
              className="mt-1 h-9"
              value={numero}
              placeholder={tipo === 'NIT' ? 'Sin DV ni puntos' : ''}
              onChange={(e) => {
                const n = e.target.value
                onChange({
                  numero_identificacion: n,
                  ...(tipo === 'NIT' ? { dv: /^\d+$/.test(n) ? calcularDvNit(n) : null } : {}),
                })
              }}
            />
          </div>
          <div>
            <Label className="text-xs">DV</Label>
            <Input
              className="mt-1 h-9"
              value={value.dv ?? ''}
              disabled={tipo !== 'NIT'}
              maxLength={1}
              onChange={(e) => onChange({ dv: e.target.value })}
            />
          </div>
          <div className="col-span-2 -mt-1">{err('numero_identificacion')}{err('dv')}</div>
        </div>

        <div>
          <Label className="text-xs">Tipo de persona *</Label>
          <Select value={value.tipo_persona || undefined} onValueChange={(v) => onChange({ tipo_persona: v })}>
            <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              {TIPOS_PERSONA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {err('tipo_persona')}
        </div>
        <div>
          <Label className="text-xs">Responsabilidad de IVA *</Label>
          <Select value={value.regimen || undefined} onValueChange={(v) => onChange({ regimen: v })}>
            <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              {REGIMENES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {err('regimen')}
        </div>

        {showEmail && (
          <div className="col-span-2">
            <Label className="text-xs">Email de facturación *</Label>
            <Input className="mt-1 h-9" type="email" value={value.email ?? ''} onChange={(e) => onChange({ email: e.target.value })} />
            {err('email')}
          </div>
        )}

        <div className="col-span-2">
          <Label className="text-xs">Dirección *</Label>
          <Input className="mt-1 h-9" value={value.direccion ?? ''} onChange={(e) => onChange({ direccion: e.target.value })} />
          {err('direccion')}
        </div>

        {!extranjero && (
          <div>
            <Label className="text-xs">Departamento *</Label>
            <Select value={value.departamento || undefined} onValueChange={(v) => onChange({ departamento: v })}>
              <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {DEPARTAMENTOS_CO.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            {err('departamento')}
          </div>
        )}
        {showCiudad && (
          <div>
            <Label className="text-xs">Ciudad *</Label>
            <Input className="mt-1 h-9" value={value.ciudad ?? ''} onChange={(e) => onChange({ ciudad: e.target.value })} />
            {err('ciudad')}
          </div>
        )}
        {showPais && extranjero && (
          <div>
            <Label className="text-xs">País *</Label>
            <Input className="mt-1 h-9" value={value.pais ?? ''} onChange={(e) => onChange({ pais: e.target.value })} />
            {err('pais')}
          </div>
        )}
      </div>
    </div>
  )
}

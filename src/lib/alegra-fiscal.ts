/**
 * Datos fiscales de clientes para crear el contacto en Alegra (hackÜ SAS).
 *
 * Valores de enums tomados de la API de contactos de Alegra Colombia
 * (POST /contacts): identificationObject.type, kindOfPerson, regime.
 * Compartido entre UI (validación inmediata) y server actions (validación final).
 */

export const SOCIEDAD_ALEGRA = 'hackÜ SAS'

export const TIPOS_IDENTIFICACION = [
  { value: 'NIT', label: 'NIT' },
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'PP', label: 'Pasaporte' },
  { value: 'DIE', label: 'Documento de identificación extranjero' },
  { value: 'FOREIGN_NIT', label: 'NIT de otro país' },
  { value: 'NUIP', label: 'NUIP' },
  { value: 'TI', label: 'Tarjeta de identidad' },
  { value: 'TE', label: 'Tarjeta de extranjería' },
  { value: 'RC', label: 'Registro civil' },
] as const

export const TIPOS_PERSONA = [
  { value: 'LEGAL_ENTITY', label: 'Persona jurídica' },
  { value: 'PERSON_ENTITY', label: 'Persona natural' },
] as const

export const REGIMENES = [
  { value: 'COMMON_REGIME', label: 'Responsable de IVA' },
  { value: 'SIMPLIFIED_REGIME', label: 'No responsable de IVA' },
  { value: 'SPECIAL_REGIME', label: 'Régimen especial' },
  { value: 'INC_IVA_RESPONSIBLE', label: 'Responsable de IVA e INC' },
  { value: 'NATIONAL_CONSUMPTION_TAX', label: 'Impuesto nacional al consumo' },
  { value: 'NOT_REPONSIBLE_FOR_CONSUMPTION', label: 'No responsable de INC' },
] as const

export const DEPARTAMENTOS_CO = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá, D.C.', 'Bolívar',
  'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó',
  'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira',
  'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío',
  'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima',
  'Valle del Cauca', 'Vaupés', 'Vichada',
] as const

// Tipos de identificación extranjeros: Alegra pide `country` en la dirección
// y no aplica departamento colombiano.
export const TIPOS_ID_EXTRANJEROS = ['PP', 'DIE', 'FOREIGN_NIT', 'CE', 'TE']

export interface CustomerFiscal {
  nombre_cliente?: string | null
  tipo_identificacion?: string | null
  numero_identificacion?: string | null
  dv?: string | null
  tipo_persona?: string | null
  regimen?: string | null
  direccion?: string | null
  departamento?: string | null
  ciudad?: string | null
  pais?: string | null
  email?: string | null
}

export function requiresAlegra(c: { sociedad_cliente?: string | null; sociedades_hacku?: string[] | null }) {
  return c.sociedad_cliente === SOCIEDAD_ALEGRA || (c.sociedades_hacku ?? []).includes(SOCIEDAD_ALEGRA)
}

/** Persona natural: Alegra exige nameObject { firstName, lastName }. */
export function splitNombrePersona(nombre: string): { firstName: string; lastName: string } | null {
  const parts = nombre.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return null
  // 2 palabras: nombre + apellido; 3+: primer nombre + resto como apellidos
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

/** Dígito de verificación de un NIT colombiano (algoritmo DIAN, módulo 11). */
export function calcularDvNit(nit: string): string {
  const digits = nit.replace(/\D/g, '')
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]
  let sum = 0
  for (let i = 0; i < digits.length && i < weights.length; i++) {
    sum += Number(digits[digits.length - 1 - i]) * weights[i]
  }
  const r = sum % 11
  return String(r > 1 ? 11 - r : r)
}

/**
 * ¿Hay que exigir datos fiscales? Al crear un cliente de hackÜ SAS, o al pasar
 * un cliente existente a hackÜ SAS. Editar un cliente que ya era SAS (p. ej.
 * importados desde Alegra sin datos fiscales locales) no se bloquea.
 */
export function mustRequireFiscal(
  next: { sociedad_cliente?: string | null; sociedades_hacku?: string[] | null },
  previous?: { sociedad_cliente?: string | null; sociedades_hacku?: string[] | null } | null,
) {
  if (!requiresAlegra(next)) return false
  return !previous || !requiresAlegra(previous)
}

/**
 * Devuelve { campo: mensaje } con los datos fiscales faltantes/invalidos.
 * Vacío = listo para crear en Alegra.
 */
export function validateFiscal(c: CustomerFiscal): Record<string, string> {
  const errors: Record<string, string> = {}
  const tipo = c.tipo_identificacion?.trim()
  const numero = c.numero_identificacion?.trim() ?? ''
  const extranjero = !!tipo && TIPOS_ID_EXTRANJEROS.includes(tipo)

  if (!tipo) errors.tipo_identificacion = 'Tipo de identificación requerido'
  if (!numero) {
    errors.numero_identificacion = 'Número de identificación requerido'
  } else if ((tipo === 'NIT' || tipo === 'CC' || tipo === 'TI') && !/^\d+$/.test(numero)) {
    errors.numero_identificacion = 'Solo números, sin puntos, guiones ni dígito de verificación'
  }
  if (tipo === 'NIT' && numero && /^\d+$/.test(numero)) {
    const dv = c.dv?.trim()
    if (!dv) errors.dv = 'DV requerido para NIT'
    else if (dv !== calcularDvNit(numero)) errors.dv = `DV no coincide con el NIT (debería ser ${calcularDvNit(numero)})`
  }
  if (!c.tipo_persona) errors.tipo_persona = 'Tipo de persona requerido'
  else if (c.tipo_persona === 'PERSON_ENTITY' && splitNombrePersona(c.nombre_cliente ?? '') === null) {
    errors.tipo_persona = 'Para persona natural el nombre debe incluir nombre y apellido'
  }
  if (!c.regimen) errors.regimen = 'Régimen requerido'
  if (!c.direccion?.trim()) errors.direccion = 'Dirección requerida'
  if (!c.ciudad?.trim()) errors.ciudad = 'Ciudad requerida'
  if (extranjero) {
    if (!c.pais?.trim()) errors.pais = 'País requerido para identificación extranjera'
  } else if (!c.departamento?.trim()) {
    errors.departamento = 'Departamento requerido'
  }
  const email = c.email?.trim() ?? ''
  if (!email) errors.email = 'Email de facturación requerido'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email inválido'

  return errors
}

/** Mensaje para el usuario tras crear/editar un cliente, según el resultado en Alegra. */
export function alegraResultMessage(
  title: string,
  alegra: { status: 'not_applicable' } | { status: 'created' | 'linked'; contactId: string } | { status: 'error'; error: string },
): { title: string; description?: string; variant?: 'destructive' } {
  if (alegra.status === 'created') return { title, description: 'Cliente creado también en Alegra.' }
  if (alegra.status === 'linked') return { title, description: 'Ya existía en Alegra con esa identificación: quedó enlazado.' }
  if (alegra.status === 'error') {
    return {
      title: `${title} (sin Alegra)`,
      description: `No se pudo crear en Alegra: ${alegra.error.substring(0, 200)}. Corrige los datos y usa "Crear en Alegra".`,
      variant: 'destructive',
    }
  }
  return { title }
}

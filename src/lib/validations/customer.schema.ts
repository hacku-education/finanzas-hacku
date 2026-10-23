import { z } from 'zod'

export const customerSchema = z.object({
  nombre_cliente: z.string().min(1, 'Nombre requerido'),
  sociedad_cliente: z.string().optional().nullable(),
  pais: z.string().optional().nullable(),
  ciudad: z.string().optional().nullable(),
  industria: z.string().optional().nullable(),
  kam_responsable: z.string().optional().nullable(),
  plan_actual: z.string().optional().nullable(),
  tiene_factoraje: z.boolean(),
  comentarios_factoraje: z.string().optional().nullable(),
  // Datos fiscales (obligatorios solo para hackÜ SAS → se crea en Alegra)
  email: z.string().optional().nullable(),
  tipo_identificacion: z.string().optional().nullable(),
  numero_identificacion: z.string().optional().nullable(),
  dv: z.string().optional().nullable(),
  tipo_persona: z.string().optional().nullable(),
  regimen: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
  departamento: z.string().optional().nullable(),
})
// Los datos fiscales se validan en el submit con validateFiscal/mustRequireFiscal
// (src/lib/alegra-fiscal.ts): dependen de si es creación o edición.

export type CustomerFormData = z.infer<typeof customerSchema>

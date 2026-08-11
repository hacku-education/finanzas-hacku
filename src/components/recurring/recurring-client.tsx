// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Pencil, Trash2, Plus, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { toggleRecurringTemplate, deleteRecurringTemplate, updateRecurringTemplate } from '@/actions/recurring-templates.actions'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useRouter } from 'next/navigation'

interface Props {
  templates: any[]
}

export function RecurringClient({ templates: initialTemplates }: Props) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState(initialTemplates)
  const [search, setSearch] = useState('')
  const [editTemplate, setEditTemplate] = useState<any>(null)
  const [editItems, setEditItems] = useState<any[]>([])
  const [editData, setEditData] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const filtered = templates.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return (t.alegra_client_name || '').toLowerCase().includes(q) ||
           (t.vendedor_nombre || '').toLowerCase().includes(q) ||
           (t.sociedad || '').toLowerCase().includes(q)
  })

  const openEdit = (t: any) => {
    setEditTemplate(t)
    setEditItems([...(t.items || [])])
    setEditData({
      alegra_client_name: t.alegra_client_name || '',
      dia_recurrencia: t.dia_recurrencia || 1,
      dias_vencimiento: t.dias_vencimiento || 30,
      moneda: t.moneda || 'COP',
      sociedad: t.sociedad || 'hackÜ SAS',
      vendedor_nombre: t.vendedor_nombre || '',
      observaciones: t.observaciones || '',
      anotaciones: t.anotaciones || '',
    })
  }

  const handleSave = async () => {
    if (!editTemplate) return
    setSaving(true)
    try {
      const total = editItems.reduce((sum: number, item: any) => {
        const sub = (item.quantity || 1) * (item.price || 0) * (1 - (item.discount || 0) / 100)
        return sum + sub
      }, 0)

      await updateRecurringTemplate(editTemplate.id, {
        ...editData,
        items: editItems,
        total,
      })

      setTemplates(prev => prev.map(t => t.id === editTemplate.id ? {
        ...t, ...editData, items: editItems, total,
      } : t))

      toast({ title: 'Plantilla actualizada' })
      setEditTemplate(null)
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solicitudes Recurrentes"
        description={`${templates.filter(t => t.activo).length} activas de ${templates.length} total`}
      />

      <Input
        placeholder="Buscar por cliente, vendedor, sociedad..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      <div className="grid gap-4">
        {filtered.map((t) => {
          const items = t.items || []
          const total = t.total || 0
          return (
            <Card key={t.id} className={!t.activo ? 'opacity-50' : ''}>
              <CardContent className="py-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold">{t.alegra_client_name || '—'}</span>
                      <Badge variant="outline" className="text-[10px]">{t.sociedad}</Badge>
                      <Badge variant="outline" className="text-[10px]">{t.moneda}</Badge>
                      <Badge className={t.activo ? 'bg-green-100 text-green-800 text-[10px]' : 'bg-gray-100 text-gray-600 text-[10px]'}>
                        {t.activo ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Dia {t.dia_recurrencia} de cada mes</span>
                      <span>Vence +{t.dias_vencimiento}d</span>
                      <span>KAM: {t.vendedor_nombre || '—'}</span>
                      <span>Total: <strong className="text-foreground">{new Intl.NumberFormat('es-CO').format(total)} {t.moneda}</strong></span>
                    </div>

                    {/* Items */}
                    {items.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {items.map((item: any, i: number) => {
                          const sub = (item.quantity || 1) * (item.price || 0) * (1 - (item.discount || 0) / 100)
                          return (
                            <div key={i} className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{item.name || '—'}</span>
                              <span>{item.quantity}x {new Intl.NumberFormat('es-CO').format(item.price || 0)}</span>
                              {item.discount > 0 && <span className="text-red-500">-{item.discount}%</span>}
                              <span>= {new Intl.NumberFormat('es-CO').format(sub)}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {t.ultima_ejecucion && (
                      <p className="text-[10px] text-muted-foreground mt-2">Ultima ejecucion: {new Date(t.ultima_ejecucion).toLocaleDateString('es-CO')}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Switch
                      checked={t.activo}
                      onCheckedChange={async (checked) => {
                        try {
                          await toggleRecurringTemplate(t.id, checked)
                          setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, activo: checked } : x))
                          toast({ title: checked ? 'Activada' : 'Desactivada' })
                        } catch { toast({ title: 'Error', variant: 'destructive' }) }
                      }}
                    />
                    <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => {
                      if (!confirm('¿Eliminar esta plantilla recurrente?')) return
                      try {
                        await deleteRecurringTemplate(t.id)
                        setTemplates(prev => prev.filter(x => x.id !== t.id))
                        toast({ title: 'Eliminada' })
                      } catch { toast({ title: 'Error', variant: 'destructive' }) }
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No hay solicitudes recurrentes</p>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editTemplate} onOpenChange={(open) => !open && setEditTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Recurrente — {editData.alegra_client_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Client & Sociedad */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Cliente</label>
                <Input value={editData.alegra_client_name} onChange={(e) => setEditData({ ...editData, alegra_client_name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium">Sociedad</label>
                <Select value={editData.sociedad} onValueChange={(v) => setEditData({ ...editData, sociedad: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hackÜ SAS">hackÜ SAS</SelectItem>
                    <SelectItem value="hackÜ LLC">hackÜ LLC</SelectItem>
                    <SelectItem value="hackÜ MEX">hackÜ MEX</SelectItem>
                    <SelectItem value="hackÜ PER">hackÜ PER</SelectItem>
                    <SelectItem value="hackÜ BRA">hackÜ BRA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dia, Vencimiento, Moneda, Vendedor */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium">Dia del mes</label>
                <Input type="number" min="1" max="28" value={editData.dia_recurrencia} onChange={(e) => setEditData({ ...editData, dia_recurrencia: parseInt(e.target.value) || 1 })} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium">Dias vencimiento</label>
                <Input type="number" min="1" max="90" value={editData.dias_vencimiento} onChange={(e) => setEditData({ ...editData, dias_vencimiento: parseInt(e.target.value) || 30 })} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium">Moneda</label>
                <Select value={editData.moneda} onValueChange={(v) => setEditData({ ...editData, moneda: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COP">COP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="MXN">MXN</SelectItem>
                    <SelectItem value="BRL">BRL</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Vendedor</label>
                <Input value={editData.vendedor_nombre} onChange={(e) => setEditData({ ...editData, vendedor_nombre: e.target.value })} className="mt-1" />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold">Items</label>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditItems([...editItems, { name: '', quantity: 1, price: 0, discount: 0, alegra_item_id: '', description: '' }])}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar Item
                </Button>
              </div>

              {editItems.map((item: any, i: number) => (
                <div key={i} className="border rounded p-3 mb-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input className="flex-1 text-sm" placeholder="Nombre del item" value={item.name || ''} onChange={(e) => {
                      const updated = [...editItems]; updated[i] = { ...updated[i], name: e.target.value }; setEditItems(updated)
                    }} />
                    <Button variant="ghost" size="sm" className="text-red-500 h-8 w-8 p-0" onClick={() => setEditItems(editItems.filter((_, idx) => idx !== i))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">Cantidad</label>
                      <Input type="number" min="1" value={item.quantity || 1} className="h-8 text-xs" onChange={(e) => {
                        const updated = [...editItems]; updated[i] = { ...updated[i], quantity: parseInt(e.target.value) || 1 }; setEditItems(updated)
                      }} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Precio</label>
                      <Input type="number" min="0" step="0.01" value={item.price || 0} className="h-8 text-xs" onChange={(e) => {
                        const updated = [...editItems]; updated[i] = { ...updated[i], price: parseFloat(e.target.value) || 0 }; setEditItems(updated)
                      }} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Descuento %</label>
                      <Input type="number" min="0" max="100" value={item.discount || 0} className="h-8 text-xs" onChange={(e) => {
                        const updated = [...editItems]; updated[i] = { ...updated[i], discount: parseFloat(e.target.value) || 0 }; setEditItems(updated)
                      }} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Subtotal</label>
                      <p className="text-xs font-medium h-8 flex items-center">
                        {new Intl.NumberFormat('es-CO').format((item.quantity || 1) * (item.price || 0) * (1 - (item.discount || 0) / 100))}
                      </p>
                    </div>
                  </div>
                  <Input className="text-xs h-7" placeholder="Descripcion / comentarios" value={item.description || ''} onChange={(e) => {
                    const updated = [...editItems]; updated[i] = { ...updated[i], description: e.target.value }; setEditItems(updated)
                  }} />
                </div>
              ))}

              {/* Total */}
              <div className="flex justify-between items-center pt-2 border-t text-sm">
                <span className="font-medium">Total</span>
                <span className="font-bold">
                  {new Intl.NumberFormat('es-CO').format(
                    editItems.reduce((sum: number, item: any) => sum + (item.quantity || 1) * (item.price || 0) * (1 - (item.discount || 0) / 100), 0)
                  )} {editData.moneda}
                </span>
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="text-xs font-medium">Observaciones</label>
              <Input value={editData.observaciones} onChange={(e) => setEditData({ ...editData, observaciones: e.target.value })} className="mt-1" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTemplate(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar Cambios'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

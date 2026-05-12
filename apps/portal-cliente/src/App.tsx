import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  CreditCard,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  MessageSquare,
  ReceiptText,
  Save,
  ShieldCheck,
  User,
  WalletCards,
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const TOKEN_KEY = 'portalClienteToken'

type Cliente = {
  id: number
  nombre: string
  tipo_cliente: string
  documento_numero?: string | null
  ruc?: string | null
  telefono?: string | null
  whatsapp?: string | null
  email?: string | null
  direccion?: string | null
  canal_preferido?: string | null
  estado: string
}

type Menu = {
  id: number
  titulo: string
  descripcion?: string | null
  fecha: string
  precio: string | number
  cupo_total?: number | null
  cupo_reservado: number
  sucursal?: { nombre: string } | null
  items: Array<{ id: number; tipo: string; descripcion?: string | null; producto?: { nombre: string } | null }>
}

type Reserva = {
  id: number
  cantidad: number
  tipo_entrega: string
  observacion?: string | null
  estado: string
  total: string | number
  creado_en: string
  menu: Menu
  venta_id?: number | null
}

type Venta = {
  id: number
  tipo_venta: string
  estado: string
  condicion_pago: string
  total: string | number
  creado_en: string
  facturada?: boolean
  cargada_libreta?: boolean
  items: Array<{ id: number; descripcion: string; cantidad: string | number; total: string | number }>
  pagos?: Array<{ id: number; forma_pago: string; monto: string | number; estado: string }>
}

type Libreta = {
  id: number
  tipo: string
  limite_credito: string | number
  saldo_actual: string | number
  saldo_vencido: string | number
  estado: string
  movimientos: Array<{
    id: number
    tipo_movimiento: string
    descripcion?: string | null
    monto_debe: string | number
    monto_haber: string | number
    saldo_resultante: string | number
    fecha_movimiento: string
  }>
}

type PagosData = {
  disponibles: string[]
  usados: string[]
  pagos: Array<{ id: number; forma_pago: string; monto: string | number; estado: string; fecha_pago: string }>
}

type Dashboard = {
  metricas: {
    reservasPendientes: number
    comprasRecientes: number
    totalCompras: number
    saldoLibreta: number
    pagosRecientes: number
  }
  ventas: Venta[]
  pagos: PagosData['pagos']
  libretas: Libreta[]
}

type Tab = 'dashboard' | 'menu' | 'reservas' | 'compras' | 'libreta' | 'pagos' | 'perfil'

function formatGs(value: string | number) {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-PY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function formatDateLong(value: string) {
  return new Intl.DateTimeFormat('es-PY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado'
}

function Badge({ children, tone = 'blue' }: { children: React.ReactNode; tone?: 'blue' | 'green' | 'red' | 'gray' }) {
  const tones = {
    blue: 'bg-blue-100 text-[#0c3c6e]',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-700',
  }
  return <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${tones[tone]}`}>{children}</span>
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(Boolean(token))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [menus, setMenus] = useState<Menu[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [libretas, setLibretas] = useState<Libreta[]>([])
  const [pagosData, setPagosData] = useState<PagosData>({ disponibles: [], usados: [], pagos: [] })
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null)
  const [authForm, setAuthForm] = useState({ nombre: '', telefono: '', email: '', identificador: '', password: '' })
  const [perfilForm, setPerfilForm] = useState({ nombre: '', telefono: '', email: '', direccion: '', documento_numero: '', ruc: '', password: '' })
  const [reservaForm, setReservaForm] = useState({ cantidad: 1, tipo_entrega: 'LOCAL', observacion: '' })

  const selectedMenu = useMemo(() => menus.find((menu) => menu.id === selectedMenuId) ?? null, [menus, selectedMenuId])
  const cuposDisponibles = selectedMenu?.cupo_total == null ? null : Math.max(selectedMenu.cupo_total - selectedMenu.cupo_reservado, 0)
  const maxCantidad = cuposDisponibles == null ? 20 : Math.max(1, Math.min(20, cuposDisponibles))

  async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Error de API')
    return payload.data
  }

  async function loadMenus() {
    const data = await api<Menu[]>('/portal/menus')
    setMenus(data)
    setSelectedMenuId((current) => current ?? data[0]?.id ?? null)
  }

  async function loadPrivateData() {
    const [me, dash, reservasData, ventasData, libretasData, pagos] = await Promise.all([
      api<Cliente>('/portal/me'),
      api<Dashboard>('/portal/dashboard'),
      api<Reserva[]>('/portal/reservas/mias'),
      api<Venta[]>('/portal/ventas'),
      api<Libreta[]>('/portal/libretas'),
      api<PagosData>('/portal/pagos'),
      loadMenus(),
    ])
    setCliente(me)
    setDashboard(dash)
    setReservas(reservasData)
    setVentas(ventasData)
    setLibretas(libretasData)
    setPagosData(pagos)
    setPerfilForm({
      nombre: me.nombre || '',
      telefono: me.telefono || me.whatsapp || '',
      email: me.email || '',
      direccion: me.direccion || '',
      documento_numero: me.documento_numero || '',
      ruc: me.ruc || '',
      password: '',
    })
  }

  useEffect(() => {
    async function boot() {
      try {
        await loadMenus()
        if (token) await loadPrivateData()
      } catch (err) {
        setError(getErrorMessage(err))
        if (token) {
          localStorage.removeItem(TOKEN_KEY)
          setToken('')
        }
      } finally {
        setLoading(false)
      }
    }
    boot()
  }, [])

  async function handleAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const path = authMode === 'login' ? '/portal/auth/login' : '/portal/auth/register'
      const body = authMode === 'login'
        ? { identificador: authForm.identificador, password: authForm.password }
        : { nombre: authForm.nombre, telefono: authForm.telefono, email: authForm.email, password: authForm.password }
      const data = await api<{ token: string; cliente: Cliente }>(path, { method: 'POST', body: JSON.stringify(body) })
      localStorage.setItem(TOKEN_KEY, data.token)
      setToken(data.token)
      setCliente(data.cliente)
      setMessage('Bienvenido al portal del cliente.')
      setTimeout(() => loadPrivateData().catch((err) => setError(getErrorMessage(err))), 0)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleReserva(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedMenu) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api<Reserva>('/portal/reservas', {
        method: 'POST',
        body: JSON.stringify({
          menu_id: selectedMenu.id,
          cantidad: reservaForm.cantidad,
          tipo_entrega: reservaForm.tipo_entrega,
          observacion: reservaForm.observacion,
        }),
      })
      setMessage('Reserva registrada correctamente.')
      setReservaForm({ cantidad: 1, tipo_entrega: 'LOCAL', observacion: '' })
      await loadPrivateData()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handlePerfil(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const data = await api<Cliente>('/portal/me', {
        method: 'PUT',
        body: JSON.stringify(perfilForm.password ? perfilForm : { ...perfilForm, password: undefined }),
      })
      setCliente(data)
      setPerfilForm((current) => ({ ...current, password: '' }))
      setMessage('Perfil actualizado.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setCliente(null)
    setTab('dashboard')
    setMessage('')
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    { id: 'menu', label: 'Menú del día', icon: ChefHat },
    { id: 'reservas', label: 'Reservas', icon: CalendarDays },
    { id: 'compras', label: 'Historial', icon: History },
    { id: 'libreta', label: 'Libreta', icon: WalletCards },
    { id: 'pagos', label: 'Pagos', icon: CreditCard },
    { id: 'perfil', label: 'Perfil', icon: User },
  ]

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 text-[#0c3c6e]">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        Cargando portal...
      </div>
    )
  }

  if (!token || !cliente) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-[#0c3c6e] text-white shadow-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
                <ChefHat className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-white/80">Portal del cliente</p>
                <p className="font-semibold">Sistema comedor</p>
              </div>
            </div>
            <ShieldCheck className="h-6 w-6 text-white/80" />
          </div>
        </header>

        <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_420px]">
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-bold uppercase tracking-widest text-[#0c3c6e]">Menú del día</p>
            <h1 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">Reservá, consultá tu libreta y revisá tus compras.</h1>
            <p className="mt-3 max-w-2xl text-gray-600">
              Accedé con tu cuenta para ver tu perfil, historial, reservas, pagos y saldo de libreta en un solo lugar.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {menus.slice(0, 2).map((menu) => (
                <div key={menu.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-medium capitalize text-gray-500">{formatDateLong(menu.fecha)}</p>
                  <p className="mt-1 font-semibold text-gray-900">{menu.titulo}</p>
                  <p className="mt-2 text-sm font-bold text-[#0c3c6e]">{formatGs(menu.precio)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5 grid grid-cols-2 rounded-lg bg-gray-100 p-1">
              <button className={`rounded-md px-3 py-2 text-sm font-bold ${authMode === 'login' ? 'bg-white text-[#0c3c6e] shadow-sm' : 'text-gray-600'}`} onClick={() => setAuthMode('login')}>
                Ingresar
              </button>
              <button className={`rounded-md px-3 py-2 text-sm font-bold ${authMode === 'register' ? 'bg-white text-[#0c3c6e] shadow-sm' : 'text-gray-600'}`} onClick={() => setAuthMode('register')}>
                Crear cuenta
              </button>
            </div>

            {error && <Notice tone="error">{error}</Notice>}
            {message && <Notice tone="success">{message}</Notice>}

            <form className="space-y-4" onSubmit={handleAuth}>
              {authMode === 'register' ? (
                <>
                  <Field label="Nombre y apellido" value={authForm.nombre} onChange={(value) => setAuthForm({ ...authForm, nombre: value })} required />
                  <Field label="WhatsApp / teléfono" value={authForm.telefono} onChange={(value) => setAuthForm({ ...authForm, telefono: value })} required />
                  <Field label="Correo electrónico" type="email" value={authForm.email} onChange={(value) => setAuthForm({ ...authForm, email: value })} />
                </>
              ) : (
                <Field label="Email o teléfono" value={authForm.identificador} onChange={(value) => setAuthForm({ ...authForm, identificador: value })} required />
              )}
              <Field label="Contraseña" type="password" value={authForm.password} onChange={(value) => setAuthForm({ ...authForm, password: value })} required />
              <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0c3c6e] px-4 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#0a325c] disabled:bg-gray-400" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {authMode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            </form>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-[#0c3c6e] text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-white/80">Portal del cliente</p>
              <p className="font-semibold">{cliente.nombre}</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20">
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr]">
        <aside className="h-fit rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <nav className="grid gap-1">
            {tabs.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                    tab === item.id ? 'bg-[#0c3c6e] text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </aside>

        <main>
          {error && <Notice tone="error">{error}</Notice>}
          {message && <Notice tone="success">{message}</Notice>}
          {tab === 'dashboard' && <DashboardView dashboard={dashboard} reservas={reservas} ventas={ventas} />}
          {tab === 'menu' && (
            <MenuView
              menus={menus}
              selectedMenu={selectedMenu}
              selectedMenuId={selectedMenuId}
              setSelectedMenuId={setSelectedMenuId}
              reservaForm={reservaForm}
              setReservaForm={setReservaForm}
              cuposDisponibles={cuposDisponibles}
              maxCantidad={maxCantidad}
              busy={busy}
              onSubmit={handleReserva}
            />
          )}
          {tab === 'reservas' && <ReservasView reservas={reservas} />}
          {tab === 'compras' && <ComprasView ventas={ventas} />}
          {tab === 'libreta' && <LibretaView libretas={libretas} />}
          {tab === 'pagos' && <PagosView data={pagosData} />}
          {tab === 'perfil' && (
            <PerfilView form={perfilForm} setForm={setPerfilForm} busy={busy} onSubmit={handlePerfil} cliente={cliente} />
          )}
        </main>
      </div>
    </div>
  )
}

function Notice({ children, tone }: { children: React.ReactNode; tone: 'error' | 'success' }) {
  const isError = tone === 'error'
  return (
    <div className={`mb-5 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${isError ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
      {isError ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />}
      <span>{children}</span>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-800">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none ring-[#0c3c6e]/20 transition-shadow focus:border-[#0c3c6e] focus:ring-2"
      />
    </label>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4">
        <h1 className="text-xl font-bold uppercase tracking-wide text-[#0c3c6e]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function DashboardView({ dashboard, reservas, ventas }: { dashboard: Dashboard | null; reservas: Reserva[]; ventas: Venta[] }) {
  const metricas = dashboard?.metricas
  return (
    <Section title="Resumen" subtitle="Tu actividad reciente en el comedor.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Reservas activas" value={metricas?.reservasPendientes ?? reservas.filter((r) => !['CANCELADA', 'ENTREGADA'].includes(r.estado)).length} icon={CalendarDays} />
        <Metric label="Compras" value={ventas.length} icon={ReceiptText} />
        <Metric label="Total comprado" value={formatGs(metricas?.totalCompras ?? 0)} icon={History} />
        <Metric label="Saldo libreta" value={formatGs(metricas?.saldoLibreta ?? 0)} icon={WalletCards} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Próximas reservas">
          <ReservaList reservas={reservas.slice(0, 4)} compact />
        </Card>
        <Card title="Últimas compras">
          <VentaList ventas={ventas.slice(0, 4)} compact />
        </Card>
      </div>
    </Section>
  )
}

function Metric({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
        <Icon className="h-5 w-5 text-[#0c3c6e]" />
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-[#0c3c6e]">{title}</h2>
      {children}
    </div>
  )
}

function MenuView(props: {
  menus: Menu[]
  selectedMenu: Menu | null
  selectedMenuId: number | null
  setSelectedMenuId: (id: number) => void
  reservaForm: { cantidad: number; tipo_entrega: string; observacion: string }
  setReservaForm: (form: { cantidad: number; tipo_entrega: string; observacion: string }) => void
  cuposDisponibles: number | null
  maxCantidad: number
  busy: boolean
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const { menus, selectedMenu, selectedMenuId, setSelectedMenuId, reservaForm, setReservaForm, cuposDisponibles, maxCantidad, busy, onSubmit } = props
  return (
    <Section title="Menú del día" subtitle="Elegí un menú publicado y confirmá tu reserva.">
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card title="Menús publicados">
          {menus.length === 0 ? (
            <Empty icon={CalendarDays} text="No hay menús publicados." />
          ) : (
            <ul className="space-y-3">
              {menus.map((menu) => {
                const disponibles = menu.cupo_total == null ? null : Math.max(menu.cupo_total - menu.cupo_reservado, 0)
                const agotado = disponibles === 0
                return (
                  <li key={menu.id}>
                    <button
                      disabled={agotado}
                      onClick={() => setSelectedMenuId(menu.id)}
                      className={`w-full rounded-lg border p-4 text-left ${selectedMenuId === menu.id ? 'border-[#0c3c6e] bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'} ${agotado ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <div className="flex justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium capitalize text-gray-500">{formatDateLong(menu.fecha)}</p>
                          <p className="mt-1 font-semibold text-gray-900">{menu.titulo}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><MapPin className="h-3.5 w-3.5" /> {menu.sucursal?.nombre || 'Sucursal'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#0c3c6e]">{formatGs(menu.precio)}</p>
                          <Badge tone={agotado ? 'red' : 'green'}>{agotado ? 'Agotado' : disponibles == null ? 'Cupo abierto' : `${disponibles} lugares`}</Badge>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
        <Card title="Confirmar reserva">
          {!selectedMenu ? (
            <Empty icon={ChefHat} text="Seleccioná un menú para continuar." />
          ) : (
            <form onSubmit={onSubmit}>
              <p className="text-lg font-semibold text-gray-900">{selectedMenu.titulo}</p>
              <p className="mt-1 text-sm text-gray-600">{selectedMenu.descripcion || 'Menú listo para retirar o consumir en el local.'}</p>
              <ul className="mt-4 space-y-1 text-sm text-gray-700">
                {selectedMenu.items.map((item) => <li key={item.id}>• {item.producto?.nombre || item.descripcion || item.tipo}</li>)}
              </ul>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Cantidad</span>
                  <input type="number" min={1} max={maxCantidad} value={reservaForm.cantidad} onChange={(e) => setReservaForm({ ...reservaForm, cantidad: Math.min(maxCantidad, Math.max(1, Number(e.target.value))) })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Entrega</span>
                  <select value={reservaForm.tipo_entrega} onChange={(e) => setReservaForm({ ...reservaForm, tipo_entrega: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm">
                    <option value="LOCAL">En el local</option>
                    <option value="RETIRAR">Para retirar</option>
                    <option value="DELIVERY">Delivery</option>
                  </select>
                </label>
              </div>
              <label className="mt-4 block">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold"><MessageSquare className="h-4 w-4" /> Observación</span>
                <textarea value={reservaForm.observacion} onChange={(e) => setReservaForm({ ...reservaForm, observacion: e.target.value })} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" />
              </label>
              <div className="mt-5 flex items-center justify-between border-t pt-4">
                <span className="text-sm text-gray-500">Total estimado</span>
                <span className="text-xl font-bold text-[#0c3c6e]">{formatGs(Number(selectedMenu.precio) * reservaForm.cantidad)}</span>
              </div>
              <button disabled={busy || cuposDisponibles === 0} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0c3c6e] px-4 py-3 text-sm font-bold uppercase text-white disabled:bg-gray-400">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {cuposDisponibles === 0 ? 'Sin cupo disponible' : 'Reservar menú'}
              </button>
            </form>
          )}
        </Card>
      </div>
    </Section>
  )
}

function ReservasView({ reservas }: { reservas: Reserva[] }) {
  return <Section title="Mis reservas" subtitle="Seguimiento de tus reservas realizadas."><Card title="Reservas"><ReservaList reservas={reservas} /></Card></Section>
}

function ReservaList({ reservas, compact = false }: { reservas: Reserva[]; compact?: boolean }) {
  if (reservas.length === 0) return <Empty icon={CalendarDays} text="Todavía no tenés reservas." />
  return (
    <ul className="space-y-3">
      {reservas.map((reserva) => (
        <li key={reserva.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium capitalize text-gray-500">{formatDateLong(reserva.menu.fecha)}</p>
              <p className="mt-1 font-semibold text-gray-900">{reserva.menu.titulo}</p>
              {!compact && <p className="mt-1 text-xs text-gray-500">{reserva.cantidad} porciones · {reserva.tipo_entrega}</p>}
            </div>
            <Badge tone={reserva.estado === 'CANCELADA' ? 'red' : reserva.estado === 'ENTREGADA' ? 'green' : 'blue'}>{reserva.estado}</Badge>
          </div>
          {!compact && <p className="mt-3 border-t pt-3 text-sm font-bold text-[#0c3c6e]">{formatGs(reserva.total)}</p>}
        </li>
      ))}
    </ul>
  )
}

function ComprasView({ ventas }: { ventas: Venta[] }) {
  return <Section title="Historial de compras" subtitle="Todas tus compras registradas en el comedor."><Card title="Compras"><VentaList ventas={ventas} /></Card></Section>
}

function VentaList({ ventas, compact = false }: { ventas: Venta[]; compact?: boolean }) {
  if (ventas.length === 0) return <Empty icon={ReceiptText} text="Todavía no tenés compras registradas." />
  return (
    <ul className="space-y-3">
      {ventas.map((venta) => (
        <li key={venta.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900">Compra #{venta.id}</p>
              <p className="text-xs text-gray-500">{formatDate(venta.creado_en)} · {venta.tipo_venta} · {venta.condicion_pago}</p>
            </div>
            <p className="font-bold text-[#0c3c6e]">{formatGs(venta.total)}</p>
          </div>
          {!compact && (
            <ul className="mt-3 border-t pt-3 text-sm text-gray-600">
              {venta.items.map((item) => <li key={item.id}>{item.descripcion} · {formatGs(item.total)}</li>)}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

function LibretaView({ libretas }: { libretas: Libreta[] }) {
  return (
    <Section title="Libreta de cuenta" subtitle="Saldo, límite y movimientos de tu cuenta corriente.">
      {libretas.length === 0 ? <Card title="Libreta"><Empty icon={WalletCards} text="No tenés libreta activa." /></Card> : (
        <div className="grid gap-4">
          {libretas.map((libreta) => (
            <Card key={libreta.id} title={`Libreta ${libreta.tipo}`}>
              <div className="grid gap-4 sm:grid-cols-3">
                <Metric label="Saldo actual" value={formatGs(libreta.saldo_actual)} icon={WalletCards} />
                <Metric label="Saldo vencido" value={formatGs(libreta.saldo_vencido)} icon={AlertCircle} />
                <Metric label="Límite" value={formatGs(libreta.limite_credito)} icon={CreditCard} />
              </div>
              <h3 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-gray-500">Movimientos</h3>
              {libreta.movimientos.length === 0 ? <Empty icon={ReceiptText} text="Sin movimientos." /> : (
                <ul className="space-y-2">
                  {libreta.movimientos.map((mov) => (
                    <li key={mov.id} className="flex justify-between rounded-lg bg-gray-50 p-3 text-sm">
                      <div>
                        <p className="font-semibold text-gray-900">{mov.descripcion || mov.tipo_movimiento}</p>
                        <p className="text-xs text-gray-500">{formatDate(mov.fecha_movimiento)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{Number(mov.monto_debe) > 0 ? formatGs(mov.monto_debe) : formatGs(mov.monto_haber)}</p>
                        <p className="text-xs text-gray-500">Saldo {formatGs(mov.saldo_resultante)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </Section>
  )
}

function PagosView({ data }: { data: PagosData }) {
  return (
    <Section title="Métodos de pago" subtitle="Formas disponibles y pagos aplicados a tus compras/libreta.">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card title="Formas disponibles">
          <div className="grid gap-2">
            {data.disponibles.map((metodo) => <div key={metodo} className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm font-semibold"><CreditCard className="h-4 w-4 text-[#0c3c6e]" />{metodo}</div>)}
          </div>
        </Card>
        <Card title="Pagos recientes">
          {data.pagos.length === 0 ? <Empty icon={CreditCard} text="Todavía no tenés pagos registrados." /> : (
            <ul className="space-y-3">
              {data.pagos.map((pago) => (
                <li key={pago.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <p className="font-semibold text-gray-900">{pago.forma_pago}</p>
                    <p className="text-xs text-gray-500">{formatDate(pago.fecha_pago)} · {pago.estado}</p>
                  </div>
                  <p className="font-bold text-[#0c3c6e]">{formatGs(pago.monto)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Section>
  )
}

function PerfilView({ form, setForm, busy, onSubmit, cliente }: { form: Record<string, string>; setForm: (form: any) => void; busy: boolean; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; cliente: Cliente }) {
  return (
    <Section title="Mi perfil" subtitle="Datos personales y acceso al portal.">
      <form onSubmit={onSubmit} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-5 rounded-lg bg-blue-50 p-4 text-sm text-[#0c3c6e]">
          Cliente #{cliente.id} · Estado {cliente.estado}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" value={form.nombre} onChange={(value) => setForm({ ...form, nombre: value })} required />
          <Field label="Teléfono" value={form.telefono} onChange={(value) => setForm({ ...form, telefono: value })} />
          <Field label="Correo electrónico" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          <Field label="Dirección" value={form.direccion} onChange={(value) => setForm({ ...form, direccion: value })} />
          <Field label="Documento" value={form.documento_numero} onChange={(value) => setForm({ ...form, documento_numero: value })} />
          <Field label="RUC" value={form.ruc} onChange={(value) => setForm({ ...form, ruc: value })} />
          <Field label="Nueva contraseña" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
        </div>
        <button disabled={busy} className="mt-5 flex items-center gap-2 rounded-lg bg-[#0c3c6e] px-4 py-3 text-sm font-bold uppercase text-white disabled:bg-gray-400">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar perfil
        </button>
      </form>
    </Section>
  )
}

function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="rounded-lg bg-gray-50 py-10 text-center text-sm text-gray-500">
      <Icon className="mx-auto mb-3 h-8 w-8 text-gray-400" />
      {text}
    </div>
  )
}

export default App

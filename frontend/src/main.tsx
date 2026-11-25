import {useEffect,useMemo,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {Activity,ArrowDownToLine,ArrowRight,Bell,BookOpen,CalendarDays,ChartNoAxesCombined,ChevronLeft,ChevronRight,CircleCheck,Clock3,FlaskConical,GraduationCap,History,Layers3,LayoutDashboard,ListOrdered,Menu,Moon,Play,Pause,Plug,RotateCcw,Search,Settings,ShieldCheck,Sun,Ticket,Upload,Users,Workflow,X} from 'lucide-react'
import {Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts'
import {Button} from './components/ui/button'
import {accept,advance,compare,complete,courses,create,dateAt,defaults,eligible,event,exportCsv,importCsv,loadState,localDate,localDateTime,metrics,notice,queue,rotate,safeConfig,storageKey,transferLimit} from './engine'
import type {Cohort,Config,State,Strategy} from './engine'
import {updateScenario} from './persistence'
import './style.css'

const pages=[
  ['Dashboard',LayoutDashboard],['Simulador',FlaskConical],['Estudiantes',Users],['Licencias',Ticket],['Cohortes',Layers3],['Cola de espera',ListOrdered],['Cursos y certificaciones',BookOpen],['Automatizaciones',Workflow],['Integraciones',Plug],['Auditoría',History],['Configuración',Settings],['Notificaciones',Bell],
] as const
const slugs=['dashboard','simulador','estudiantes','licencias','cohortes','cola','cursos','automatizaciones','integraciones','auditoria','configuracion','notificaciones']
const currentPage=()=>Math.max(0,slugs.indexOf(location.hash.slice(1)))
const strategies:Record<Strategy,string>={fifo:'FIFO dinámico',cohort:'Por cohortes',manual:'Gestión manual'}
const nf=new Intl.NumberFormat('es-CL')
const fmt=(n:number)=>nf.format(n)
type Mutation=(fn:(s:State)=>void)=>Promise<boolean>
function download(name:string,rows:object[]) {
  const url=URL.createObjectURL(new Blob(['\ufeff',exportCsv(rows)],{type:'text/csv;charset=utf-8'}))
  const link=document.createElement('a')
  link.href=url; link.download=name+'.csv';link.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function Badge({children,tone='blue'}:{children:React.ReactNode;tone?:string}) {return <span className={'badge '+tone}>{children}</span>}
function Panel({title,sub,action,children}:{title:string;sub?:string;action?:React.ReactNode;children:React.ReactNode}) {
  return <section className="panel"><header className="panel-head"><div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div>{action}</header>{children}</section>
}
function Table({headers,rows}:{headers:string[];rows:React.ReactNode[][]}) {
  return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length?rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>):<tr><td colSpan={headers.length} className="empty">Sin registros para mostrar.</td></tr>}</tbody></table></div>
}
function Pager({page,total,set}:{page:number;total:number;set:(n:number)=>void}) {
  return <div className="pager"><span>Página {page+1} de {Math.max(1,Math.ceil(total/12))} · {fmt(total)} registros</span><Button aria-label="Página anterior" variant="outline" disabled={!page} onClick={()=>set(page-1)}><ChevronLeft size={16}/></Button><Button aria-label="Página siguiente" variant="outline" disabled={(page+1)*12>=total} onClick={()=>set(page+1)}><ChevronRight size={16}/></Button></div>
}
function Chart({s}:{s:State}) {
  const data=s.history.length===1?[...s.history,{day:s.day+1,used:null,waiting:null,certified:null,coverage:null}]:s.history
  return <div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{left:-18,right:14,top:15}}><defs><linearGradient id="bluefill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4775ed" stopOpacity=".3"/><stop offset="100%" stopColor="#4775ed" stopOpacity=".02"/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 5"/><XAxis dataKey="day" tickFormatter={d=>'Día '+d} tick={{fill:'var(--muted)',fontSize:11}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fill:'var(--muted)',fontSize:11}} axisLine={false} tickLine={false}/><Tooltip labelFormatter={d=>'Día '+d} contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'10px'}}/><Area type="monotone" dataKey="waiting" name="En espera" stroke="#8b9bbd" fill="transparent" strokeWidth={2} dot={s.day===0}/><Area type="monotone" dataKey="used" name="Licencias ocupadas" stroke="#416de0" fill="url(#bluefill)" strokeWidth={3} dot={s.day===0}/><Area type="monotone" dataKey="certified" name="Certificaciones" stroke="#25a889" fill="transparent" strokeWidth={2}/></AreaChart></ResponsiveContainer></div>
}
function Stats({s,compact=false}:{s:State;compact?:boolean}) {
  const m=metrics(s)
  const rows=[
    ['Licencias contratadas',s.config.capacity,Ticket,'blue',m.used+' ocupadas · '+m.available+' disponibles'],
    ['Estudiantes registrados',s.students.length,Users,'purple',m.waiting+' en lista de espera'],
    ['Utilización de licencias',m.utilization+'%',Activity,'green',m.active+' estudiantes activos'],
    ['Cobertura potencial',m.projected,ChartNoAxesCombined,'orange',m.coverage+' estudiantes con acceso'],
    ['Certificaciones obtenidas',m.certified,GraduationCap,'green','Evidencia simulada'],
    ['Reasignaciones ejecutadas',s.transfers,RotateCcw,'blue',m.remaining+' transferencias restantes'],
    ['Alertas pendientes',m.alerts,Bell,'orange','Bandeja de notificaciones'],
    ['Licencias disponibles',m.available,Layers3,'purple','Capacidad reconciliada'],
  ] as const
  return <div className="stats">{rows.slice(0,compact?4:8).map(([label,value,Icon,tone,hint])=><article className="stat" key={label}><div className="stat-top"><span>{label}</span><span className={'icon-box '+tone}><Icon size={18}/></span></div><strong>{typeof value==='number'?fmt(value):value}</strong><small>{hint}</small></article>)}</div>
}
function Recent({s,limit=7}:{s:State;limit?:number}) {
  return <div className="activity-list">{s.events.slice(-limit).reverse().map(e=><div key={e.id}><span className="activity-icon"><History size={15}/></span><div><strong>{e.action}</strong><small>{e.student?'Estudiante #'+e.student+' · ':''}{e.reason}</small></div><span className="muted">Día {e.day}</span></div>)}</div>
}
function Dashboard({s,go}:{s:State;go:(n:number)=>void}) {
  const m=metrics(s)
  return <>
    <section className="hero"><div className="hero-content"><div className="hero-tag"><span/> PERÍODO ACADÉMICO SIMULADO</div><h2>Gestión de microcredenciales</h2><p>Administra cupos, acompaña el progreso académico y explora la rotación de licencias en un entorno con datos ficticios.</p><Button onClick={()=>go(1)}><FlaskConical size={17}/> Abrir simulador <ArrowRight size={16}/></Button></div><div className="hero-graphic" aria-hidden><div className="radar radar-a"/><div className="radar radar-b"/><div className="radar radar-c"/><div className="hero-mark"><GraduationCap size={68} strokeWidth={1.15}/></div></div></section>
    <Stats s={s}/>
    <div className="grid-main"><Panel title="Evolución de licencias" sub="Ocupación, lista de espera y certificaciones por día simulado" action={<Badge>Día {s.day}</Badge>}><Chart s={s}/><div className="legend"><span>● Licencias ocupadas</span><span>● En espera</span><span>● Certificaciones</span></div></Panel>
    <Panel title="Distribución por cohortes" sub="Participación e hitos académicos">{s.cohorts.slice(0,6).map(c=>{const p=s.students.filter(p=>p.cohort===c.id);const active=p.filter(p=>p.first!==undefined).length;return <div className="track-row" key={c.id}><div><strong>{c.name}</strong><span>{active} / {p.length} con acceso</span></div><progress max={p.length||1} value={active}/></div>})}<div className="contract-hint"><ShieldCheck size={18}/><span>{m.remaining} transferencias restantes de {transferLimit(s)} autorizadas en este escenario.</span></div></Panel></div>
    <div className="grid-main"><Panel title="Actividad reciente" action={<Button variant="ghost" onClick={()=>go(9)}>Ver auditoría <ArrowRight size={15}/></Button>}><Recent s={s} limit={4}/></Panel><Panel title="Progreso académico">{['Sin iniciar','En progreso','Completado'].map((label,i)=>{const count=s.students.filter(p=>i===0?p.progress===0:i===1?p.progress>0&&p.progress<100:p.progress===100).length;return <div className="track-row" key={label}><div><strong>{label}</strong><span>{count}</span></div><progress max={s.students.length} value={count}/></div>})}</Panel></div>
  </>
}
function Rules({config,set,advanced=false}:{config:Config;set:(c:Config)=>void;advanced?:boolean}) {
  const number=(key:keyof Config,label:string,min:number,max:number)=><label key={key}>{label}<input type="number" min={min} max={max} value={String(config[key])} onChange={e=>set({...config,[key]:Number(e.target.value)})}/></label>
  return <div className="form-grid">
    {number('count','Estudiantes',1,5000)}{number('capacity','Licencias',1,2000)}
    <label>Estrategia<select value={config.strategy} onChange={e=>set({...config,strategy:e.target.value as Strategy})}>{Object.entries(strategies).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    {number('duration','Duración del curso (días)',2,365)}{number('year','Año académico (días)',2,366)}{number('percent','Transferencias máximas (%)',0,5000)}{number('maxTransfers','Máximo de transferencias',0,5000)}
    {advanced&&<>{number('grace','Período de gracia (días)',0,365)}{number('maxDays','Alerta de duración máxima (días)',1,366)}{number('interval','Intervalo de ejecución (días)',1,366)}{number('sctHours','Horas por SCT de referencia',1,1000)}
    <label>Inicio contractual<input type="date" value={config.startDate} onChange={e=>set({...config,startDate:e.target.value})}/></label>
    <label>Dominio ficticio permitido<input value={config.domain} onChange={e=>set({...config,domain:e.target.value.toLowerCase()})}/></label>
    <label>Correo ficticio de operaciones<input type="email" value={config.recipient} onChange={e=>set({...config,recipient:e.target.value})}/></label>
    {([['auto','Automatización habilitada'],['approval','Aprobación humana requerida'],['autoAccept','Autoaceptar invitaciones simuladas']] as const).map(([key,label])=><label className="check" key={key}><input type="checkbox" checked={config[key]} onChange={e=>set({...config,[key]:e.target.checked})}/>{label}</label>)}</>}
  </div>
}
function Simulator({s,mutate,reset,running,setRunning,speed,setSpeed}:{s:State;mutate:Mutation;reset:(c:Config)=>void;running:boolean;setRunning:(b:boolean)=>void;speed:number;setSpeed:(n:number)=>void}) {
  const [draft,setDraft]=useState(s.config)
  const [comparison,setComparison]=useState<ReturnType<typeof compare>>([])
  const m=metrics(s)
  const last=s.events.findLast(e=>e.action==='Licencia reasignada')
  const lastLicense=s.licenses.find(l=>l.id===last?.license)
  const step=(days:number)=>mutate(v=>advance(v,days))
  return <>
    <Panel title="License Rotation Simulator" sub="Configura un escenario y observa el efecto de las reglas contractuales." action={<Badge tone="purple">{strategies[s.config.strategy]}</Badge>}>
      <div className="actions presets"><Button variant="outline" onClick={()=>setDraft({...draft,percent:150,maxTransfers:300})}>Convenio hipotético</Button><Button variant="outline" onClick={()=>setDraft({...draft,percent:10,maxTransfers:5000})}>Convenio restrictivo · 10%</Button></div>
      <form onSubmit={e=>{e.preventDefault();reset(draft)}}><Rules config={draft} set={setDraft}/><div className="actions"><Button variant="outline" type="submit"><RotateCcw size={16}/> Aplicar y reiniciar escenario</Button><label className="speed">Velocidad<select value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value="550">1 día / 550 ms</option><option value="220">1 día / 220 ms</option><option value="70">1 día / 70 ms</option></select></label></div></form>
    </Panel>
    <Panel title="Controles de simulación" sub={`Día ${s.day} de ${s.config.year} · ${localDate(dateAt(s))} · America/Santiago`} action={<Badge tone={running?'green':'blue'}>{running?'En ejecución':'En pausa'}</Badge>}>
      <div className="actions">
        <Button disabled={running||s.day>=s.config.year} onClick={()=>setRunning(true)}><Play size={16}/> Iniciar simulación</Button>
        <Button variant="outline" disabled={!running} onClick={()=>setRunning(false)}><Pause size={16}/> Pausar</Button>
        <Button variant="outline" disabled={s.day>=s.config.year} onClick={()=>step(1)}>Avanzar un día</Button>
        <Button variant="outline" disabled={s.day>=s.config.year} onClick={()=>step(7)}>Avanzar una semana</Button>
        <Button variant="outline" disabled={!m.inTraining} onClick={()=>mutate(v=>complete(v,10))}>Completar 10 estudiantes</Button>
        <Button variant="outline" disabled={!m.inTraining} onClick={()=>mutate(v=>{const current=v.students.find(p=>p.membership==='Activa'&&p.progress<100)?.cohort;complete(v,5000,v.students.filter(p=>p.cohort===current).map(p=>p.id))})}>Completar el tramo actual</Button>
        <Button variant="outline" disabled={s.day>=s.config.year} onClick={()=>mutate(v=>{v.manual++;rotate(v,false,'Operador')})}>Ejecutar rotación</Button>
        <Button variant="outline" disabled={s.day>=s.config.year} onClick={()=>{setRunning(false);step(s.config.year-s.day)}}>Simular año académico</Button>
        <Button variant="ghost" onClick={()=>reset(s.config)}>Reiniciar escenario</Button>
      </div>
      {s.alert&&<div className="warning" role="status">{s.alert}</div>}
      {last&&<div className="transfer" key={last.id}><Ticket size={19}/> <span>Licencia #{last.license}</span><span>{s.students.find(p=>p.id===lastLicense?.previous)?.name??'Cupo confirmado'}</span><ArrowRight size={20}/><strong>{s.students.find(p=>p.id===last.student)?.name}</strong></div>}
    </Panel>
    <Stats s={s}/>
    <div className="grid-main"><Panel title="Evolución de la simulación"><Chart s={s}/></Panel><Panel title="Eventos del motor"><Recent s={s} limit={5}/></Panel></div>
    <Panel title="Comparación de estrategias" sub="Usa el escenario aplicado. La revisión manual ocurre cada 30 días y la espera se mide para estudiantes con acceso." action={<Button variant="outline" onClick={()=>setComparison(compare(s.config))}>Calcular comparación</Button>}>
      {comparison.length>0&&<Table headers={['Estrategia','Espera media','Ocupación media','Cobertura','Certificados','Revisiones manuales']} rows={comparison.map(r=>[strategies[r.strategy],r.wait+' días',r.utilization+'%',r.coverage,r.certified,r.manual])}/>}
    </Panel>
  </>
}
function Registry({s,mutate}:{s:State;mutate:Mutation}) {
  const [search,setSearch]=useState('')
  const [status,setStatus]=useState('')
  const [page,setPage]=useState(0)
  const [detail,setDetail]=useState<number>()
  const [selected,setSelected]=useState<number[]>([])
  const [feedback,setFeedback]=useState('')
  const file=useRef<HTMLInputElement>(null)
  const p=s.students.find(p=>p.id===detail)
  const students=s.students.filter(p=>(!status||p.status===status)&&[p.name,p.email,String(p.id)].some(v=>v.toLowerCase().includes(search.toLowerCase())))
  const actual=Math.min(page,Math.max(0,Math.ceil(students.length/12)-1))
  const changeStatus=(enabled:boolean)=>{
    if(!window.confirm('¿Actualizar el estado institucional de los estudiantes seleccionados?')) return
    mutate(v=>v.students.filter(p=>selected.includes(p.id)).forEach(p=>{
      const previous=p.status
      p.enabled=enabled
      if(p.membership==='Sin membresía') p.status=enabled?'En lista de espera':'Suspendido'
      event(v,'Estado institucional actualizado',enabled?'Cuenta habilitada':'Cuenta inactiva',p,undefined,previous,p.status,'Correcto','Operador')
    }))
    setSelected([])
  }
  return <>
    <Panel title="Registro de estudiantes" sub="Identidades ficticias, elegibilidad y trayectoria académica." action={<div className="actions"><Button variant="outline" onClick={()=>file.current?.click()}><Upload size={16}/> Importar CSV</Button><Button variant="outline" onClick={()=>download('estudiantes',students.map(p=>({id:p.id,nombre:p.name,correo:p.email,cohorte:p.cohort,estado:p.status,progreso:p.progress})))}><ArrowDownToLine size={16}/> Exportar</Button></div>}>
      <input ref={file} hidden type="file" accept=".csv,text/csv" onChange={async e=>{const input=e.currentTarget;const f=input.files?.[0];input.value='';if(!f)return;if(f.size>2_000_000){setFeedback('El archivo supera 2 MB.');return}try{const value=await f.text();let imported=0;if(await mutate(v=>{imported=importCsv(v,value)}))setFeedback(imported+(imported===1?' estudiante importado.':' estudiantes importados.'))}catch(err){setFeedback(err instanceof Error?err.message:'No se pudo leer el archivo.')}}}/>
      <div className="actions filters"><label className="search"><Search size={16}/><input aria-label="Buscar estudiantes" placeholder="Buscar nombre, correo o ID" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}}/></label><select aria-label="Filtrar por estado" value={status} onChange={e=>{setStatus(e.target.value);setPage(0)}}><option value="">Todos los estados</option>{[...new Set(s.students.map(p=>p.status))].map(v=><option key={v}>{v}</option>)}</select>{selected.length>0&&<><Button variant="outline" onClick={()=>changeStatus(true)}>Habilitar ({selected.length})</Button><Button variant="outline" onClick={()=>changeStatus(false)}>Suspender ({selected.length})</Button></>}</div>
      {feedback&&<p className="feedback" role="status">{feedback}</p>}
      <Table headers={['Selección','Estudiante','Cohorte','Estado','Progreso','Detalle']} rows={students.slice(actual*12,actual*12+12).map(p=>[<input type="checkbox" aria-label={'Seleccionar '+p.name} checked={selected.includes(p.id)} onChange={e=>setSelected(e.target.checked?[...selected,p.id]:selected.filter(id=>id!==p.id))}/>,<div className="person"><span className="initial">{p.name.split(' ').slice(0,2).map(x=>x[0]).join('')}</span><div><strong>{p.name}</strong><small>{p.email}</small></div></div>,'Tramo '+p.cohort,<Badge tone={p.cert!==undefined?'green':'blue'}>{p.status}</Badge>,p.progress+'%',<Button variant="ghost" aria-label={'Detalle de '+p.name} onClick={()=>setDetail(p.id)}><ChevronRight size={17}/></Button>])}/>
      <Pager page={actual} total={students.length} set={setPage}/>
    </Panel>
    {p&&<div className="overlay" onClick={()=>setDetail(undefined)}><section className="dialog" role="dialog" aria-modal="true" aria-label="Detalle del estudiante" onClick={e=>e.stopPropagation()}><header className="panel-head"><div><h2>{p.name}</h2><p>{p.email} · Tramo {p.cohort}</p></div><Button aria-label="Cerrar detalle" variant="ghost" onClick={()=>setDetail(undefined)}><X size={20}/></Button></header><div className="detail"><p><Badge>{p.status}</Badge> <Badge tone="purple">{p.membership}</Badge></p><p>Cuenta institucional {p.enabled?'activa':'inactiva'} · {courses[p.course].name} · {p.progress}%</p><p>Certificación {p.cert===undefined?'sin evidencia':localDate(dateAt(s,p.cert))}</p><div className="actions">{p.status==='Invitado'&&<Button onClick={()=>mutate(v=>accept(v,v.students.find(q=>q.id===p.id)!))}>Aceptar invitación simulada</Button>}{p.membership==='Activa'&&p.progress<100&&<Button onClick={()=>mutate(v=>complete(v,1,[p.id]))}>Completar curso</Button>}</div><h3>Historial de asignaciones y eventos académicos</h3><Recent s={{...s,events:s.events.filter(e=>e.student===p.id)}}/></div></section></div>}
  </>
}
function DataModule({page,s,mutate}:{page:number;s:State;mutate:Mutation}) {
  const [index,setIndex]=useState(0)
  const [selection,setSelection]=useState<number>()
  const [priority,setPriority]=useState(1)
  const [reason,setReason]=useState('')
  const [cohort,setCohort]=useState<Cohort>()
  const [members,setMembers]=useState('')
  const [filter,setFilter]=useState('')
  if(page===4) return <Panel title="Planificación por cohortes" sub="Plazos y activación para la estrategia por cohortes." action={<Button onClick={()=>{setMembers('');setCohort({id:(s.cohorts.at(-1)?.id??0)+1,name:'Nuevo tramo',start:s.day,end:s.config.year,seats:s.config.capacity,opened:false,automatic:true})}}>Crear cohorte</Button>}>
    <Table headers={['Tramo','Vigencia','Cupos','Certificados','Activación','Acciones']} rows={s.cohorts.map(c=>[c.name,`Días ${c.start}–${c.end}`,c.seats,s.students.filter(p=>p.cohort===c.id&&p.cert!==undefined).length,<Badge tone={c.opened?'green':'purple'}>{c.opened?'Abierta':c.automatic?'Automática':'Manual'}</Badge>,<div className="actions"><Button variant="ghost" onClick={()=>{setMembers('');setCohort({...c})}}>Editar</Button>{!c.opened&&<Button variant="outline" disabled={s.day<c.start||s.day>=c.end||!!c.dependency&&s.students.some(p=>p.cohort===c.dependency&&p.cert===undefined)} onClick={()=>mutate(v=>{v.cohorts.find(x=>x.id===c.id)!.opened=true;event(v,'Cohorte activada',c.name,undefined,undefined,undefined,undefined,'Correcto','Operador')})}>Activar</Button>}</div>])}/>
    {cohort&&<form className="padded" onSubmit={e=>{e.preventDefault();if(cohort.end<=cohort.start)return;const ids=new Set(members.split(',').map(Number));mutate(v=>{const chosen=v.students.filter(p=>ids.has(p.id)&&p.membership==='Sin membresía'&&p.status==='En lista de espera');const moved=chosen.filter(p=>p.cohort!==cohort.id);if(v.students.filter(p=>p.cohort===cohort.id).length+moved.length>cohort.seats)throw new Error('La selección supera los cupos.');for(const p of moved)p.cohort=cohort.id;const i=v.cohorts.findIndex(c=>c.id===cohort.id);if(i<0)v.cohorts.push(cohort);else v.cohorts[i]=cohort;event(v,'Cohorte guardada',cohort.name+' · '+moved.length+' estudiantes movidos',undefined,undefined,undefined,undefined,'Correcto','Operador')});setCohort(undefined)}}>
      <div className="form-grid"><label>Nombre<input required value={cohort.name} onChange={e=>setCohort({...cohort,name:e.target.value})}/></label><label>Día de inicio<input type="number" min="0" max={s.config.year-1} value={cohort.start} onChange={e=>setCohort({...cohort,start:Number(e.target.value)})}/></label><label>Día de término<input type="number" min={cohort.start+1} max={s.config.year} value={cohort.end} onChange={e=>setCohort({...cohort,end:Number(e.target.value)})}/></label><label>Cupos<input type="number" min="1" max="5000" value={cohort.seats} onChange={e=>setCohort({...cohort,seats:Number(e.target.value)})}/></label><label>Dependencia<select value={cohort.dependency??''} onChange={e=>setCohort({...cohort,dependency:Number(e.target.value)||undefined})}><option value="">Sin dependencia</option>{s.cohorts.filter(c=>c.id<cohort.id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>IDs en espera, separados por coma<input value={members} onChange={e=>setMembers(e.target.value)}/></label><label className="check"><input type="checkbox" checked={cohort.automatic} onChange={e=>setCohort({...cohort,automatic:e.target.checked})}/> Activación automática</label></div><div className="actions"><Button>Guardar cohorte</Button><Button type="button" variant="ghost" onClick={()=>setCohort(undefined)}>Cancelar</Button></div>
    </form>}
  </Panel>
  if(page===6) return <Panel title="Catálogo y certificaciones" sub="Cursos ficticios · equivalencias SCT pendientes de validación académica."><Table headers={['Curso','Proveedor','Competencias','Horas','SCT referencial','Completados','Certificados']} rows={courses.map(c=>[c.name,'Coursera simulado',c.skill,c.hours,(c.hours/s.config.sctHours).toFixed(2),s.students.filter(p=>p.course===c.id&&p.progress===100).length,s.students.filter(p=>p.course===c.id&&p.cert!==undefined).length])}/></Panel>
  const waiting=queue(s)
  const events=s.events.slice().reverse()
  const stock=s.licenses.filter(l=>!filter||l.status===filter)
  const notices=s.notices.slice().reverse().filter(n=>!filter||!n.read)
  const length=page===3?stock.length:page===5?waiting.length:page===9?events.length:notices.length
  const actual=Math.min(index,Math.max(0,Math.ceil(length/12)-1))
  const slice=<T,>(rows:T[])=>rows.slice(actual*12,actual*12+12)
  let title='',sub=''
  let headers:string[]=[]
  let rows:React.ReactNode[][]=[]
  let action:React.ReactNode
  if(page===3) {
    title='Inventario de licencias'
    sub=metrics(s).available+' cupos confirmados · '+metrics(s).remaining+' transferencias restantes'
    headers=['Licencia','Estado','Estudiante','Asignación','Liberación estimada','Usos']
    rows=slice(stock).map(l=>[<Button variant="ghost" onClick={()=>setSelection(l.id)}>LIC-{String(l.id).padStart(3,'0')}</Button>,<Badge>{l.status}</Badge>,s.students.find(p=>p.id===l.student)?.name??'—',l.assigned===undefined?'—':localDate(dateAt(s,l.assigned)),l.assigned===undefined?'—':localDate(dateAt(s,l.assigned+s.config.duration+1+s.config.grace)),l.uses])
    action=<select aria-label="Filtrar licencias" value={filter} onChange={e=>{setFilter(e.target.value);setIndex(0)}}><option value="">Todos los estados</option>{[...new Set(s.licenses.map(l=>l.status))].map(status=><option key={status}>{status}</option>)}</select>
  } else if(page===5) {
    title='Cola de espera'
    sub='Prioridad académica justificada, fecha de ingreso e identificador en orden FIFO.'
    headers=['Posición','Estudiante','Prioridad','En espera','Cohorte','Elegibilidad','Asignación estimada']
    rows=slice(waiting).map((p,i)=>[actual*12+i+1,<Button variant="ghost" onClick={()=>{setSelection(p.id);setPriority(p.priority);setReason(p.reason)}}>{p.name}</Button>,p.priority,s.day-p.entered+' días',p.cohort,<Badge tone={eligible(s,p)?'green':'orange'}>{eligible(s,p)?'Elegible':'Pendiente'}</Badge>,eligible(s,p)&&metrics(s).available?'Próxima ejecución':eligible(s,p)&&metrics(s).remaining?'Tras confirmar cupo':'Sin fecha'])
  } else if(page===9) {
    title='Bitácora de auditoría';sub='Registro cronológico de decisiones y cambios del escenario.'
    action=<Button variant="outline" onClick={()=>download('auditoria',events)}><ArrowDownToLine size={16}/> Exportar auditoría</Button>
    headers=['Operación','Fecha','Acción','Actor','Estudiante','Licencia','Estado anterior','Estado nuevo','Motivo','Resultado']
    rows=slice(events).map(e=>['OP-'+e.id,localDateTime(e.time),e.action,e.actor,e.student??'—',e.license??'—',e.from??'—',e.to??'—',e.reason,<Badge tone={e.result==='Correcto'?'green':'orange'}>{e.result}</Badge>])
  } else {
    title='Bandeja de salida simulada';sub='Mensajes generados localmente para estudiantes y operaciones.'
    action=<div className="actions"><Button variant="outline" onClick={()=>{setFilter(filter?'':'pending');setIndex(0)}}>{filter?'Mostrar todos':'Solo pendientes'}</Button><Button variant="outline" onClick={()=>mutate(v=>v.notices.forEach(n=>{n.read=true}))}>Marcar todo como leído</Button></div>
    headers=['Día','Asunto','Destinatario','Estado']
    rows=slice(notices).map(n=>[n.day,<Button variant="ghost" onClick={()=>{setSelection(n.id);mutate(v=>{v.notices.find(m=>m.id===n.id)!.read=true})}}>{n.title}</Button>,n.to,<Badge tone={n.read?'green':'orange'}>{n.read?'Leído':'Pendiente'}</Badge>])
  }
  return <>
    <Panel title={title} sub={sub} action={action}><Table headers={headers} rows={rows}/><Pager page={actual} total={length} set={setIndex}/></Panel>
    {selection!==undefined&&page===3&&<Panel title={'Historial de licencia #'+selection} action={<Button variant="ghost" onClick={()=>setSelection(undefined)}>Cerrar</Button>}><Recent s={{...s,events:s.events.filter(e=>e.license===selection)}} limit={20}/></Panel>}
    {selection!==undefined&&page===11&&<Panel title={s.notices.find(n=>n.id===selection)?.title??'Mensaje'} action={<Button variant="ghost" onClick={()=>setSelection(undefined)}>Cerrar</Button>}><div className="padded message">{s.notices.find(n=>n.id===selection)?.body}</div></Panel>}
    {selection!==undefined&&page===5&&<Panel title="Prioridad académica" sub={s.students.find(p=>p.id===selection)?.name}><form className="padded" onSubmit={e=>{e.preventDefault();if(!reason.trim())return;mutate(v=>{const p=v.students.find(p=>p.id===selection)!;const prior=p.priority;p.priority=priority;p.reason=reason.trim();event(v,'Prioridad modificada',p.reason,p,undefined,String(prior),String(priority),'Correcto','Operador')});setSelection(undefined)}}><div className="form-grid"><label>Prioridad (0–10)<input type="number" min="0" max="10" required value={priority} onChange={e=>setPriority(Number(e.target.value))}/></label><label>Justificación<input required maxLength={200} value={reason} onChange={e=>setReason(e.target.value)}/></label></div><div className="actions"><Button>Guardar prioridad</Button><Button type="button" variant="ghost" onClick={()=>setSelection(undefined)}>Cancelar</Button></div></form></Panel>}
  </>
}
function Operations({s,mutate}:{s:State;mutate:Mutation}) {
  const [preview,setPreview]=useState<string>()
  return <><Panel title="Reglas de automatización" sub="Las acciones se aplican exclusivamente sobre datos ficticios." action={<Badge tone={s.config.auto?'green':'orange'}>{s.config.auto?'Habilitada':'Desactivada'}</Badge>}>
    <div className="padded"><div className="form-grid"><label className="check"><input type="checkbox" checked={s.config.auto} onChange={e=>{const checked=e.target.checked;void mutate(v=>{v.config.auto=checked;event(v,'Automatización configurada',v.config.auto?'Habilitada':'Deshabilitada')})}}/> Automatización habilitada</label><label>Frecuencia<select value={s.config.interval} onChange={e=>{const interval=Number(e.target.value);void mutate(v=>{v.config.interval=interval;event(v,'Frecuencia configurada','Cada '+interval+' día(s)')})}}>{[...new Set([1,3,7,14,30,s.config.interval])].sort((a,b)=>a-b).map(n=><option key={n} value={n}>Cada {n} día(s)</option>)}</select></label><label>Modo<select aria-label="Modo" value={s.config.approval?'supervised':'auto'} onChange={e=>{const mode=e.target.value;void mutate(v=>{v.config.approval=mode==='supervised';event(v,'Modo de operación configurado',mode)})}}><option value="auto">Automático</option><option value="supervised">Supervisado</option></select></label></div>
    <div className="actions"><Button onClick={()=>mutate(v=>{v.manual++;rotate(v,false,'Operador')})}><Play size={16}/> Ejecutar ahora</Button><Button variant="outline" onClick={()=>{const copy=structuredClone(s);rotate(copy,true,'Simulación');setPreview(`Ejecución simulada · ${copy.transfers-s.transfers} transferencias y ${copy.events.length-s.events.length} eventos previstos.`)}}>Simular operaciones</Button>{s.config.approval&&<Button variant="outline" onClick={()=>{if(window.confirm('¿Aprobar la rotación simulada?'))mutate(v=>{v.manual++;event(v,'Rotación aprobada','Confirmación manual',undefined,undefined,undefined,undefined,'Correcto','Operador');rotate(v,true,'Operador')})}}>Aprobar rotación</Button>}</div>
    {preview&&<p role="status">{preview}</p>}
    </div></Panel><Panel title="Última ejecución" sub={s.lastRun===undefined?'Sin ejecuciones':`Día ${s.lastRun} · ${localDate(dateAt(s,s.lastRun))}`}><Recent s={s}/>{s.alert&&<div className="warning">{s.alert}</div>}</Panel></>
}
function Integrations({s,mutate}:{s:State;mutate:Mutation}) {
  return <><div className="integrations">{['Coursera','Microsoft Entra ID','Microsoft Graph','IBM','Microsoft Learn','Cisco','Oracle','edX'].map((name,i)=><article className="panel integration" key={name}><span className="icon-box blue"><Plug size={20}/></span><Badge tone={i<3?'green':'purple'}>{i<3?'Simulado':'Pendiente'}</Badge><h2>{name}</h2><p>{['Membresías, progreso y reconciliación de cupos.','Identity Manager · grupo ficticio de estudiantes.','Envío de correos y consulta de identidades.'][i]??'Proveedor contemplado para una futura integración.'}</p>{i===1&&<><p>Última sincronización {s.sync?localDate(s.sync):'pendiente'}</p><Button variant="outline" onClick={()=>mutate(v=>{v.sync=dateAt(v);event(v,'Identity Manager sincronizado',v.students.filter(p=>p.enabled).length+' cuentas ficticias activas en el grupo',undefined,undefined,undefined,undefined,'Correcto','Operador')})}>Sincronizar grupo ficticio</Button></>}{i===2&&<Button variant="outline" onClick={()=>mutate(v=>notice(v,'Prueba de entrega de Microsoft Graph',undefined,'mail:'+v.nextId))}>Probar correo simulado</Button>}</article>)}</div></>
}
function Configuration({s,reset}:{s:State;reset:(c:Config)=>void}) {
  const [draft,setDraft]=useState(s.config)
  return <Panel title="Contract & Policy Manager" sub="Los cambios de configuración recrean el escenario local."><form className="padded" onSubmit={e=>{e.preventDefault();reset(draft)}}><Rules config={draft} set={setDraft} advanced/><div className="actions"><Button type="submit">Aplicar configuración</Button><Button type="button" variant="outline" onClick={()=>setDraft(defaults)}>Cargar valores iniciales</Button></div></form></Panel>
}
const subtitles=['Indicadores de capacidad y avance del programa','Escenarios contractuales y rotación de cupos','Registro y seguimiento de participantes','Capacidad, asignaciones e historial','Tramos y dependencias académicas','Elegibilidad y prioridades de asignación','Oferta académica y evidencia de finalización','Reglas, revisión y prueba de operaciones','Proveedores e identidad institucional','Trazabilidad de decisiones y operaciones','Parámetros del entorno de demostración','Alertas y mensajes simulados']
function App() {
  const [s,setState]=useState(()=>loadState(localStorage))
  const channel=useRef<BroadcastChannel|null>(null)
  const latest=useRef(s)
  const [page,setPage]=useState(currentPage)
  const [mobile,setMobile]=useState(false)
  const [dark,setDark]=useState(()=>localStorage.getItem('microcred-theme')==='dark')
  const [running,setRunning]=useState(false)
  const [speed,setSpeed]=useState(550)
  const [error,setError]=useState('')
  const [version,setVersion]=useState(0)
  const m=useMemo(()=>metrics(s),[s])
  const mutate:Mutation=async(fn)=>{
    try {
      const next=await updateScenario(()=>structuredClone(latest.current),fn)
      latest.current=next
      setState(next)
      channel.current?.postMessage('updated')
      setError('')
      return true
    } catch(err) {
      setError(err instanceof Error?err.message:'No se pudo aplicar el cambio.')
      setRunning(false)
      return false
    }
  }
  async function reset(config:Config) {
    if(!safeConfig(config)){setError('Verifica rangos, fechas y dominios de demostración.');return}
    if(!window.confirm('¿Recrear el escenario? Se reemplazarán los datos de simulación locales.'))return
    setRunning(false)
    if(await mutate(v=>Object.assign(v,{sync:undefined,lastRun:undefined,alert:undefined},create(config))))setVersion(v=>v+1)
  }
  function go(n:number) {location.hash=slugs[n];setPage(n);setMobile(false);window.scrollTo(0,0)}
  useEffect(()=>{const change=()=>setPage(currentPage());window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change)},[])
  useEffect(()=>{
    let active=true
    const sync=async()=>{
      try {
        const next=await updateScenario(()=>loadState(localStorage))
        if(!active)return
        latest.current=next
        setState(next)
        localStorage.removeItem(storageKey)
      } catch(err) {
        if(active)setError(err instanceof Error?err.message:'No se pudo abrir el almacenamiento local.')
      }
    }
    void sync()
    const updates=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel(storageKey)
    channel.current=updates
    if(updates)updates.onmessage=()=>{setRunning(false);void sync()}
    return()=>{active=false;updates?.close();channel.current=null}
  },[])
  useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';localStorage.setItem('microcred-theme',dark?'dark':'light')},[dark])
  useEffect(()=>{
    if(!running)return
    const timer=window.setInterval(()=>{
      if(latest.current.day>=latest.current.config.year){setRunning(false);return}
      mutate(v=>advance(v,1))
    },speed)
    return()=>clearInterval(timer)
  },[running,speed])
  return <div className="shell">
    {mobile&&<button className="mobile-shade" aria-label="Cerrar navegación" onClick={()=>setMobile(false)}/>}
    <aside className={'sidebar '+(mobile?'open':'')}><div className="brand"><span><GraduationCap size={25}/></span><div><strong>MicroCred</strong><small>MANAGER</small></div></div><div className="workspace"><span className="workspace-icon"><Layers3 size={17}/></span><div><strong>Gestión académica</strong><small>Entorno de demostración</small></div></div><nav aria-label="Navegación principal">{pages.map(([label,Icon],i)=><a key={label} className={i===page?'active':''} aria-current={i===page?'page':undefined} href={'#'+slugs[i]} onClick={e=>{e.preventDefault();go(i)}}><Icon size={17}/>{label}{i===1&&<span className="nav-dot"/>}</a>)}</nav><div className="sidebar-footer"><span className="avatar">CV</span><div><strong>César Villablanca</strong><small>Autor de la propuesta</small></div></div></aside>
    <div className="layout"><header className="topbar"><div><Button className="mobile-toggle" variant="ghost" aria-label="Abrir menú" onClick={()=>setMobile(true)}><Menu size={22}/></Button><span className="breadcrumb">Plataforma académica <ChevronRight size={14}/> <strong>{pages[page][0]}</strong></span></div><div className="top-actions"><Badge tone="green"><span className="dot"/> Modo demo</Badge><Button variant="ghost" aria-label={dark?'Activar modo claro':'Activar modo oscuro'} onClick={()=>setDark(!dark)}>{dark?<Sun size={19}/>:<Moon size={19}/>}</Button><Button variant="ghost" className="bell" aria-label="Abrir notificaciones" onClick={()=>go(11)}><Bell size={19}/>{m.alerts>0&&<i/>}</Button></div></header>
    <main><header className="page-heading"><div><h1>{page===0?'Dashboard ejecutivo':pages[page][0]}</h1><p>{subtitles[page]}</p></div><div className="date"><CalendarDays size={16}/>{localDate(dateAt(s))}</div></header>
    {error&&<div className="warning" role="alert">{error}</div>}
    {page===0?<Dashboard s={s} go={go}/>:page===1?<Simulator key={version} s={s} mutate={mutate} reset={reset} running={running} setRunning={setRunning} speed={speed} setSpeed={setSpeed}/>:page===2?<Registry s={s} mutate={mutate}/>:page===7?<Operations s={s} mutate={mutate}/>:page===8?<Integrations s={s} mutate={mutate}/>:page===10?<Configuration key={version} s={s} reset={reset}/>:<DataModule key={page} page={page} s={s} mutate={mutate}/>}
    <footer><ShieldCheck size={15}/> Propuesta tecnológica independiente — Prueba de concepto <span><Clock3 size={14}/> America/Santiago</span><CircleCheck className="footer-check" size={15}/></footer></main></div>
  </div>
}
createRoot(document.getElementById('root')!).render(<App/>)

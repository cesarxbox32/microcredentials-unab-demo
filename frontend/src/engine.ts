import Papa from 'papaparse'

export type Strategy = 'fifo' | 'cohort' | 'manual'
export type StudentStatus = 'Registrado' | 'Pendiente de validación' | 'En lista de espera' | 'Invitado' | 'Activo' | 'En progreso' | 'Curso completado' | 'Certificación pendiente' | 'Certificado' | 'Liberación pendiente' | 'Finalizado' | 'Suspendido' | 'Error'
export type LicenseStatus = 'Disponible' | 'Reservada' | 'Asignada' | 'Pendiente de liberación' | 'Liberación en proceso' | 'Pendiente de reconciliación' | 'Disponible para reasignación' | 'Vencida' | 'Bloqueada'
export const courses = ['Inteligencia artificial', 'Python', 'Análisis de datos', 'Ciberseguridad', 'Gestión de proyectos', 'Cloud Computing', 'Microsoft 365'].map((name, id) => ({name, id, hours: 24 + id * 4, skill: ['Modelos y datos', 'Programación', 'Visualización', 'Gestión de riesgos', 'Planificación', 'Infraestructura', 'Productividad'][id]}))
const given = ['Emilia','Mateo','Sofía','Benjamín','Isidora','Vicente','Amalia','Joaquín','Florencia','Tomás','Antonia','Gabriel','Valentina','Lucas','Catalina','Martín','Daniela','Nicolás','Camila','Diego']
const family = ['Rojas','Silva','Muñoz','Soto','Contreras','Díaz','Martínez','Pérez','Morales','Sepúlveda','González','Torres','Castro','Vargas','Reyes','Navarro','Vega','Fuentes','Herrera','Campos','Riquelme','Salazar','Pizarro','Leiva','Tapia']
export interface Config {
  count: number; capacity: number; strategy: Strategy; duration: number; year: number; percent: number; maxTransfers: number; approval: boolean; auto: boolean; autoAccept: boolean; grace: number; maxDays: number; domain: string; startDate: string; interval: number; recipient: string; sctHours: number
}
export const defaults: Config = {count:500,capacity:200,strategy:'fifo',duration:65,year:300,percent:150,maxTransfers:300,approval:false,auto:true,autoAccept:true,grace:0,maxDays:100,domain:'unab.example',startDate:'2026-03-02',interval:1,recipient:'operaciones@unab.example',sctHours:27}
export interface Student {
  id:number; name:string; email:string; cohort:number; course:number; status:StudentStatus; membership:'Sin membresía'|'Invitación pendiente'|'Activa'|'Eliminada'; progress:number; priority:number; reason:string; entered:number; first?:number; accepted?:number; cert?:number; finished?:number; enabled:boolean
}
export interface License {id:number; status:LicenseStatus; student?:number; assigned?:number; uses:number; previous?:number}
export interface Cohort {id:number; name:string; start:number; end:number; seats:number; automatic:boolean; opened:boolean; dependency?:number}
export interface Event {id:number; day:number; time:string; action:string; actor:string; student?:number; license?:number; from?:string; to?:string; reason:string; result:string}
export interface Notice {id:number; day:number; title:string; to:string; body:string; read:boolean; key:string}
export interface Point {day:number; used:number; waiting:number; certified:number; coverage:number}
export interface State {version:1; config:Config; day:number; students:Student[]; licenses:License[]; cohorts:Cohort[]; events:Event[]; notices:Notice[]; history:Point[]; transfers:number; manual:number; sync?:string; lastRun?:number; alert?:string; nextId:number}
export const transferLimit = (s: State) => Math.min(s.config.maxTransfers, Math.floor(s.config.capacity * s.config.percent / 100))
export function dateAt(s: State, day=s.day) { return new Date(Date.parse(s.config.startDate+'T12:00:00Z') + day*86400000).toISOString() }
const dateFormatter=new Intl.DateTimeFormat('es-CL',{dateStyle:'medium',timeZone:'America/Santiago'})
export const localDate = (iso:string) => dateFormatter.format(new Date(iso))
const timeFormatter=new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'})
export const localDateTime = (iso:string) => timeFormatter.format(new Date(iso))
export function event(s:State,action:string,reason:string,p?:Student,l?:License,from?:string,to?:string,result='Correcto',actor='Motor') {
  s.events.push({id:s.nextId++,day:s.day,time:dateAt(s),action,reason,actor,student:p?.id,license:l?.id,from,to,result})
}
const noticeIndex=new WeakMap<State,Set<string>>()
export function notice(s:State,title:string,p?:Student,key=title) {
  const unique = key+':'+(p?.id ?? 'admin')
  let keys=noticeIndex.get(s)
  if(!keys) {keys=new Set(s.notices.map(n=>n.key));noticeIndex.set(s,keys)}
  if(keys.has(unique)) return
  keys.add(unique)
  s.notices.push({id:s.nextId++,day:s.day,title,to:p?.email ?? s.config.recipient,body:`${p ? 'Estimada/o '+p.name : 'Estimado equipo académico'}:\n\n${title}. Fecha de referencia: ${localDate(dateAt(s))}. Consulte el detalle en MicroCred Manager.\n\nSaludos cordiales,\nEquipo de gestión de microcredenciales`,read:false,key:unique})
}
export function metrics(s:State) {
  const used=s.licenses.filter(l=>l.student!==undefined).length
  const available=s.licenses.filter(l=>l.status==='Disponible'||l.status==='Disponible para reasignación').length
  const active=s.students.filter(p=>p.membership==='Activa').length
  const inTraining=s.students.filter(p=>p.membership==='Activa'&&p.progress<100).length
  const waiting=s.students.filter(p=>p.status==='En lista de espera').length
  const certified=s.students.filter(p=>p.cert!==undefined).length
  const coverage=s.students.filter(p=>p.first!==undefined).length
  const remaining=Math.max(0,transferLimit(s)-s.transfers)
  return {used,available,active,inTraining,waiting,certified,coverage,remaining, utilization:Math.round(100*used/s.config.capacity), alerts:s.notices.filter(n=>!n.read).length, projected:Math.min(s.students.length,s.config.capacity+transferLimit(s))}
}
function record(s:State) {
  const {used,waiting,certified,coverage}=metrics(s)
  const point={day:s.day,used,waiting,certified,coverage}
  if(s.history.at(-1)?.day===s.day) s.history[s.history.length-1]=point
  else s.history.push(point)
}
function student(id:number, capacity:number, domain:string):Student {
  const position=id-1
  const name=given[position%given.length]+' '+family[(Math.floor(position/given.length)+position*7)%family.length]
  return {id,name,email:`estudiante${String(id).padStart(3,'0')}@${domain}`,cohort:Math.floor(position/capacity)+1,course:position%courses.length,status:'En lista de espera',membership:'Sin membresía',progress:0,priority:0,reason:'',entered:0,enabled:true}
}
export function create(config:Config=defaults):State {
  const cohorts=Array.from({length:Math.ceil(config.count/config.capacity)},(_,i)=>({id:i+1,name:`Tramo ${i+1}`,start:0,end:config.year,seats:Math.min(config.capacity,config.count-i*config.capacity),automatic:true,opened:i===0,dependency:i||undefined}))
  const s:State={version:1,config:{...config},day:0,students:Array.from({length:config.count},(_,i)=>student(i+1,config.capacity,config.domain)),licenses:Array.from({length:config.capacity},(_,i)=>({id:i+1,status:'Disponible',uses:0})),cohorts,events:[],notices:[],history:[],transfers:0,manual:0,nextId:1}
  rotate(s,true,'Inicialización')
  return s
}
export function accept(s:State,p:Student) {
  const l=s.licenses.find(l=>l.student===p.id && l.status==='Reservada')
  if(!l || p.membership!=='Invitación pendiente' || !p.enabled || s.day>=s.config.year) return
  p.accepted=s.day
  p.first??=s.day
  p.status='Activo'
  p.membership='Activa'
  l.status='Asignada'
  event(s,'Membresía activada','Aceptación de invitación simulada',p,l,'Invitado','Activo')
  record(s)
}
export function queue(s:State) {
  return s.students.filter(p=>p.status==='En lista de espera').sort((a,b)=>b.priority-a.priority||a.entered-b.entered||a.id-b.id)
}
export function eligible(s:State,p:Student) {
  if(!p.enabled || p.email.split('@').at(-1)!==s.config.domain || s.day>=s.config.year) return false
  if(s.config.strategy!=='cohort') return true
  const c=s.cohorts.find(c=>c.id===p.cohort)
  return !!c?.opened && s.day>=c.start && s.day<c.end && s.students.filter(q=>q.cohort===c.id && q.membership!=='Sin membresía').length<c.seats
}
function openCohorts(s:State) {
  for(const c of s.cohorts) {
    if(c.opened || !c.automatic || s.day<c.start || s.day>=c.end) continue
    const prior=s.students.filter(p=>p.cohort===c.dependency)
    if(c.dependency && prior.some(p=>p.cert===undefined)) continue
    c.opened=true
    event(s,'Cohorte activada',c.name)
  }
}
export function rotate(s:State, approved=false, actor='Motor') {
  s.lastRun=s.day
  if(s.day>=s.config.year) {record(s);return}
  if(s.config.approval && !approved) {
    if(s.students.some(p=>p.cert!==undefined && p.membership==='Activa')) notice(s,'Rotación pendiente de aprobación')
    return
  }
  if(s.config.strategy==='cohort') openCohorts(s)
  const people=new Map(s.students.map(p=>[p.id,p]))
  const cohortSeats=new Map(s.cohorts.map(c=>[
    c.id,c.opened&&s.day>=c.start&&s.day<c.end ? c.seats : 0,
  ]))
  const incompleteCohorts=new Set<number>()
  for(const p of s.students) {
    if(p.membership!=='Sin membresía') cohortSeats.set(p.cohort,(cohortSeats.get(p.cohort)??0)-1)
    if(p.cert===undefined) incompleteCohorts.add(p.cohort)
  }
  const candidates=queue(s).filter(p=>{
    if(!p.enabled||p.email.split('@').at(-1)!==s.config.domain) return false
    if(s.config.strategy!=='cohort') return true
    const seats=cohortSeats.get(p.cohort)??0
    if(seats<=0) return false
    cohortSeats.set(p.cohort,seats-1)
    return true
  })
  let reserved=s.licenses.filter(l=>l.status==='Disponible para reasignación').length
  const empty=s.licenses.filter(l=>l.status==='Disponible').length
  for(const l of s.licenses) {
    if(l.student===undefined || empty+reserved>=candidates.length) continue
    const p=people.get(l.student)
    if(!p || p.cert===undefined || s.day<p.cert+s.config.grace) continue
    if(s.config.strategy==='cohort' && incompleteCohorts.has(p.cohort)) continue
    if(s.transfers+reserved>=transferLimit(s)) {
      if(!s.alert) event(s,'Límite contractual','Sin transferencias disponibles',p,l,undefined,undefined,'Bloqueado',actor)
      s.alert='Límite contractual alcanzado'
      notice(s,s.alert)
      break
    }
    l.status='Pendiente de liberación'
    p.status='Liberación pendiente'
    event(s,'Liberación solicitada','Certificación y gracia verificadas',p,l,'Asignada',l.status,'Correcto',actor)
    l.status='Liberación en proceso'
    p.membership='Eliminada'
    l.status='Pendiente de reconciliación'
    event(s,'Membresía eliminada','La eliminación requiere confirmación de capacidad',p,l,'Liberación en proceso',l.status,'Correcto',actor)
    l.previous=p.id
    delete l.student
    delete l.assigned
    l.status='Disponible para reasignación'
    p.status='Finalizado'
    p.finished=s.day
    reserved++
    event(s,'Capacidad reconciliada','Confirmación del proveedor simulado',p,l,'Pendiente de reconciliación',l.status,'Correcto',actor)
    notice(s,'Licencia recuperable',p)
  }
  let assigned=0
  for(const l of s.licenses) {
    if(l.status!=='Disponible' && l.status!=='Disponible para reasignación') continue
    if(l.uses && s.transfers>=transferLimit(s)) continue
    const p=candidates[assigned++]
    if(!p) break
    const previous=l.status
    l.student=p.id
    l.assigned=s.day
    l.status='Reservada'
    p.membership='Invitación pendiente'
    p.status='Invitado'
    if(l.uses++) {
      s.transfers++
      notice(s,'Licencia reasignada',p)
    }
    event(s,l.uses>1?'Licencia reasignada':'Licencia reservada',l.previous ? `Cupo confirmado del estudiante #${l.previous}`:'Cupo contractual inicial',p,l,previous,l.status,'Correcto',actor)
    notice(s,'Estudiante invitado',p)
    if(s.config.autoAccept) accept(s,p)
  }
  if(s.transfers>=transferLimit(s) && s.transfers>0) notice(s,'Capacidad de transferencias agotada')
  else if(transferLimit(s)>0 && s.transfers>=0.8*transferLimit(s)) notice(s,'Capacidad próxima al límite')
  record(s)
}
export function complete(s:State,limit:number,ids?:number[]) {
  for(const p of s.students.filter(p=>p.membership==='Activa' && p.cert===undefined && p.status!=='Certificación pendiente' && (!ids || ids.includes(p.id))).slice(0,limit)) {
    markCompleted(s,p)
  }
  record(s)
}
function markCompleted(s:State,p:Student) {
  p.progress=100
  p.status='Curso completado'
  event(s,'Curso completado','Evidencia académica simulada',p)
  notice(s,'Curso completado',p)
  p.status='Certificación pendiente'
  notice(s,'Certificación pendiente',p)
}
export function advance(s:State,days:number) {
  for(let i=0;i<days && s.day<s.config.year;i++) {
    s.day++
    const expire=s.day===s.config.year
    const byStudent=new Map(s.licenses.map(l=>[l.student,l]))
    for(const p of s.students) {
      const license=byStudent.get(p.id)
      const elapsed=s.day-(license?.assigned??s.day)
      if(p.membership==='Invitación pendiente' && elapsed>=7) notice(s,'Invitación no aceptada',p)
      if(p.status==='Certificación pendiente' && p.membership==='Activa') {
        p.cert=s.day
        p.status='Certificado'
        event(s,'Certificación confirmada','Certificado ficticio registrado',p)
        notice(s,'Certificación confirmada',p)
      }
      if(p.membership!=='Activa'||p.cert!==undefined||p.accepted===undefined) continue
      if(elapsed>=s.config.maxDays) notice(s,'Vencimiento de asignación para revisión',p)
      const duration=s.config.strategy==='cohort'?s.config.duration:Math.max(2,s.config.duration+(p.id%13)-6)
      p.progress=Math.min(100,Math.floor((s.day-p.accepted)*100/duration))
      p.status='En progreso'
      if(p.progress>90) notice(s,'Progreso superior al 90% · próximo a terminar',p)
      if(elapsed>=14 && p.progress<10) notice(s,'Inactividad prolongada',p)
      if(p.progress===100) markCompleted(s,p)
    }
    if(s.config.year-s.day<=30) notice(s,'Vencimiento contractual próximo')
    if(expire) {
      s.licenses.forEach(l=>{l.status='Vencida';delete l.student})
      s.students.filter(p=>p.membership==='Activa'||p.membership==='Invitación pendiente').forEach(p=>{p.membership='Eliminada';p.status=p.cert===undefined?'Suspendido':'Finalizado'})
      event(s,'Contrato vencido','Fin del período académico')
    }
    if(s.config.strategy==='manual' && s.day%30===0 && !expire) {s.manual++;rotate(s,true,'Operador simulado')}
    else if(s.config.auto && s.config.strategy!=='manual' && s.day%s.config.interval===0) rotate(s)
    record(s)
  }
}
export function compare(config:Config) {
  return (['manual','cohort','fifo'] as Strategy[]).map(strategy=>{
    const s=create({...config,strategy,auto:true,approval:false,autoAccept:true})
    advance(s,config.year)
    const m=metrics(s)
    const wait=s.students.filter(p=>p.first!==undefined).map(p=>p.first!-p.entered)
    const utilization=s.history.slice(0,-1).reduce((total,d)=>total+d.used,0)
    return {strategy,wait:Math.round(wait.reduce((a,b)=>a+b,0)/Math.max(1,wait.length)),utilization:Math.round(100*utilization/(config.year*config.capacity)),coverage:m.coverage,certified:m.certified,manual:s.manual}
  })
}
export function safeConfig(c:Config) {
  return Number.isInteger(c.count)&&c.count>=1&&c.count<=5000&&Number.isInteger(c.capacity)&&c.capacity>=1&&c.capacity<=2000&&Number.isInteger(c.duration)&&c.duration>=2&&c.duration<=365&&Number.isInteger(c.year)&&c.year>=2&&c.year<=366&&Number.isInteger(c.percent)&&c.percent>=0&&c.percent<=5000&&Number.isInteger(c.maxTransfers)&&c.maxTransfers>=0&&c.maxTransfers<=5000&&Number.isInteger(c.grace)&&c.grace>=0&&c.grace<=365&&Number.isInteger(c.maxDays)&&c.maxDays>=1&&c.maxDays<=366&&Number.isInteger(c.interval)&&c.interval>=1&&c.interval<=366&&c.sctHours>0&&Number.isFinite(Date.parse(c.startDate))&&/^[a-z0-9.-]+\.example$/.test(c.domain)&&/^[^@\s]+@[^@\s]+\.example$/.test(c.recipient)
}
export function importCsv(s:State,csv:string) {
  const parsed=Papa.parse<{nombre:string;correo:string}>(csv,{header:true,skipEmptyLines:'greedy'})
  if(parsed.errors.length || !parsed.meta.fields?.includes('nombre') || !parsed.meta.fields?.includes('correo')) throw new Error('El CSV debe incluir las columnas nombre y correo.')
  const emails=new Set(s.students.map(p=>p.email))
  let imported=0
  for(const row of parsed.data) {
    const email=row.correo?.trim().toLowerCase()
    const name=row.nombre?.trim()
    if(s.students.length>=5000 || !name || name.length>150 || !email || !/^[^\s@]+@[^\s@]+$/.test(email) || email.split('@').at(-1)!==s.config.domain || emails.has(email)) continue
    const id=(s.students.at(-1)?.id??0)+1
    const last=s.cohorts.at(-1)
    const cohort=last && s.students.filter(p=>p.cohort===last.id).length<last.seats ? last : undefined
    const cohortId=cohort?.id??((last?.id??0)+1)
    if(!cohort) s.cohorts.push({id:cohortId,name:`Tramo ${cohortId}`,start:s.day,end:s.config.year,seats:s.config.capacity,automatic:true,opened:false,dependency:last?.id})
    s.students.push({...student(id,s.config.capacity,s.config.domain),name,email,cohort:cohortId,entered:s.day})
    emails.add(email)
    imported++
  }
  s.config.count=s.students.length
  event(s,'Importación CSV',`${imported} válidos · ${parsed.data.length-imported} omitidos`,undefined,undefined,undefined,undefined,'Correcto','Operador')
  record(s)
  return imported
}
export const exportCsv = (rows:object[]) => Papa.unparse(rows,{escapeFormulae:true})
export const storageKey='microcred-manager-v1'
export function loadState(storage:Pick<Storage,'getItem'>):State {
  try {
    const saved=JSON.parse(storage.getItem(storageKey)||'null')
    if(saved?.version===1 && safeConfig(saved.config) && Array.isArray(saved.students) && Array.isArray(saved.licenses) && Array.isArray(saved.history) && Array.isArray(saved.cohorts) && Array.isArray(saved.events) && Array.isArray(saved.notices)) return saved
  } catch { /* Unreadable local cache. */ }
  return create()
}

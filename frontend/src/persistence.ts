import type {State} from './engine'

const store='scenarios'
const key='active'
let opened:Promise<IDBDatabase>|undefined

function database() {
  opened??=new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('microcred-manager',1)
    request.onupgradeneeded=()=>request.result.createObjectStore(store)
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(request.error)
    request.onblocked=()=>reject(new Error('Cierra otras pestañas de MicroCred Manager para iniciar el almacenamiento.'))
  })
  return opened
}

export async function updateScenario(initial:()=>State, change?:(s:State)=>void):Promise<State> {
  const db=await database()
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readwrite')
    const objectStore=tx.objectStore(store)
    const request=objectStore.get(key)
    let next:State
    tx.oncomplete=()=>resolve(next)
    tx.onerror=()=>reject(tx.error)
    tx.onabort=()=>reject(tx.error??new Error('No se pudo guardar el escenario.'))
    request.onsuccess=()=>{
      try {
        const stored=request.result as State|undefined
        next=stored?.version===1?stored:initial()
        if(change) change(next)
        if(!stored||change) objectStore.put(next,key)
      } catch(err) {
        reject(err)
        tx.abort()
      }
    }
  })
}

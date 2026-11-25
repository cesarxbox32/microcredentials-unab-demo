import {createReadStream} from 'node:fs'
import {stat} from 'node:fs/promises'
import {createServer} from 'node:http'
import {extname,resolve,sep} from 'node:path'

const root=resolve('dist')
const base='/microcredentials-unab/'
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'}
createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname
  const file=resolve(root,path===base?'index.html':path.slice(base.length))
  if(!path.startsWith(base)||!file.startsWith(root+sep)){res.writeHead(404).end();return}
  const info=await stat(file).catch(()=>null)
  if(!info?.isFile()){res.writeHead(404).end();return}
  res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream'})
  createReadStream(file).pipe(res)
}).listen(4173,'127.0.0.1')

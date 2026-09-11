import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ArtinosApp, type ArtinosProject } from '@artinos/r3f'
import '@artinos/ui/theme.css'
import '@artinos/ui/studio-panels.css'

type ProjectModule={default:ArtinosProject}
const modules=import.meta.glob<ProjectModule>(['./*.project.tsx','./*.example.tsx'],{eager:true})
const projects=Object.entries(modules).map(([path,module])=>{
  const project=module.default
  if(!project?.id||!project.name||!project.Content)throw new Error(`Invalid ARTINOS project: ${path}`)
  return project
}).sort((a,b)=>a.name.localeCompare(b.name))

const ids=new Set<string>()
for(const project of projects){if(ids.has(project.id))throw new Error(`Duplicate ARTINOS project id: ${project.id}`);ids.add(project.id)}
if(!projects.length)throw new Error('Add a *.project.tsx or *.example.tsx file directly under src/')

const requested=new URLSearchParams(location.search).get('project')??localStorage.getItem('artinos.project')
const project=projects.find(item=>item.id===requested)??projects.find(item=>item.default)??projects[0]
localStorage.setItem('artinos.project',project.id)

const root=document.getElementById('root')
if(!root)throw new Error('ARTINOS requires a #root mount element')

// `?showcase` / `?library` renders the design system instead of the project. It is lazy so
// the showcase never lands in the app bundle, and it needs no runtime: every
// specimen is a primitive reading the token layer directly.
const query = new URLSearchParams(location.search)
if(query.has('showcase') || query.has('library')){
  void import('@artinos/ui').then(({Showcase})=>{
    createRoot(root).render(<StrictMode><Showcase/></StrictMode>)
  })
}else{
  createRoot(root).render(<StrictMode><ArtinosApp project={project}/></StrictMode>)
}

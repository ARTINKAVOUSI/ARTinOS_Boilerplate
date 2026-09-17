import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ArtinosApp, type ArtinosProject } from '@artinos/r3f'
import '@artinos/ui/theme.css'
import '@artinos/r3f/studio-panels.css'

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

// `?studio` renders the whole design system — foundations, every component, the
// patterns, the reference workbench and the live theme editor — in one page. It
// is lazy, so none of it lands in the app bundle, and it needs no runtime: every
// specimen is a primitive reading the token layer directly.
const query = new URLSearchParams(location.search)
if(query.has('studio')||query.has('ui')){
  void import('@artinos/ui').then(({UIStudio})=>{
    createRoot(root).render(<StrictMode><UIStudio/></StrictMode>)
  })
}else if(query.has('workbench')){
  // Not a destination — the acceptance harness. UI PROTOTYPES/workbench.html
  // rebuilt from @artinos/ui components, bare so it can be measured against the
  // reference. `&backdrop=<url>` supplies the reference photograph.
  void import('@artinos/ui').then(({Workbench})=>{
    createRoot(root).render(<StrictMode><Workbench backdrop={query.get('backdrop') ?? undefined}/></StrictMode>)
  })
}else{
  createRoot(root).render(<StrictMode><ArtinosApp project={project}/></StrictMode>)
}

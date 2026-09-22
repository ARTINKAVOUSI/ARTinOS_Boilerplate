import { fieldValue, inputsOf, outputsOf, schemaFor, type GraphDiagnostic, type GraphNode } from '@artinos/graph'
import { Badge, Button, KeyValue, TextField } from '@artinos/ui'
import { Section, Stack } from '@artinos/ui'
import { GraphFieldControl, type FieldSources } from './GraphFieldControl'
import type { GraphEditor } from './use-graph-editor'

const format=(value:unknown)=>typeof value==='number'?value.toFixed(4):value===undefined?'—':typeof value==='object'?'object':String(value)

/** Full properties for the selected node, plus everything the node body has no room for. */
export function GraphInspector({editor,selected,values,diagnostics,sources}:{
  editor:GraphEditor
  selected:readonly string[]
  values:ReadonlyMap<string,unknown>
  diagnostics:readonly GraphDiagnostic[]
  sources:FieldSources
}){
  const nodes=editor.graph.nodes.filter(node=>selected.includes(node.id))
  if(nodes.length>1)return <Section title="Selection" description={`${nodes.length} nodes selected`}>
    <Stack>{nodes.map(node=><KeyValue key={node.id} label={node.label??schemaFor(node.type)?.label??node.type} value={format(values.get(node.id))}/>)}</Stack>
    <div className="artinos-button-row">
      <Button onClick={()=>editor.duplicate(selected)}>Duplicate</Button>
      <Button onClick={()=>editor.removeNodes(selected)}>Delete</Button>
    </div>
  </Section>
  const node=nodes[0]
  if(!node)return <Section title="Node" description="Select a node to edit its properties."><KeyValue label="Selection" value="Nothing selected"/></Section>
  return <NodeInspector editor={editor} node={node} value={values.get(node.id)} diagnostics={diagnostics.filter(item=>item.nodeId===node.id)} sources={sources}/>
}

function NodeInspector({editor,node,value,diagnostics,sources}:{
  editor:GraphEditor;node:GraphNode;value:unknown;diagnostics:readonly GraphDiagnostic[];sources:FieldSources
}){
  const schema=schemaFor(node.type)
  const connections=editor.graph.edges.filter(edge=>edge.from===node.id||edge.to===node.id)
  return <>
    <Section title={schema?.label??node.type} description={schema?.description}>
      <TextField label="Label" value={node.label??''} placeholder={schema?.label??node.type} onChange={label=>editor.rename(node.id,label)}/>
      <KeyValue label="Output" value={format(value)}/>
      <KeyValue label="Category" value={schema?.category??'—'}/>
      {diagnostics.map((item,index)=><div key={index} className="artinos-grow-diagnostic">
        <Badge tone={item.severity==='error'?'danger':'warn'}>{item.severity}</Badge><span>{item.message}</span>
      </div>)}
    </Section>
    {Boolean(schema?.fields.length)&&<Section title="Properties">
      {schema?.fields.map(field=><GraphFieldControl
        key={field.id} field={field} value={fieldValue(node,field.id)} sources={sources}
        effectId={String(fieldValue(node,'id')??'')}
        onChange={next=>editor.setField(node.id,field.id,next)}/>)}
    </Section>}
    <Section title="Connections" description={`${connections.length} wired`}>
      <Stack>
        {inputsOf(node).map(port=>{
          const edges=editor.graph.edges.filter(edge=>edge.to===node.id&&(edge.input??'value')===port.id)
          return <div key={`in-${port.id}`} className="artinos-gconnection">
            <span>◂ {port.label??port.id}{port.required&&<em>required</em>}</span>
            {edges.length
              ?edges.map(edge=><button key={edge.id} type="button" onClick={()=>edge.id&&editor.disconnect(edge.id)} title="Disconnect">
                {editor.graph.nodes.find(item=>item.id===edge.from)?.label??edge.from} ×</button>)
              :<small>not connected</small>}
          </div>
        })}
        {outputsOf(node).map(port=>{
          const edges=editor.graph.edges.filter(edge=>edge.from===node.id&&(edge.output??'value')===port.id)
          return <div key={`out-${port.id}`} className="artinos-gconnection">
            <span>{port.label??port.id} ▸</span>
            {edges.length
              ?edges.map(edge=><button key={edge.id} type="button" onClick={()=>edge.id&&editor.disconnect(edge.id)} title="Disconnect">
                {editor.graph.nodes.find(item=>item.id===edge.to)?.label??edge.to} ×</button>)
              :<small>not connected</small>}
          </div>
        })}
      </Stack>
    </Section>
    <div className="artinos-button-row">
      <Button onClick={()=>editor.duplicate([node.id])}>Duplicate</Button>
      <Button onClick={()=>editor.removeNodes([node.id])}>Delete Node</Button>
    </div>
  </>
}

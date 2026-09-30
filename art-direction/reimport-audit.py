import bpy, json
from pathlib import Path
from mathutils import Vector
root=Path(r'D:/Documents/Projects/VC/BabylonJS/babylon-lite-super-offroad-clone')
scene=bpy.data.scenes.new('Dust Circuit Rally final GLB reimport audit')
bpy.context.window.scene=scene
report={}
for name in ['course','truck-1','truck-2','truck-3','truck-4','wheel','nitro','traction','prop-kit']:
    before=set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(root/'project-name/public/assets'/f'{name}.glb'))
    meshes=[o for o in scene.objects if o not in before and o.type=='MESH']
    coords=[o.matrix_world@Vector(p) for o in meshes for p in o.bound_box]
    mins=[min(v[i] for v in coords) for i in range(3)]
    maxs=[max(v[i] for v in coords) for i in range(3)]
    report[name]={'meshes':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'boundsMin':mins,'boundsMax':maxs,'dimensions':[b-a for a,b in zip(mins,maxs)]}
    if name.startswith('truck'):assert 3.1<report[name]['dimensions'][1]<3.5
    if name=='wheel':assert abs((mins[0]+maxs[0])/2)<.001
(root/'project-name/artwork/reimport-audit.json').write_text(json.dumps(report,indent=2))
result={'exports':list(report),'courseBounds':report['course']['dimensions'],'truckBounds':report['truck-1']['dimensions'],'wheelCentered':True}

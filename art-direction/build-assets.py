"""Run inside the connected official Blender MCP, never as a helper process.
Creates only a new owned scene; preserves existing scenes and source files.
"""
import bpy, math, json, random
from pathlib import Path
from mathutils import Vector, Matrix
root=Path(r'D:/Documents/Projects/VC/BabylonJS/babylon-lite-super-offroad-clone')
out=root/'project-name/public/assets'
source=root/'project-name/artwork'
out.mkdir(parents=True,exist_ok=True);source.mkdir(parents=True,exist_ok=True)
track=json.loads((root/'art-direction/track-v1.json').read_text())
scene=bpy.data.scenes.new('Dust Circuit Rally — Copper Basin v1')
bpy.context.window.scene=scene
scene.unit_settings.system='METRIC'
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Dust warm sky');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.31,.38,.49,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
scene.view_settings.view_transform='AgX'
rng=random.Random(307)
def material(name,h,rough=.85,metal=0):
    srgb=tuple(int(h[i:i+2],16)/255 for i in (1,3,5))
    rgb=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in srgb)
    m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
    return m
dirt=material('Ochre racing dirt','#b98242');edge=material('Warm track edge','#d8ab67');earth=material('Quarry ground','#cc9c61');mud=material('Damp clay','#725337');rubber=material('Dark tire rubber','#252b31');steel=material('Warm silver','#aab1ab',.45,.55);wood=material('Weathered posts','#75634a');sand=material('Sandstone','#ad8556');glass=material('Cool opaque glass','#25404c',.3);black=material('Charcoal chassis','#343a3c');white=material('Number white','#fff3cd');green=material('Traction green','#97d755');blue=material('Nitro blue','#45bce1');orange=material('Safety ochre','#ef9445');
def collection(name):
    c=bpy.data.collections.new(name);scene.collection.children.link(c);return c
course=collection('Copper Basin course');kit=collection('Reusable props');trucks=collection('Truck source variants');effects=collection('Pickup models');studio=collection('Camera and lighting')
def own(obj,c):
    for coll in list(obj.users_collection):coll.objects.unlink(obj)
    c.objects.link(obj);return obj
def cube(name,loc,scale,mat,c=course,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=own(bpy.context.object,c);o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Soft readable corners','BEVEL');mod.width=bevel;mod.segments=1
        o.modifiers.new('Weighted shading','WEIGHTED_NORMAL')
    return o
def cyl(name,loc,radius,depth,mat,c=course,vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc);o=own(bpy.context.object,c);o.name=name;o.data.materials.append(mat);return o
def mesh(name,verts,faces,mat,c=course):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();o=bpy.data.objects.new(name,data);c.objects.link(o);data.materials.append(mat);return o
def road_strip(points,width,name):
    verts=[]
    for i,p in enumerate(points):
        prev=points[(i-1)%len(points)];n=points[(i+1)%len(points)];dx=n['x']-prev['x'];dz=n['z']-prev['z'];l=math.hypot(dx,dz)
        for side in [-1,1]:verts.append((p['x']+dz/l*width*side,-p['z']+dx/l*width*side,p.get('height',0)+.025))
    faces=[(2*i,2*((i+1)%len(points)),2*((i+1)%len(points))+1,2*i+1) for i in range(len(points))]
    o=mesh(name,verts,faces,dirt);o.data.materials.append(edge);o.data.materials.append(mud)
    for i,f in enumerate(o.data.polygons):f.material_index=2 if 135<=i<145 else 0
    # Closed side skirts give raised road sections a grounded dirt silhouette.
    sv=[];sf=[]
    for i,p in enumerate(points):
        n=(i+1)%len(points)
        if max(p.get('height',0),points[n].get('height',0))<.04:continue
        for side in [0,1]:
            a=verts[2*i+side];b=verts[2*n+side];k=len(sv)
            sv.extend([a,b,(b[0],b[1],0),(a[0],a[1],0)])
            sf.append((k,k+1,k+2,k+3) if side==0 else (k+3,k+2,k+1,k))
    mesh(name+' dirt slopes',sv,sf,edge)
    return o
cube('Quarry arena base',(0,-1,-1.2),(86,66,2.3),earth,bevel=1.2)
grid=track['terrainGrid'];verts=[];faces=[]
for z in range(grid['nz']+1):
    for x in range(grid['nx']+1):
        k=z*(grid['nx']+1)+x;verts.append((grid['originX']+x*grid['step'],-grid['originZ']-z*grid['step'],grid['heights'][k]))
for z in range(grid['nz']):
    for x in range(grid['nx']):
        k=z*(grid['nx']+1)+x;faces.append((k,k+grid['nx']+1,k+grid['nx']+2,k+1))
surface=mesh('Continuous contract-derived racing terrain',verts,faces,earth)
def clipped_surface(name,threshold,offset,edge_only=False):
    output=[];polygons=[];materials=[]
    for cell,face in enumerate(faces):
        for tri in [(face[0],face[1],face[2]),(face[0],face[2],face[3])]:
            polygon=[(verts[k],grid['signed'][k]-threshold) for k in tri];clipped=[]
            for i,(p,dist) in enumerate(polygon):
                previous,prev_dist=polygon[i-1]
                if (dist<=0)!=(prev_dist<=0):
                    t=prev_dist/(prev_dist-dist);clipped.append(tuple(previous[j]+(p[j]-previous[j])*t for j in range(3)))
                if dist<=0:clipped.append(p)
            if len(clipped)<3:continue
            start=len(output);output.extend((p[0],p[1],p[2]+offset) for p in clipped);polygons.append(tuple(range(start,len(output))))
            materials.append(2 if edge_only or grid['materials'][cell]==3 else 1 if grid['materials'][cell]==2 else 0)
    obj=mesh(name,output,polygons,dirt);obj.data.materials.append(mud);obj.data.materials.append(edge)
    for polygon,index in zip(obj.data.polygons,materials):polygon.material_index=index
clipped_surface('Smooth continuous dirt edge',.35,.009,True)
clipped_surface('Smooth drivable circuit and shortcut',0,.017)
def closest(x,z):
    return min(math.hypot(p['x']-x,p['z']-z) for p in track['route'])
# Narrow legal branch between checkpoint 3 and 4.
branch=track['branchSamples'];bv=[]
for i,p in enumerate(branch):
    a=branch[max(0,i-1)];b=branch[min(len(branch)-1,i+1)];dx=b['x']-a['x'];dz=b['z']-a['z'];l=math.hypot(dx,dz)
    for side in [-1,1]:bv.append((p['x']+dz/l*2.6*side,-p['z']+dx/l*2.6*side,p['height']+.04))
# Shortcut and jump are part of the continuous heightfield, avoiding overlapped strips.
for i,p in enumerate(track['route']):
    if i%4:continue
    n=track['route'][(i+1)%200];dx=n['x']-p['x'];dz=n['z']-p['z'];l=math.hypot(dx,dz)
    for side in [-1,1]:
        x=p['x']+dz/l*5.15*side;z=p['z']-dx/l*5.15*side
        if closest(x,z)<5:continue
        if min(math.hypot(q['x']-x,q['z']-z) for q in branch)<5:continue
        for level in range(2):
            bpy.ops.mesh.primitive_torus_add(major_radius=.48,minor_radius=.17,major_segments=12,minor_segments=6,location=(x,-z,.22+level*.32));o=own(bpy.context.object,course);o.name=f'Tire barrier {i} {side} {level}';o.data.materials.append(rubber)
for i in range(85):
    x=rng.uniform(-40,40);z=rng.uniform(-30,30)
    if closest(x,z)<7 or min(math.hypot(p['x']-x,p['z']-z) for p in branch)<7:continue
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,-z,.45));o=own(bpy.context.object,course);o.name='Sandstone rock';o.scale=(rng.uniform(.5,2.2),rng.uniform(.5,1.6),rng.uniform(.5,1.6));o.rotation_euler=(rng.random()*.3,rng.random()*.3,rng.random()*6);o.data.materials.append(sand)
# Fencing stays low and behind the arena.
for x in range(-40,41,4):
    cube('Rear fence post',(x,29,.8),(.22,.22,1.6),wood)
    if x<40:
        for z in [.6,1.2]:cube('Rear fence rail',(x+2,29,z),(4,.16,.12),wood)
g=track['gates'][0]
for side in [-1,1]:cube('Start gantry pillar',(g['x']+g['tz']*5.5*side,-g['z']+g['tx']*5.5*side,2.3),(.3,.3,4.6),black)
bar=cube('Start gantry crossbar',(g['x'],-g['z'],4.6),(11.4,.4,.5),orange);bar.rotation_euler.z=math.atan2(g['tx'],g['tz'])
for i in range(10):
    loc=(g['x']+g['tz']*(i-4.5)*.85,-g['z']+g['tx']*(i-4.5)*.85,.08)
    o=cube('Finish checker',loc,(.85,1,.05),white if i%2 else black);o.rotation_euler.z=math.atan2(g['tx'],g['tz'])
cube('Spectator deck',(-31,-29,1.2),(9,3,.25),wood);cube('Spectator shade',(-31,-29,3.2),(10,4,.18),white)
for x in [-35,-27]:
    for y in [-30.4,-27.6]:cube('Shade post',(x,y,1.7),(.15,.15,3.2),wood)
# Isolated reusable source props, hidden in preview but explicitly exported separately.
for i,size in enumerate([.7,1.1,1.6]):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=size);o=own(bpy.context.object,kit);o.name=f'Rock variant {i+1}';o.data.materials.append(sand)
cube('Reusable barrier',(0,0,.5),(2,.55,1),orange,kit,bevel=.1)
cube('Reusable fence post',(0,0,.8),(.2,.2,1.6),wood,kit)
cube('Reusable fence rail',(0,0,.6),(4,.16,.12),wood,kit)
for level in range(2):
    bpy.ops.mesh.primitive_torus_add(major_radius=.48,minor_radius=.17,major_segments=12,minor_segments=6,location=(0,0,.22+level*.32));o=own(bpy.context.object,kit);o.name='Reusable tire stack';o.data.materials.append(rubber)
kit.hide_render=True
colors=['#f05b42','#42c9e0','#f4cb4c','#a594ed']
body_objects=[]
for index,h in enumerate(colors):
    c=collection(f'Truck {index+1}');paint=material(f'Truck {index+1} paint',h,.48)
    cube('Chassis',(0,0,.54),(1.7,3.1,.3),black,c,bevel=.08)
    cube('Body',(0,0,.82),(1.8,3.15,.55),paint,c,bevel=.12)
    cube('Cab',(0,-.2,1.27),(1.55,1.35,.55),paint,c,bevel=.09)
    cube('Windshield',(0,-.89,1.3),(1.35,.035,.4),glass,c)
    cube('Rear window',(0,.49,1.3),(1.35,.035,.38),glass,c)
    for side in [-1,1]:cube('Side window',(side*.79,-.18,1.31),(.035,1.13,.38),glass,c)
    cube('Bed recess',(0,1.07,1.12),(1.35,.82,.05),black,c)
    cube('Front bumper',(0,-1.64,.65),(1.94,.16,.19),steel,c)
    cube('Grille',(0,-1.604,.88),(.75,.04,.22),black,c)
    for x in [-.64,.64]:cube('Headlight',(x,-1.614,.9),(.3,.04,.18),white,c)
    cube('Roof number panel',(0,-.2,1.558),(1.08,1.06,.018),white,c)
    bpy.ops.object.text_add(location=(-.30,-.57,1.58));label=own(bpy.context.object,c);label.name=f'Roof number {index+1}';label.data.body=str(index+1);label.data.size=.90;label.data.extrude=.008;label.data.materials.append(black)
    body_objects.append(c)
    c.hide_render=True
wheelc=collection('Wheel');w=cyl('Wheel axle origin',(0,0,0),.48,.36,rubber,wheelc,16);w.rotation_euler.y=math.pi/2
for x in [-.19,.19]:
    hub=cyl('Wheel hub',(x,0,0),.24,.015,steel,wheelc,12);hub.rotation_euler.y=math.pi/2
wheelc.hide_render=True
nitroc=collection('Nitro refill');cyl('Blue nitro can',(0,0,.52),.35,.9,blue,nitroc);cyl('Nitro cap',(0,0,1.04),.15,.17,steel,nitroc);cube('Nitro stripe',(0,-.36,.52),(.22,.035,.55),white,nitroc)
tractionc=collection('Traction boost');cube('Traction pickup',(0,0,.35),(.85,.85,.55),green,tractionc,bevel=.1);cube('Grip symbol',(0,-.43,.35),(.55,.025,.18),black,tractionc)
nitroc.hide_render=True;tractionc.hide_render=True
def export(c,name):
    selected=list(c.all_objects)
    # Merge an evaluated export copy by material to bound runtime draw calls.
    # Original editable object/modifier structure remains in the course collection.
    merge = name=='course' or name.startswith('truck-')
    if merge:
        stage=collection('Optimized '+name+' export');verts=[];faces=[];mats=[];indices=[]
        graph=bpy.context.evaluated_depsgraph_get()
        for obj in selected:
            if obj.type!='MESH':continue
            evaluated=obj.evaluated_get(graph);data=evaluated.to_mesh();offset=len(verts)
            verts.extend(tuple(obj.matrix_world@v.co) for v in data.vertices)
            for f in data.polygons:
                faces.append(tuple(offset+i for i in f.vertices));mat=data.materials[f.material_index]
                if mat not in mats:mats.append(mat)
                indices.append(mats.index(mat))
            evaluated.to_mesh_clear()
        data=bpy.data.meshes.new('Merged '+name+' for browser');data.from_pydata(verts,[],faces);data.update()
        for m in mats:data.materials.append(m)
        for p,i in zip(data.polygons,indices):p.material_index=i
        obj=bpy.data.objects.new('Optimized '+name,data);stage.objects.link(obj);selected=[obj]
    bpy.ops.object.select_all(action='DESELECT')
    axis_root=bpy.data.objects.new('Babylon Lite authored axis conversion',None);scene.collection.objects.link(axis_root);axis_root.scale.x=-1
    original=[(obj,obj.parent,obj.matrix_basis.copy(),obj.matrix_parent_inverse.copy()) for obj in selected]
    for obj in selected:obj.parent=axis_root;obj.matrix_parent_inverse=Matrix.Identity(4)
    axis_root.select_set(True)
    for obj in selected:obj.hide_set(False);obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(out/(name+'.glb')),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True)
    for obj,parent,basis,inverse in original:obj.parent=parent;obj.matrix_basis=basis;obj.matrix_parent_inverse=inverse
    bpy.data.objects.remove(axis_root,do_unlink=True)
    if merge:stage.hide_render=True
export(course,'course')
for i,c in enumerate(body_objects):export(c,f'truck-{i+1}')
export(wheelc,'wheel');export(nitroc,'nitro');export(tractionc,'traction');export(kit,'prop-kit')
triangles=0
for obj in course.objects:
    if obj.type=='MESH':
        eval_obj=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());evaluated=eval_obj.to_mesh()
        evaluated.calc_loop_triangles();triangles+=len(evaluated.loop_triangles);eval_obj.to_mesh_clear()
# Place a preview grid using linked source meshes.
for i,c in enumerate(body_objects):
    pose=track['gates'][0];side=-1.7 if i%2==0 else 1.7;back=3 if i<2 else 7
    x=pose['x']-pose['tx']*back+pose['tz']*side;z=pose['z']-pose['tz']*back-pose['tx']*side
    turn=Matrix.Rotation(math.atan2(pose['tx'],pose['tz']),4,'Z')
    placement=Matrix.Translation(Vector((x,-z,0)))@turn
    for obj in c.objects:
        d=obj.copy();d.data=obj.data;course.objects.link(d);d.matrix_world=placement@obj.matrix_world
    for wx in [-1,1]:
        for wz in [-1.05,1.05]:
            for obj in wheelc.objects:
                d=obj.copy();d.data=obj.data;course.objects.link(d);d.matrix_world=placement@Matrix.Translation(Vector((wx,wz,.48)))@obj.matrix_world
bpy.ops.object.camera_add(location=(0,81.5,113.2));camera=own(bpy.context.object,studio);camera.name='Fixed gameplay camera';camera.rotation_euler=(Vector((0,-1,0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=106.667;scene.camera=camera
bpy.ops.object.light_add(type='SUN',location=(-25,-30,60));sun=own(bpy.context.object,studio);sun.rotation_euler=(.45,-.55,-.4);sun.data.energy=2.5;sun.data.angle=.12
bpy.ops.wm.save_as_mainfile(filepath=str(source/'copper-basin.blend'))
scene.render.filepath=str(source/'gameplay-preview.png');bpy.ops.render.render(write_still=True)
manifest={'source':'copper-basin.blend','trackVersion':track['version'],'units':'meters','gameAxes':'+y up, x/z ground; trucks face +z. Export root reflects X to cancel Babylon Lite glTF handedness conversion.','exports':['course','truck-1','truck-2','truck-3','truck-4','wheel','nitro','traction','prop-kit'],'courseTriangles':triangles,'reviewedInEngine':False,'limitations':['Materials use simple glTF PBR; lighting recreated in engine.','Wheel/chassis animation is runtime-driven.'],'provenance':'Original geometry authored in Blender through official MCP; visual target is inspiration only.'}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
result=manifest

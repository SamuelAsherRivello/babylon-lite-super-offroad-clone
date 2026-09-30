"""Inspect one original truck and tabletop before expanding the asset kit.
Runs only through the configured official Blender MCP.
"""
from pathlib import Path
import bpy
from mathutils import Vector
root=Path(r'D:/Documents/Projects/VC/BabylonJS/babylon-lite-super-offroad-clone')
script=(root/'art-direction/build-assets.py').read_text()
setup=script.split("cube('Quarry arena base'")[0]
exec(compile(setup, 'asset-setup', 'exec'))
scene.name='Dust Circuit Rally — truck and tabletop prototype'
model=script[script.index("colors=['#f05b42'"):script.index("nitroc=collection")]
model=model.replace('enumerate(colors)', 'enumerate(colors[:1])')
exec(compile(model, 'truck-prototype', 'exec'))
cube('Representative dirt section',(0,0,-.25),(13,18,.5),dirt)
mesh('Representative tabletop',[(3,-6,0),(7,-6,0),(3,-3,2),(7,-3,2),(3,1,2),(7,1,2),(3,6,0),(7,6,0)],[(0,1,3,2),(2,3,5,4),(4,5,7,6)],edge)
for obj in body_objects[0].objects:
    copy=obj.copy();copy.data=obj.data;course.objects.link(copy)
for x in [-1,1]:
    for y in [-1.05,1.05]:
        for obj in wheelc.objects:
            copy=obj.copy();copy.data=obj.data;course.objects.link(copy);copy.location+=Vector((x,y,.48))
bpy.ops.object.camera_add(location=(12,-16,13));camera=own(bpy.context.object,studio)
camera.rotation_euler=(Vector((1,0,.5))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=19;scene.camera=camera
bpy.ops.object.light_add(type='SUN');sun=own(bpy.context.object,studio);sun.rotation_euler=(.45,-.55,-.4);sun.data.energy=2
scene.render.resolution_x=960;scene.render.resolution_y=540;scene.cycles.samples=16
bpy.ops.wm.save_as_mainfile(filepath=str(source/'truck-tabletop-prototype.blend'))
scene.render.filepath=str(source/'truck-tabletop-prototype.png');bpy.ops.render.render(write_still=True)
result={'scene':scene.name,'version':bpy.app.version_string,'source':str(source/'truck-tabletop-prototype.blend'),'preview':scene.render.filepath,'truckDimensionsMeters':[1.94,3.3,1.58]}

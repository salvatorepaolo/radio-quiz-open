"""Rende modello3d.glb in PNG (vista anteriore e posteriore) con VTK, fuori schermo.
Uso: render3d.py modello3d.glb uscita.png"""
import sys
import vtk

glb, out = sys.argv[1], sys.argv[2]
ren = vtk.vtkRenderer()
ren.SetBackground(0, 0, 0)
win = vtk.vtkRenderWindow()
win.SetOffScreenRendering(1)
win.SetSize(900, 1200)
win.AddRenderer(ren)
imp = vtk.vtkGLTFImporter()
imp.SetFileName(glb)
imp.SetRenderWindow(win)
imp.Update()
# l'importer crea un suo renderer: lo uso
r = win.GetRenderers().GetFirstRenderer()
r.SetBackground(0, 0, 0)
r.UseShadowsOff()
acts = r.GetActors()
acts.InitTraversal()
for _ in range(acts.GetNumberOfItems()):
    a = acts.GetNextActor()
    p = a.GetProperty()
    p.SetInterpolationToPhong()
    p.SetSpecular(0.3)
    p.SetSpecularPower(20)
r.ResetCamera()
cam = r.GetActiveCamera()
# coordinate LPS: anteriore = -y, testa = +z
fp = cam.GetFocalPoint()
d = cam.GetDistance()
imgs = []
for nome, pos in (("anteriore", (fp[0], fp[1] - d, fp[2])), ("posteriore", (fp[0], fp[1] + d, fp[2]))):
    cam.SetPosition(*pos)
    cam.SetFocalPoint(*fp)
    cam.SetViewUp(0, 0, 1)
    r.ResetCameraClippingRange()
    cam.Zoom(1.25)
    win.Render()
    w2i = vtk.vtkWindowToImageFilter()
    w2i.SetInput(win)
    w2i.Update()
    imgs.append(w2i.GetOutput())
    cam.Zoom(1 / 1.25)
app = vtk.vtkImageAppend()
app.SetAppendAxis(0)
for im in imgs:
    c = vtk.vtkImageData()
    c.DeepCopy(im)
    app.AddInputData(c)
app.Update()
wr = vtk.vtkPNGWriter()
wr.SetFileName(out)
wr.SetInputData(app.GetOutput())
wr.Write()
print("ok", out)

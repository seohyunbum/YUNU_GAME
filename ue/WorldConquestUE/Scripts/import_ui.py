# UI 스킨 텍스처 임포트 — UI 그룹·클램프·니어리스트(테두리 선명) 설정
import unreal, os

RAW = unreal.Paths.project_dir() + "RawAssets/UI"
PKG = "/Game/UI"
tools = unreal.AssetToolsHelpers.get_asset_tools()
OUT = open(r"C:/Users/Public/WCUE/ui_out.txt", "w")

tasks = []
for f in os.listdir(RAW):
    if not f.endswith(".png"):
        continue
    t = unreal.AssetImportTask()
    t.filename = os.path.join(RAW, f)
    t.destination_path = PKG
    t.destination_name = os.path.splitext(f)[0]
    t.automated = True
    t.replace_existing = True
    t.save = True
    tasks.append(t)
tools.import_asset_tasks(tasks)

ok = 0
for t in tasks:
    name = os.path.splitext(os.path.basename(t.filename))[0]
    tex = unreal.load_asset(f"{PKG}/{name}")
    if not tex:
        continue
    tex.set_editor_property("lod_group", unreal.TextureGroup.TEXTUREGROUP_UI)
    tex.set_editor_property("filter", unreal.TextureFilter.TF_BILINEAR)
    tex.set_editor_property("srgb", True)
    unreal.EditorAssetLibrary.save_asset(f"{PKG}/{name}")
    ok += 1
OUT.write(f"imported={ok}/{len(tasks)}\n")
OUT.write("DONE\n"); OUT.close()

# 도시 배경 텍스처 일괄 임포트 — RawAssets/Portraits/<id>.png → /Game/Portraits/T_<id>
import unreal, os

RAW_DIR = unreal.Paths.project_dir() + "RawAssets/Portraits"
PKG = "/Game/Portraits"
tools = unreal.AssetToolsHelpers.get_asset_tools()

tasks = []
for f in os.listdir(RAW_DIR):
    if not f.endswith(".png"):
        continue
    node = os.path.splitext(f)[0]
    t = unreal.AssetImportTask()
    t.filename = os.path.join(RAW_DIR, f)
    t.destination_path = PKG
    t.destination_name = f"T_{node}"
    t.automated = True
    t.replace_existing = True
    t.save = True
    tasks.append(t)
tools.import_asset_tasks(tasks)

ok = sum(1 for t in tasks if unreal.EditorAssetLibrary.does_asset_exist(f"{PKG}/T_{os.path.splitext(os.path.basename(t.filename))[0]}"))
with open(r"C:/Users/Public/WCUE/portraits_out.txt", "w") as out:
    out.write(f"imported={ok}/{len(tasks)}\n")

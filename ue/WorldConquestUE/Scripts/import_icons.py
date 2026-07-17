# 거점 UI 아이콘 임포트 — RawAssets/Icons/<name>.png → /Game/Icons/T_icon_<name>
# 출처: game-icons.net (CC BY 3.0, Lorc/Delapouite & contributors). 흰색/투명 → Slate TintColor 로 금색화.
import unreal, os

RAW_DIR = unreal.Paths.project_dir() + "RawAssets/Icons"
PKG = "/Game/Icons"
tools = unreal.AssetToolsHelpers.get_asset_tools()

tasks = []
for f in sorted(os.listdir(RAW_DIR)):
    if not f.endswith(".png") or f.startswith("_"):   # _icons_contact.png 등 제외
        continue
    node = os.path.splitext(f)[0]
    t = unreal.AssetImportTask()
    t.filename = os.path.join(RAW_DIR, f)
    t.destination_path = PKG
    t.destination_name = f"T_icon_{node}"
    t.automated = True
    t.replace_existing = True
    t.save = True
    tasks.append(t)
tools.import_asset_tasks(tasks)

# UI 그룹 + 알파 보존 (틴트용 흰색 마스크)
ok = 0
for t in tasks:
    name = f"{PKG}/{t.destination_name}"
    tex = unreal.load_asset(name)
    if tex:
        tex.set_editor_property("lod_group", unreal.TextureGroup.TEXTUREGROUP_UI)
        tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_EDITOR_ICON)
        tex.set_editor_property("srgb", True)
        unreal.EditorAssetLibrary.save_asset(name)
        ok += 1

with open(r"C:/Users/Public/WCUE/icons_out.txt", "w") as out:
    out.write(f"imported={ok}/{len(tasks)}\n")

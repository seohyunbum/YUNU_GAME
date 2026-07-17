# 지도 마커·깃발 메시 임포트 — Kenney Castle Kit (CC0) GLB → /Game/Markers/SM_<name>
# 실행: UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script="<이 파일>" -unattended
#
# 왜 GLB 인가: Kenney 공식 가이드가 UE 는 GLB 권장(FBX 는 스케일·축 문제 잦음).
# 왜 Recompute Normals/Tangents 를 끄는가: Kenney 로우폴리는 작가가 구운 노멀이 정본이라
#   재계산하면 평평한 면이 뭉개진다(Kenney 공식 문서 캐비엇).
import unreal, os

RAW = unreal.Paths.project_dir() + "RawAssets/Markers"
PKG = "/Game/Markers"
tools = unreal.AssetToolsHelpers.get_asset_tools()
OUT = open(r"C:/Users/Public/WCUE/markers_out.txt", "w", encoding="utf-8")

# 1) 컬러맵 텍스처 (Kenney 팩 전체가 공유하는 아틀라스 1장)
tex_task = unreal.AssetImportTask()
tex_task.filename = os.path.join(RAW, "Textures", "colormap.png")
tex_task.destination_path = PKG
tex_task.destination_name = "T_kenney_colormap"
tex_task.automated = True
tex_task.replace_existing = True
tex_task.save = True
tools.import_asset_tasks([tex_task])

# 2) GLB 메시들
tasks = []
for f in sorted(os.listdir(RAW)):
    if not f.lower().endswith(".glb"):
        continue
    name = os.path.splitext(f)[0].replace("-", "_")
    t = unreal.AssetImportTask()
    t.filename = os.path.join(RAW, f)
    t.destination_path = PKG
    t.destination_name = f"SM_{name}"
    t.automated = True
    t.replace_existing = True
    t.save = True
    tasks.append(t)

tools.import_asset_tasks(tasks)

# 3) 결과 확인 + 메시별 머티리얼 슬롯 보고 (깃발 천만 세력색으로 틴트하려면 슬롯이 갈려야 함)
ok = 0
for t in tasks:
    name = t.destination_name
    # glTF 임포트는 <name>/<mesh> 서브경로로 들어가기도 해서 두 경로 다 확인
    found = None
    for path in (f"{PKG}/{name}", f"{PKG}/{name}/{name}"):
        if unreal.EditorAssetLibrary.does_asset_exist(path):
            found = unreal.load_asset(path)
            break
    if found and isinstance(found, unreal.StaticMesh):
        ok += 1
        slots = found.static_materials
        OUT.write(f"{name}: OK  slots={len(slots)} " +
                  ", ".join(str(s.material_slot_name) for s in slots) + "\n")
    else:
        OUT.write(f"{name}: 실패 또는 경로 불명\n")

# 실제로 무엇이 생겼는지 전수 나열 (경로 추정이 틀렸을 때 진단용)
OUT.write("\n--- /Game/Markers 실제 에셋 ---\n")
for a in unreal.EditorAssetLibrary.list_assets(PKG, recursive=True):
    OUT.write(f"  {a}\n")

OUT.write(f"\nimported={ok}/{len(tasks)}\n")
OUT.close()
unreal.log("MARKERS_IMPORT_DONE")

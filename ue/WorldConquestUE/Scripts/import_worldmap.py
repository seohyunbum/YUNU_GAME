# 세계지도 텍스처 임포트 + unlit 머티리얼 생성 (에디터 Python — 코드-퍼스트 에셋 파이프라인)
# 실행: UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script="<이 파일>" -unattended
import unreal

RAW = unreal.Paths.project_dir() + "RawAssets/world_map.jpg"
PKG = "/Game/WorldMap"

tools = unreal.AssetToolsHelpers.get_asset_tools()

# 1) 텍스처 임포트
task = unreal.AssetImportTask()
task.filename = RAW
task.destination_path = PKG
task.destination_name = "T_WorldMap"
task.automated = True
task.replace_existing = True
task.save = True
tools.import_asset_tasks([task])
tex = unreal.load_asset(f"{PKG}/T_WorldMap")
assert tex, "텍스처 임포트 실패"

# 2) unlit 머티리얼 (지도는 조명 무관 — 균일 밝기)
if not unreal.EditorAssetLibrary.does_asset_exist(f"{PKG}/M_WorldMap"):
    mat = tools.create_asset("M_WorldMap", PKG, unreal.Material, unreal.MaterialFactoryNew())
else:
    mat = unreal.load_asset(f"{PKG}/M_WorldMap")
mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)

lib = unreal.MaterialEditingLibrary
lib.delete_all_material_expressions(mat)
ts = lib.create_material_expression(mat, unreal.MaterialExpressionTextureSample, -400, 0)
ts.texture = tex
lib.connect_material_property(ts, "RGB", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
lib.recompile_material(mat)

# 3) 마커·간선용 unlit 색 머티리얼 — Color 파라미터를 MID 로 지정 (조명에 씻기지 않는 선명한 세력색)
if not unreal.EditorAssetLibrary.does_asset_exist(f"{PKG}/M_UnlitColor"):
    mc = tools.create_asset("M_UnlitColor", PKG, unreal.Material, unreal.MaterialFactoryNew())
else:
    mc = unreal.load_asset(f"{PKG}/M_UnlitColor")
mc.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
lib.delete_all_material_expressions(mc)
vp = lib.create_material_expression(mc, unreal.MaterialExpressionVectorParameter, -400, 0)
vp.set_editor_property("parameter_name", "Color")
vp.set_editor_property("default_value", unreal.LinearColor(1.0, 1.0, 1.0, 1.0))
lib.connect_material_property(vp, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
lib.recompile_material(mc)

unreal.EditorAssetLibrary.save_asset(f"{PKG}/T_WorldMap")
unreal.EditorAssetLibrary.save_asset(f"{PKG}/M_WorldMap")
unreal.EditorAssetLibrary.save_asset(f"{PKG}/M_UnlitColor")
unreal.log("WORLDMAP_ASSETS_OK")

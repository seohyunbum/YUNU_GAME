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

# 2) lit 머티리얼 — 지형 그림자·대기광 반응 (정본)
if not unreal.EditorAssetLibrary.does_asset_exist(f"{PKG}/M_WorldMap"):
    mat = tools.create_asset("M_WorldMap", PKG, unreal.Material, unreal.MaterialFactoryNew())
else:
    mat = unreal.load_asset(f"{PKG}/M_WorldMap")
mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_DEFAULT_LIT)

lib = unreal.MaterialEditingLibrary
lib.delete_all_material_expressions(mat)
ts = lib.create_material_expression(mat, unreal.MaterialExpressionTextureSample, -400, 0)
ts.texture = tex
lib.connect_material_property(ts, "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
rough = lib.create_material_expression(mat, unreal.MaterialExpressionConstant, -500, 260)
rough.set_editor_property("r", 0.85)
lib.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
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

# 4) 세력 영역 머티리얼 — 거점 주변에 소유 세력색 원판을 깔아 "누가 먹었는지" 를 보여준다.
#    방사 그라데이션을 노드로 계산하다 두 번 실패했다(데칼 UV·도메인 잔존) → **텍스처로 간다**.
#    T_zone.png = scratchpad/make_zone_tex.py 산출물 (중심 채움 + 테두리 링, 알파). 눈으로 확인 가능.
zone_task = unreal.AssetImportTask()
zone_task.filename = unreal.Paths.project_dir() + "RawAssets/T_zone.png"
zone_task.destination_path = PKG
zone_task.destination_name = "T_zone"
zone_task.automated = True
zone_task.replace_existing = True
zone_task.save = True
tools.import_asset_tasks([zone_task])
zone_tex = unreal.load_asset(f"{PKG}/T_zone")
assert zone_tex, "T_zone 임포트 실패"

if not unreal.EditorAssetLibrary.does_asset_exist(f"{PKG}/M_Territory"):
    mt = tools.create_asset("M_Territory", PKG, unreal.Material, unreal.MaterialFactoryNew())
else:
    mt = unreal.load_asset(f"{PKG}/M_Territory")
# [MUST] domain 을 명시적으로 되돌린다 — 과거 데칼로 만든 에셋에 MD_DEFERRED_DECAL 이 남아
# 평면에 붙였을 때 UV 가 어긋나 지도 전체에 동심원 호가 번졌다(2026-07-17 실측).
mt.set_editor_property("material_domain", unreal.MaterialDomain.MD_SURFACE)
mt.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
mt.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
mt.set_editor_property("two_sided", True)
lib.delete_all_material_expressions(mt)

ts_zone = lib.create_material_expression(mt, unreal.MaterialExpressionTextureSample, -600, 0)
ts_zone.texture = zone_tex
tcolor = lib.create_material_expression(mt, unreal.MaterialExpressionVectorParameter, -600, 300)
tcolor.set_editor_property("parameter_name", "Color")
tcolor.set_editor_property("default_value", unreal.LinearColor(1.0, 1.0, 1.0, 1.0))

# 색 = 텍스처RGB(흰색) × 세력색 → Emissive (unlit 이라 조명에 안 씻긴다)
emul = lib.create_material_expression(mt, unreal.MaterialExpressionMultiply, -350, 100)
lib.connect_material_expressions(ts_zone, "RGB", emul, "A")
lib.connect_material_expressions(tcolor, "", emul, "B")
lib.connect_material_property(emul, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)

# 불투명도 = 텍스처 알파 × Opacity 파라미터
opac = lib.create_material_expression(mt, unreal.MaterialExpressionScalarParameter, -350, 400)
opac.set_editor_property("parameter_name", "Opacity")
opac.set_editor_property("default_value", 0.85)
omul = lib.create_material_expression(mt, unreal.MaterialExpressionMultiply, -180, 300)
lib.connect_material_expressions(ts_zone, "A", omul, "A")
lib.connect_material_expressions(opac, "", omul, "B")
lib.connect_material_property(omul, "", unreal.MaterialProperty.MP_OPACITY)
lib.recompile_material(mt)

unreal.EditorAssetLibrary.save_asset(f"{PKG}/T_zone")
unreal.EditorAssetLibrary.save_asset(f"{PKG}/T_WorldMap")
unreal.EditorAssetLibrary.save_asset(f"{PKG}/M_WorldMap")
unreal.EditorAssetLibrary.save_asset(f"{PKG}/M_UnlitColor")
unreal.EditorAssetLibrary.save_asset(f"{PKG}/M_Territory")
unreal.log("WORLDMAP_ASSETS_OK")

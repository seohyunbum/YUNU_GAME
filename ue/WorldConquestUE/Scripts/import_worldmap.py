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
#    중심 채움 + 뚜렷한 테두리 링 (배경색과 무관하게 영역 경계가 읽히도록).
if not unreal.EditorAssetLibrary.does_asset_exist(f"{PKG}/M_Territory"):
    mt = tools.create_asset("M_Territory", PKG, unreal.Material, unreal.MaterialFactoryNew())
else:
    mt = unreal.load_asset(f"{PKG}/M_Territory")
# 데칼 도메인은 투영축·UV 가 어긋나 지도 전체에 호가 번졌다(실측) → 일반 서피스 평면으로.
mt.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
mt.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
mt.set_editor_property("two_sided", True)
lib.delete_all_material_expressions(mt)

tcolor = lib.create_material_expression(mt, unreal.MaterialExpressionVectorParameter, -600, 0)
tcolor.set_editor_property("parameter_name", "Color")
tcolor.set_editor_property("default_value", unreal.LinearColor(1.0, 1.0, 1.0, 1.0))
lib.connect_material_property(tcolor, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)

# 방사 그라데이션 = saturate(1 - distance(UV, 0.5) * 2) ^ Falloff
# (RadialGradientExponential 노드는 Python 에 미노출 → 기본 노드로 직접 구성)
uv = lib.create_material_expression(mt, unreal.MaterialExpressionTextureCoordinate, -1100, 260)
ctr = lib.create_material_expression(mt, unreal.MaterialExpressionConstant2Vector, -1100, 400)
ctr.set_editor_property("r", 0.5)
ctr.set_editor_property("g", 0.5)
dist = lib.create_material_expression(mt, unreal.MaterialExpressionDistance, -900, 300)
lib.connect_material_expressions(uv, "", dist, "A")
lib.connect_material_expressions(ctr, "", dist, "B")

two = lib.create_material_expression(mt, unreal.MaterialExpressionConstant, -900, 440)
two.set_editor_property("r", 2.0)
dmul = lib.create_material_expression(mt, unreal.MaterialExpressionMultiply, -750, 320)   # 0(중심)~1(가장자리)
lib.connect_material_expressions(dist, "", dmul, "A")
lib.connect_material_expressions(two, "", dmul, "B")

inv = lib.create_material_expression(mt, unreal.MaterialExpressionOneMinus, -620, 320)    # 1(중심)~0(가장자리)
lib.connect_material_expressions(dmul, "", inv, "")
sat = lib.create_material_expression(mt, unreal.MaterialExpressionSaturate, -500, 320)
lib.connect_material_expressions(inv, "", sat, "")

fall = lib.create_material_expression(mt, unreal.MaterialExpressionConstant, -500, 460)
fall.set_editor_property("r", 1.8)                                                        # 가장자리 페이드 강도
pw = lib.create_material_expression(mt, unreal.MaterialExpressionPower, -360, 340)
lib.connect_material_expressions(sat, "", pw, "Base")
lib.connect_material_expressions(fall, "", pw, "Exponent")

# 채움(옅게) — 배경색과 비슷하면 묻히므로 단독으로는 부족
fillamt = lib.create_material_expression(mt, unreal.MaterialExpressionConstant, -360, 200)
fillamt.set_editor_property("r", 0.42)
fill = lib.create_material_expression(mt, unreal.MaterialExpressionMultiply, -220, 300)
lib.connect_material_expressions(pw, "", fill, "A")
lib.connect_material_expressions(fillamt, "", fill, "B")

# 테두리 링 — "여기까지가 이 세력 땅" 을 배경색과 무관하게 읽히게 하는 핵심 [MUST]
# ring = saturate(1 - |d - 0.82| * 9) * 0.9   (d = 0중심~1가장자리)
ringc = lib.create_material_expression(mt, unreal.MaterialExpressionConstant, -900, 600)
ringc.set_editor_property("r", 0.82)                                                      # 링 반경
rsub = lib.create_material_expression(mt, unreal.MaterialExpressionSubtract, -750, 620)
lib.connect_material_expressions(dmul, "", rsub, "A")
lib.connect_material_expressions(ringc, "", rsub, "B")
rabs = lib.create_material_expression(mt, unreal.MaterialExpressionAbs, -620, 620)
lib.connect_material_expressions(rsub, "", rabs, "")
rsharp = lib.create_material_expression(mt, unreal.MaterialExpressionConstant, -620, 720)
rsharp.set_editor_property("r", 9.0)                                                      # 링 두께(클수록 얇음)
rmul = lib.create_material_expression(mt, unreal.MaterialExpressionMultiply, -500, 640)
lib.connect_material_expressions(rabs, "", rmul, "A")
lib.connect_material_expressions(rsharp, "", rmul, "B")
rinv = lib.create_material_expression(mt, unreal.MaterialExpressionOneMinus, -380, 640)
lib.connect_material_expressions(rmul, "", rinv, "")
rsat = lib.create_material_expression(mt, unreal.MaterialExpressionSaturate, -280, 640)
lib.connect_material_expressions(rinv, "", rsat, "")
ringamt = lib.create_material_expression(mt, unreal.MaterialExpressionConstant, -280, 740)
ringamt.set_editor_property("r", 0.9)
ring = lib.create_material_expression(mt, unreal.MaterialExpressionMultiply, -160, 660)
lib.connect_material_expressions(rsat, "", ring, "A")
lib.connect_material_expressions(ringamt, "", ring, "B")

# opacity = saturate(fill + ring) * Opacity
add = lib.create_material_expression(mt, unreal.MaterialExpressionAdd, -60, 460)
lib.connect_material_expressions(fill, "", add, "A")
lib.connect_material_expressions(ring, "", add, "B")
asat = lib.create_material_expression(mt, unreal.MaterialExpressionSaturate, 60, 460)
lib.connect_material_expressions(add, "", asat, "")

opac = lib.create_material_expression(mt, unreal.MaterialExpressionScalarParameter, 60, 600)
opac.set_editor_property("parameter_name", "Opacity")
opac.set_editor_property("default_value", 0.85)
mul = lib.create_material_expression(mt, unreal.MaterialExpressionMultiply, 200, 500)
lib.connect_material_expressions(asat, "", mul, "A")
lib.connect_material_expressions(opac, "", mul, "B")
lib.connect_material_property(mul, "", unreal.MaterialProperty.MP_OPACITY)
lib.recompile_material(mt)

unreal.EditorAssetLibrary.save_asset(f"{PKG}/T_WorldMap")
unreal.EditorAssetLibrary.save_asset(f"{PKG}/M_WorldMap")
unreal.EditorAssetLibrary.save_asset(f"{PKG}/M_UnlitColor")
unreal.EditorAssetLibrary.save_asset(f"{PKG}/M_Territory")
unreal.log("WORLDMAP_ASSETS_OK")

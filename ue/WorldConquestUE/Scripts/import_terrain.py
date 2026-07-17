# 지형 메시 임포트 + lit 위성 머티리얼 — RTK식 3D 릴리프 세계지도
import unreal

OUT = open(r"C:/Users/Public/WCUE/terrain_out.txt", "w", encoding="utf-8")
tools = unreal.AssetToolsHelpers.get_asset_tools()
lib = unreal.MaterialEditingLibrary

# 1) terrain.obj → /Game/WorldMap/terrain (Interchange)
task = unreal.AssetImportTask()
task.filename = unreal.Paths.project_dir() + "RawAssets/terrain.obj"
task.destination_path = "/Game/WorldMap"
task.destination_name = "SM_Terrain"
task.automated = True
task.replace_existing = True
task.save = True
tools.import_asset_tasks([task])

mesh = unreal.load_asset("/Game/WorldMap/SM_Terrain")
if not mesh:   # Interchange 가 이름을 달리 줄 수 있음 — 폴백 탐색
    reg = unreal.AssetRegistryHelpers.get_asset_registry()
    assets = reg.get_assets_by_path("/Game/WorldMap", recursive=True)
    for a in assets:
        if a.asset_class_path.asset_name == "StaticMesh":
            mesh = a.get_asset()
            OUT.write(f"fallback_mesh={a.package_name}\n")
            break
OUT.write(f"mesh={'OK' if mesh else 'MISSING'}\n")

if mesh:
    # 클릭 픽킹·마커 부착용 복합 콜리전
    bs = mesh.get_editor_property("body_setup")
    if bs:
        bs.set_editor_property("collision_trace_flag", unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
    unreal.EditorAssetLibrary.save_loaded_asset(mesh)

# 2) M_WorldMap → lit 전환 (BaseColor + roughness) — 지형 그림자·대기광 반응
tex = unreal.load_asset("/Game/WorldMap/T_WorldMap")
mat = unreal.load_asset("/Game/WorldMap/M_WorldMap")
mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_DEFAULT_LIT)
lib.delete_all_material_expressions(mat)
ts = lib.create_material_expression(mat, unreal.MaterialExpressionTextureSample, -500, 0)
ts.texture = tex
lib.connect_material_property(ts, "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
rough = lib.create_material_expression(mat, unreal.MaterialExpressionConstant, -500, 260)
rough.set_editor_property("r", 0.85)
lib.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
lib.recompile_material(mat)
unreal.EditorAssetLibrary.save_asset("/Game/WorldMap/M_WorldMap")

OUT.write("DONE\n")
OUT.close()

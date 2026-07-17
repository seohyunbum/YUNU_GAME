import unreal
OUT = open(r'C:/Users/Public/WCUE/inspect_out.txt', 'w', encoding='utf-8')

m = unreal.load_asset("/Game/WorldMap/M_UnlitColor")
lib = unreal.MaterialEditingLibrary
OUT.write(f"expressions={lib.get_num_material_expressions(m)}\n")
OUT.write(f"shading_model={m.get_editor_property('shading_model')}\n")
OUT.write(f"vector_params={[str(x) for x in lib.get_vector_parameter_names(m)]}\n")

lib.delete_all_material_expressions(m)
vp = lib.create_material_expression(m, unreal.MaterialExpressionVectorParameter, -400, 0)
vp.set_editor_property("parameter_name", "Color")
vp.set_editor_property("default_value", unreal.LinearColor(1.0, 0.0, 1.0, 1.0))
ok = lib.connect_material_property(vp, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
OUT.write(f"connect_result={ok}\n")
lib.recompile_material(m)
unreal.EditorAssetLibrary.save_asset("/Game/WorldMap/M_UnlitColor")
OUT.write(f"vector_params_after={[str(x) for x in lib.get_vector_parameter_names(m)]}\n")
OUT.write("DONE\n")
OUT.close()

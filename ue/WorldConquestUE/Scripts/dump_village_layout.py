# Asian_Village 데모 맵의 스태틱메시 배치(메시+트랜스폼)를 JSON 으로 덤프.
# → 도시 디오라마가 이 데이터로 아티스트의 마을을 코드로 정확 재현 (레벨스트리밍 불필요).
import unreal, json

OUT = r"C:/Users/Public/WCUE/village_layout.json"
LOG = open(r"C:/Users/Public/WCUE/village_out.txt", "w", encoding="utf-8")

demo = "/Game/Asian_Village/maps/Asian_Village_Demo"
ok = unreal.EditorLoadingAndSavingUtils.load_map(demo)
LOG.write(f"load_map={'OK' if ok else 'FAIL'}\n")

actors = unreal.EditorLevelLibrary.get_all_level_actors()
LOG.write(f"actor_count={len(actors)}\n")

items = []
minv = [1e9, 1e9, 1e9]; maxv = [-1e9, -1e9, -1e9]
for a in actors:
    comp = a.get_component_by_class(unreal.StaticMeshComponent)
    if not comp:
        continue
    mesh = comp.static_mesh
    if not mesh:
        continue
    t = a.get_actor_transform()
    loc = t.translation; rot = t.rotation.rotator(); scl = t.scale3d
    items.append({
        "mesh": str(mesh.get_path_name()).split(".")[0],   # /Game/.../SM_x
        "loc": [round(loc.x, 1), round(loc.y, 1), round(loc.z, 1)],
        "rot": [round(rot.roll, 2), round(rot.pitch, 2), round(rot.yaw, 2)],
        "scl": [round(scl.x, 3), round(scl.y, 3), round(scl.z, 3)],
    })
    for i, c in enumerate([loc.x, loc.y, loc.z]):
        minv[i] = min(minv[i], c); maxv[i] = max(maxv[i], c)

json.dump({"bounds_min": minv, "bounds_max": maxv, "items": items},
          open(OUT, "w", encoding="utf-8"))
LOG.write(f"mesh_actors={len(items)}\n")
LOG.write(f"bounds_min={minv}\nbounds_max={maxv}\n")
# 사용된 고유 메시
uniq = sorted(set(i["mesh"].split("/")[-1] for i in items))
LOG.write(f"unique_meshes={len(uniq)}: {','.join(uniq[:60])}\n")
LOG.write("DONE\n")
LOG.close()

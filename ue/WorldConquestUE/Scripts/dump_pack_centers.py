# 각 지역 팩 데모 맵의 '건물 밀집 중심'을 실측한다.
# WCCityDiorama 는 이 중심이 액터 원점에 오도록 레벨을 오프셋 로드하므로,
# 이 값이 틀리면 배경이 카메라 밖에 놓인다(= 화면이 텅 빔).
#
# 중앙값(median)을 쓴다 — 평균은 멀리 떨어진 스카이박스·바닥판 하나에 끌려간다.
import unreal

MAPS = {
    "east_asia":     "/Game/Asian_Village/maps/Asian_Village_Demo",
    "europe":        "/Game/Fantastic_Village_Pack/maps/map_village_day",
    "middle_east":   "/Game/Stylized_Egypt/Maps/Stylized_Egypt_Demo",
    "north_america": "/Game/AssetsvilleTown/Maps/Demonstration",
}

out = []
subsys = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)

for region, path in MAPS.items():
    if not unreal.EditorAssetLibrary.does_asset_exist(path):
        out.append(f"{region}: 맵 없음 — {path}")
        continue
    subsys.load_level(path)
    actors = unreal.EditorActorSubsystem().get_all_level_actors()

    pts = []
    for a in actors:
        # 스태틱메시 액터만 (라이트·스카이·볼륨은 중심을 왜곡)
        if not a.get_component_by_class(unreal.StaticMeshComponent):
            continue
        loc = a.get_actor_location()
        pts.append((loc.x, loc.y, loc.z))

    if not pts:
        out.append(f"{region}: 스태틱메시 액터 0")
        continue

    xs = sorted(p[0] for p in pts); ys = sorted(p[1] for p in pts); zs = sorted(p[2] for p in pts)
    n = len(pts)
    med = (xs[n // 2], ys[n // 2], zs[n // 2])
    out.append(f"{region}: actors={n}  median=({med[0]:.0f}, {med[1]:.0f}, {med[2]:.0f})  "
               f"x[{xs[0]:.0f}~{xs[-1]:.0f}] y[{ys[0]:.0f}~{ys[-1]:.0f}] z[{zs[0]:.0f}~{zs[-1]:.0f}]")

open(r"C:/Users/Public/WCUE/pack_centers.txt", "w", encoding="utf-8").write("\n".join(out))
unreal.log("PACK_CENTERS_DONE")

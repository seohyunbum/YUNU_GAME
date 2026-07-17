using UnrealBuildTool;

public class WorldConquestUE : ModuleRules
{
    public WorldConquestUE(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        // 서드파티 플러그인 0 [MUST] — UE 내장 모듈만 (ue5-client-design §3)
        PublicDependencyModuleNames.AddRange(new[]
        {
            "Core", "CoreUObject", "Engine", "InputCore",
            "HTTP", "Json", "JsonUtilities",
            "UMG", "Slate", "SlateCore",
        });
    }
}

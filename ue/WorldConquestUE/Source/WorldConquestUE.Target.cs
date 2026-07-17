using UnrealBuildTool;

public class WorldConquestUETarget : TargetRules
{
    public WorldConquestUETarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("WorldConquestUE");
    }
}

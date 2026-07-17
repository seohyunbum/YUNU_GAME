using UnrealBuildTool;

public class WorldConquestUEEditorTarget : TargetRules
{
    public WorldConquestUEEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("WorldConquestUE");
    }
}

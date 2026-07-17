#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "WCHUD.generated.h"

/** M1 상태 표시 — Canvas 텍스트 한 줄 (UMG 위젯은 M2). */
UCLASS()
class WORLDCONQUESTUE_API AWCHUD : public AHUD
{
    GENERATED_BODY()

public:
    virtual void DrawHUD() override;
};

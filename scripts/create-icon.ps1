$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$projectPath = "C:\ai-game-lab"
$assetPath = Join-Path $projectPath "assets"
$iconPath = Join-Path $assetPath "ai-game-lab.ico"
$pngPath = Join-Path $assetPath "ai-game-lab-icon.png"

New-Item -ItemType Directory -Path $assetPath -Force | Out-Null

function New-Brush($hex) {
  return New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function New-Pen($hex, $width) {
  return New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($hex), $width)
}

function Add-RoundedRect($path, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
}

function Draw-IconBitmap([int]$size) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $s = $size / 256.0
  function P([float]$value) { return [int][Math]::Round($value * $script:s) }

  $script:s = $s

  $bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundedRect $bgPath (P 16) (P 16) (P 224) (P 224) (P 42)
  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle((P 16), (P 16), (P 224), (P 224))),
    [System.Drawing.ColorTranslator]::FromHtml("#9bd1ff"),
    [System.Drawing.ColorTranslator]::FromHtml("#2f8f4c"),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
  )
  $graphics.FillPath($bgBrush, $bgPath)
  $graphics.DrawPath((New-Pen "#12324a" (P 5)), $bgPath)

  $graphics.FillEllipse((New-Brush "#6fc46f"), (P -10), (P 148), (P 276), (P 110))
  $graphics.DrawLine((New-Pen "#4e9b50" (P 2)), (P 24), (P 174), (P 232), (P 166))

  $treeTrunk = New-Object System.Drawing.Rectangle((P 53), (P 121), (P 16), (P 54))
  $graphics.FillRectangle((New-Brush "#7b4a2d"), $treeTrunk)
  $graphics.FillPolygon(
    (New-Brush "#1f6f42"),
    [System.Drawing.Point[]]@(
      (New-Object System.Drawing.Point((P 61), (P 54))),
      (New-Object System.Drawing.Point((P 27), (P 127))),
      (New-Object System.Drawing.Point((P 95), (P 127)))
    )
  )
  $graphics.FillPolygon(
    (New-Brush "#2f8f4c"),
    [System.Drawing.Point[]]@(
      (New-Object System.Drawing.Point((P 61), (P 85))),
      (New-Object System.Drawing.Point((P 33), (P 148))),
      (New-Object System.Drawing.Point((P 90), (P 148)))
    )
  )

  $caveRock = New-Brush "#5e6468"
  $graphics.FillEllipse($caveRock, (P 160), (P 113), (P 70), (P 52))
  $graphics.FillEllipse($caveRock, (P 178), (P 98), (P 48), (P 48))
  $graphics.FillEllipse((New-Brush "#25292e"), (P 175), (P 115), (P 42), (P 55))

  $top = [System.Drawing.Point[]]@(
    (New-Object System.Drawing.Point((P 104), (P 115))),
    (New-Object System.Drawing.Point((P 158), (P 94))),
    (New-Object System.Drawing.Point((P 203), (P 119))),
    (New-Object System.Drawing.Point((P 148), (P 143)))
  )
  $left = [System.Drawing.Point[]]@(
    (New-Object System.Drawing.Point((P 104), (P 115))),
    (New-Object System.Drawing.Point((P 148), (P 143))),
    (New-Object System.Drawing.Point((P 148), (P 200))),
    (New-Object System.Drawing.Point((P 104), (P 172)))
  )
  $right = [System.Drawing.Point[]]@(
    (New-Object System.Drawing.Point((P 148), (P 143))),
    (New-Object System.Drawing.Point((P 203), (P 119))),
    (New-Object System.Drawing.Point((P 203), (P 174))),
    (New-Object System.Drawing.Point((P 148), (P 200)))
  )
  $graphics.FillPolygon((New-Brush "#c18a48"), $top)
  $graphics.FillPolygon((New-Brush "#8f5d2f"), $left)
  $graphics.FillPolygon((New-Brush "#6f4328"), $right)
  $graphics.DrawPolygon((New-Pen "#3b2418" (P 4)), $top)
  $graphics.DrawPolygon((New-Pen "#3b2418" (P 4)), $left)
  $graphics.DrawPolygon((New-Pen "#3b2418" (P 4)), $right)

  foreach ($offset in 0, 18, 36) {
    $graphics.DrawLine((New-Pen "#e1b56d" (P 2)), (P (112 + $offset)), (P 112), (P (154 + $offset)), (P 134))
  }
  $graphics.DrawLine((New-Pen "#3b2418" (P 3)), (P 126), (P 158), (P 126), (P 184))
  $graphics.DrawLine((New-Pen "#3b2418" (P 3)), (P 174), (P 151), (P 174), (P 184))

  $crossPen = New-Pen "#ffffff" (P 6)
  $graphics.DrawLine($crossPen, (P 128), (P 62), (P 128), (P 88))
  $graphics.DrawLine($crossPen, (P 115), (P 75), (P 141), (P 75))
  $graphics.DrawEllipse((New-Pen "#12324a" (P 2)), (P 119), (P 66), (P 18), (P 18))

  $shine = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundedRect $shine (P 26) (P 26) (P 204) (P 92) (P 32)
  $shineBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle((P 26), (P 26), (P 204), (P 92))),
    [System.Drawing.Color]::FromArgb(80, 255, 255, 255),
    [System.Drawing.Color]::FromArgb(0, 255, 255, 255),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
  )
  $graphics.FillPath($shineBrush, $shine)

  $graphics.Dispose()
  return $bitmap
}

function Get-PngBytes([System.Drawing.Bitmap]$bitmap) {
  $stream = New-Object System.IO.MemoryStream
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  [byte[]]$bytes = $stream.ToArray()
  $stream.Dispose()
  Write-Output -NoEnumerate $bytes
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$images = @()

foreach ($size in $sizes) {
  $bitmap = Draw-IconBitmap $size
  $images += [pscustomobject]@{
    Size = $size
    Bytes = Get-PngBytes $bitmap
  }
  if ($size -eq 256) {
    $bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  $bitmap.Dispose()
}

$stream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($stream)
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]$images.Count)

$offset = 6 + ($images.Count * 16)
foreach ($image in $images) {
  $entrySize = $image.Size
  if ($entrySize -eq 256) {
    $entrySize = 0
  }
  $writer.Write([byte]$entrySize)
  $writer.Write([byte]$entrySize)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$image.Bytes.Length)
  $writer.Write([UInt32]$offset)
  $offset += $image.Bytes.Length
}

foreach ($image in $images) {
  $writer.Write($image.Bytes)
}

[System.IO.File]::WriteAllBytes($iconPath, $stream.ToArray())
$writer.Dispose()
$stream.Dispose()

[pscustomobject]@{
  Icon = $iconPath
  Preview = $pngPath
} | ConvertTo-Json

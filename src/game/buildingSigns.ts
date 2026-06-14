import * as THREE from "three";
import { gameMaterial } from "../visuals";

export type BuildingSignKind = "storage" | "blacksmith" | "shop" | "sell" | "home" | "twoStory";

export function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

export function createBuildingLabelTexture(label: string, kind: BuildingSignKind) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const palette = {
    storage: { top: "#f7c948", bottom: "#b45309", icon: "#7c2d12", text: "#fff8d6" },
    blacksmith: { top: "#475569", bottom: "#111827", icon: "#fb923c", text: "#fff7ed" },
    shop: { top: "#34d399", bottom: "#065f46", icon: "#fde68a", text: "#ecfdf5" },
    sell: { top: "#f59e0b", bottom: "#7c2d12", icon: "#fde68a", text: "#fff7ed" },
    home: { top: "#60a5fa", bottom: "#1e3a8a", icon: "#fde68a", text: "#eff6ff" },
    twoStory: { top: "#a78bfa", bottom: "#4c1d95", icon: "#fde68a", text: "#faf5ff" },
  }[kind];

  context.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, palette.top);
  gradient.addColorStop(1, palette.bottom);
  context.fillStyle = gradient;
  roundRect(context, 18, 18, 476, 156, 34);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,0.58)";
  context.lineWidth = 8;
  roundRect(context, 28, 28, 456, 136, 26);
  context.stroke();

  context.save();
  context.translate(100, 96);
  context.fillStyle = palette.icon;
  context.strokeStyle = "rgba(17,24,39,0.58)";
  context.lineWidth = 9;
  context.lineCap = "round";
  context.lineJoin = "round";
  if (kind === "storage") {
    context.fillRect(-43, -18, 86, 52);
    context.strokeRect(-43, -18, 86, 52);
    context.fillStyle = "#fff1a8";
    context.fillRect(-34, -50, 28, 28);
    context.fillRect(6, -50, 28, 28);
    context.strokeRect(-34, -50, 28, 28);
    context.strokeRect(6, -50, 28, 28);
  } else if (kind === "blacksmith") {
    context.rotate(-0.58);
    context.fillRect(-10, -54, 20, 94);
    context.fillRect(-44, -62, 88, 30);
    context.strokeRect(-10, -54, 20, 94);
    context.strokeRect(-44, -62, 88, 30);
  } else if (kind === "shop") {
    context.beginPath();
    context.moveTo(-44, -30);
    context.lineTo(44, -30);
    context.lineTo(36, 50);
    context.lineTo(-36, 50);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = "#fff7ad";
    context.fillRect(-28, -58, 56, 28);
    context.strokeRect(-28, -58, 56, 28);
    context.beginPath();
    context.arc(0, -4, 15, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else if (kind === "sell") {
    context.beginPath();
    context.arc(-18, -8, 28, 0, Math.PI * 2);
    context.arc(22, 10, 24, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#7c2d12";
    context.font = "900 42px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("P", -18, -8);
    context.fillText("\u2197", 22, 10);
  } else {
    context.beginPath();
    context.moveTo(-50, -4);
    context.lineTo(0, -52);
    context.lineTo(50, -4);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillRect(-34, -4, 68, 54);
    context.strokeRect(-34, -4, 68, 54);
    if (kind === "twoStory") {
      context.fillStyle = "#1f2937";
      context.font = "900 52px Arial";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("2", 0, 20);
    }
  }
  context.restore();

  // 라벨 폭에 맞춰 폰트 자동 축소 — "닉네임의 집"처럼 긴 이름도 잘리지 않게.
  let fontSize = 74;
  const setFont = () => { context.font = `900 ${fontSize}px Arial, 'Malgun Gothic', sans-serif`; };
  setFont();
  while (context.measureText(label).width > 330 && fontSize > 30) { fontSize -= 4; setFont(); }
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(0,0,0,0.34)";
  context.fillText(label, 158, 102);
  context.fillStyle = palette.text;
  context.fillText(label, 154, 96);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createBuildingSign(label: string, kind: BuildingSignKind, width = 2.2, height = 0.82) {
  const group = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.16, height + 0.12, 0.11),
    gameMaterial(kind === "blacksmith" ? 0x2f241c : 0x5b341d, { roughness: 0.78 }),
  );
  const texture = createBuildingLabelTexture(label, kind);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: texture ?? undefined,
      color: 0xffffff,
      transparent: true,
    }),
  );
  face.position.z = 0.062;
  const topPin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.86, 0.055, 0.16), gameMaterial(0xf3c969, { metalness: 0.24, roughness: 0.38 }));
  topPin.position.set(0, height / 2 + 0.06, 0.085);
  const bottomPin = topPin.clone();
  bottomPin.position.y = -height / 2 - 0.06;
  group.add(board, face, topPin, bottomPin);
  return group;
}

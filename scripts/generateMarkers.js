/**
 * 🧠 Copilot Instructions:
 * Generate 5 colored circular map marker PNGs (128x128) with a small downward pointer triangle
 * and a white sport icon in the center using emojis. Use Node Canvas to render each one.
 * 
 * Colors & icons:
 * - Football: #22c55e ⚽
 * - Cricket:  #3b82f6 🏏
 * - Basketball: #f97316 🏀
 * - Badminton: #a855f7 🏸
 * - Tennis: #ec4899 🎾
 * 
 * Save each marker as football.png, cricket.png, basketball.png, badminton.png, tennis.png
 * inside ../assets/markers/
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const markers = [
  { name: 'football', color: '#22c55e', icon: '⚽' },
  { name: 'cricket', color: '#3b82f6', icon: '🏏' },
  { name: 'basketball', color: '#f97316', icon: '🏀' },
  { name: 'badminton', color: '#a855f7', icon: '🏸' },
  { name: 'tennis', color: '#ec4899', icon: '🎾' },
];

const OUTPUT_DIR = path.resolve('../assets/markers');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const SIZE = 128;
const POINTER_HEIGHT = 24;

markers.forEach(({ name, color, icon }) => {
  const canvas = createCanvas(SIZE, SIZE + POINTER_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Draw shadow
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;

  // Draw circular head
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 10, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.closePath();

  // Draw white border
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#fff';
  ctx.stroke();

  // Draw pointer triangle
  ctx.beginPath();
  ctx.moveTo(SIZE / 2 - 16, SIZE - 5);
  ctx.lineTo(SIZE / 2 + 16, SIZE - 5);
  ctx.lineTo(SIZE / 2, SIZE + POINTER_HEIGHT - 5);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  // Draw icon (emoji)
  ctx.font = 'bold 60px Arial';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, SIZE / 2, SIZE / 2 - 4);

  // Save PNG
  const filePath = path.join(OUTPUT_DIR, `${name}.png`);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer);
  console.log(`✅ Marker generated: ${filePath}`);
});

console.log('🎨 All markers created successfully!');

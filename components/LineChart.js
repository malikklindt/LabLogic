'use client';
import { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';

// Clips canvas to the left fraction during animation → left-to-right draw effect
const drawFromLeft = {
  id: 'drawFromLeft',
  beforeDatasetsDraw(chart, { easingValue }) {
    const p = easingValue ?? 1;
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartArea.left + chartArea.width * p, chart.height);
    ctx.clip();
  },
  afterDatasetsDraw(chart) { chart.ctx.restore(); },
};

export default function LineChart({ data, color = '#22c55e', height = 120, fill = true, padding = {}, dynamicScale = false }) {
  const ref = useRef(null);
  const inst = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (inst.current) { inst.current.destroy(); inst.current = null; }
    const ctx = ref.current.getContext('2d');
    const rv = parseInt(color.slice(1, 3), 16);
    const gv = parseInt(color.slice(3, 5), 16);
    const bv = parseInt(color.slice(5, 7), 16);
    const rgba = a => `rgba(${rv},${gv},${bv},${a})`;
    const gradH = ref.current.offsetHeight || (typeof height === 'number' ? height : 110);
    const grad = ctx.createLinearGradient(0, 0, 0, gradH);
    grad.addColorStop(0, rgba(0.30));
    grad.addColorStop(0.55, rgba(0.08));
    grad.addColorStop(1, rgba(0.00));
    const glowPlugin = {
      id: 'lineGlow',
      beforeDatasetsDraw(chart) {
        chart.ctx.save();
        chart.ctx.shadowBlur = 14;
        chart.ctx.shadowColor = rgba(0.75);
        chart.ctx.shadowOffsetX = 0;
        chart.ctx.shadowOffsetY = 0;
      },
      afterDatasetsDraw(chart) { chart.ctx.restore(); }
    };
    inst.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((_, i) => i),
        datasets: [{
          data,
          borderColor: color,
          borderWidth: 2.5,
          backgroundColor: fill ? grad : 'transparent',
          fill,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1a2e', borderColor: '#2a2a4a', borderWidth: 1,
            titleColor: '#9090b0', bodyColor: '#e0e0f0', padding: 8, displayColors: false,
          }
        },
        layout: { padding },
        scales: {
          x: { display: false },
          y: {
            display: false,
            ...(dynamicScale && data.length > 0 ? {
              min: Math.min(...data) * 0.998,
              max: Math.max(...data) * 1.002,
            } : {}),
          },
        },
        animation: { duration: 850, easing: 'easeInOutCubic' },
      },
      plugins: [glowPlugin, drawFromLeft]
    });
    return () => { if (inst.current) { inst.current.destroy(); inst.current = null; } };
  }, [data, color]);

  return <div className="chart-wrap" style={{ height }}><canvas ref={ref} /></div>;
}

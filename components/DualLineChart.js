'use client';
import { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';

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

export default function DualLineChart({ data1, data2, color1 = '#f7931a', color2 = '#f97316', label1 = 'A', label2 = 'B', height = 110 }) {
  const ref = useRef(null);
  const inst = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (inst.current) { inst.current.destroy(); inst.current = null; }
    const ctx = ref.current.getContext('2d');
    inst.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data1.map((_, i) => i),
        datasets: [
          { label: label1, data: data1, borderColor: color1, borderWidth: 2, fill: false, tension: 0.4, pointRadius: 0, pointStyle: 'line', yAxisID: 'y1' },
          { label: label2, data: data2, borderColor: color2, borderWidth: 2, fill: false, tension: 0.4, pointRadius: 0, pointStyle: 'line', yAxisID: 'y2' },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', align: 'end', labels: { color: '#8080a0', font: { size: 10 }, usePointStyle: true, pointStyleWidth: 20, padding: 8 } },
          tooltip: { backgroundColor: '#1a1a2e', borderColor: '#2a2a4a', borderWidth: 1, titleColor: '#9090b0', bodyColor: '#e0e0f0' }
        },
        scales: { x: { display: false }, y1: { display: false }, y2: { display: false } },
        animation: { duration: 850, easing: 'easeInOutCubic' },
      },
      plugins: [drawFromLeft]
    });
    return () => { if (inst.current) { inst.current.destroy(); inst.current = null; } };
  }, [data1, data2, color1, color2]);

  return <div className="chart-wrap" style={{ height }}><canvas ref={ref} /></div>;
}

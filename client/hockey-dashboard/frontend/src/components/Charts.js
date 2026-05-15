import React, { useEffect, useRef } from 'react';
import { Chart, BarElement, BarController, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import styles from './Charts.module.css';

Chart.register(BarElement, BarController, CategoryScale, LinearScale, Tooltip);

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { mode: 'index' }
  },
  scales: {
    x: {
      ticks: { color: '#9E9C96', font: { size: 10, family: "'Geist Mono', monospace" } },
      grid: { color: 'rgba(0,0,0,0.04)' },
      border: { color: '#E2E0D8' }
    },
    y: {
      ticks: { color: '#9E9C96', font: { size: 10, family: "'Geist Mono', monospace" } },
      grid: { color: 'rgba(0,0,0,0.04)' },
      border: { color: '#E2E0D8' }
    },
  },
};

// 1. Updated BarChart to accept and handle the onClick prop properly in Chart.js
function BarChart({ labels, datasets, height = 160, ariaLabel, onClick }) {
  const ref = useRef(null);
  const inst = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    inst.current?.destroy();

    inst.current = new Chart(ref.current, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        ...CHART_OPTS,
        // Chart.js native click handler hook
        onClick: (event, elements) => {
          if (onClick && elements && elements.length > 0) {
            onClick(event, elements);
          }
        }
      }
    });

    return () => inst.current?.destroy();
  }, [labels, datasets, onClick]); // Added onClick to dependency array

  return (
    <div style={{ position: 'relative', height }}>
      <canvas ref={ref} role="img" aria-label={ariaLabel} />
    </div>
  );
}

// 2. Main Charts component accepting a callback prop from your page view
export default function Charts({ birthYearData, metrics, onBirthYearSelect }) {
  return (
    <div className={styles.row}>
      <div className={styles.card}>
        <div className={styles.title}>Players by birth year</div>
        <BarChart
          labels={birthYearData.map(d => d.year?.toString() ?? '')}
          datasets={[{
            label: 'Players',
            data: birthYearData.map(d => d.count ?? 0),
            backgroundColor: '#E8431A',
            borderRadius: 3,
            hoverBackgroundColor: '#C8360F'
          }]}
          ariaLabel="Players by birth year"
          onClick={(event, elements) => {
            const index = elements[0].index;
            const selectedYear = birthYearData[index]?.year;
            if (selectedYear && onBirthYearSelect) {
              onBirthYearSelect(selectedYear);
            }
          }}
        />
      </div>

      <div className={styles.card}>
        <div className={styles.title}>Goalies vs skaters</div>
        <BarChart
          labels={['Goalies', 'Skaters']}
          datasets={[{
            label: 'Count',
            data: [metrics.goalies ?? 0, metrics.skaters ?? 0],
            backgroundColor: ['#0D7C6B', '#1B5FA8'],
            borderRadius: 3
          }]}
          ariaLabel="Goalies vs skaters"
        />
      </div>
    </div>
  );
}

import ReactApexChart from 'react-apexcharts';

const COLOR_BY_LEVEL = (val) => {
  if (val >= 85) return '#DC2626';
  if (val >= 65) return '#F59E0B';
  return '#0E9F6E';
};

export default function GaugeChart({ value = 0, label, height = 180 }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  const color = COLOR_BY_LEVEL(safe);

  const options = {
    chart: { type: 'radialBar', sparkline: { enabled: true } },
    plotOptions: {
      radialBar: {
        startAngle: -120,
        endAngle: 120,
        hollow: { size: '64%' },
        track: { background: '#F1F5F9', strokeWidth: '100%', margin: 0 },
        dataLabels: {
          name: { show: true, offsetY: 24, color: '#64748B', fontSize: '12px', fontWeight: 500 },
          value: { offsetY: -8, color: '#0F172A', fontSize: '24px', fontWeight: 700, formatter: (v) => `${v}%` }
        }
      }
    },
    fill: {
      type: 'gradient',
      gradient: { shade: 'light', type: 'horizontal', gradientToColors: [color], stops: [0, 100] }
    },
    colors: [color],
    stroke: { lineCap: 'round' },
    labels: [label || 'Usage']
  };

  return (
    <ReactApexChart
      options={options}
      series={[Number(safe.toFixed(1))]}
      type="radialBar"
      height={height}
    />
  );
}

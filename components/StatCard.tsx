interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: string;
  color?: string;
}

export default function StatCard({ label, value, sub, icon, color = 'bg-white' }: StatCardProps) {
  return (
    <div className={`${color} rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-1`}>
      {icon && <span className="text-2xl">{icon}</span>}
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm font-medium text-gray-500">{label}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

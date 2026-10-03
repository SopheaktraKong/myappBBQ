import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import SizedChart from "@/lib/SizedChart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";
import { TrendingUp, ShoppingBag, DollarSign, Award } from "lucide-react";

function fmt(n) { return `$${(n || 0).toFixed(2)}`; }

export default function AdminDashboard() {
  const [days, setDays] = useState("7");
  const [data, setData] = useState({ revenue: 0, order_count: 0, payment_count: 0, top_items: [], daily: [] });

  useEffect(() => {
    api.get(`/dashboard/summary?days=${days}`).then((r) => setData(r.data));
  }, [days]);

  const cards = [
    { label: "Revenue", value: fmt(data.revenue), Icon: DollarSign, tint: "bg-red-50 text-[color:var(--chili)]" },
    { label: "Orders", value: data.order_count, Icon: ShoppingBag, tint: "bg-amber-50 text-amber-700" },
    { label: "Payments", value: data.payment_count, Icon: TrendingUp, tint: "bg-emerald-50 text-emerald-700" },
    { label: "Top Item", value: data.top_items[0]?.name || "—", Icon: Award, tint: "bg-neutral-100 text-neutral-800" },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-5 sm:mb-6 gap-3">
        <div className="min-w-0">
          <p className="uppercase text-xs tracking-[0.24em] font-bold text-neutral-500">Overview</p>
          <h1 className="font-display font-black text-3xl sm:text-4xl">Dashboard</h1>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger data-testid="dashboard-range" className="w-40 pill"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Today</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl p-5 border border-black/5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.tint}`}><c.Icon className="w-5 h-5" /></div>
            <div className="mt-3 text-xs uppercase tracking-widest font-bold text-neutral-500">{c.label}</div>
            <div className="font-display font-black text-2xl mt-1 truncate">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <div className="bg-white rounded-2xl p-5 border border-black/5">
          <h3 className="font-display font-bold text-lg mb-3">Revenue by day</h3>
          <SizedChart height={256}>
            {({ width, height }) => (
              <LineChart width={width} height={height} data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#D9381E" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            )}
          </SizedChart>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-black/5">
          <h3 className="font-display font-bold text-lg mb-3">Top items</h3>
          <SizedChart height={256}>
            {({ width, height }) => (
              <BarChart width={width} height={height} data={data.top_items.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="qty" fill="#F2A900" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </SizedChart>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { getDashboard, getAnalytics } from '../../api/admin';
import { formatPrice } from '../../utils/formatPrice';
import { Users, ShoppingBag, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import {
  ComposedChart, Area, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const STATUS_MAP = {
  pending:          { text: 'Chờ xác nhận',  color: 'bg-yellow-100 text-yellow-700' },
  confirmed:        { text: 'Đã xác nhận',   color: 'bg-blue-100 text-blue-700' },
  preparing:        { text: 'Đang chuẩn bị', color: 'bg-purple-100 text-purple-700' },
  shipping:         { text: 'Đang giao',      color: 'bg-orange-100 text-orange-700' },
  delivered:        { text: 'Đã giao',        color: 'bg-green-100 text-green-700' },
  cancelled:        { text: 'Đã hủy',         color: 'bg-red-100 text-red-600' },
  return_requested: { text: 'Yêu cầu trả',   color: 'bg-pink-100 text-pink-700' },
  returned:         { text: 'Đã trả',         color: 'bg-gray-100 text-gray-600' },
};

const PERIODS = [
  { key: 'day',   label: '30 ngày' },
  { key: 'week',  label: '12 tuần' },
  { key: 'month', label: '12 tháng' },
];

function formatLabel(id, period) {
  if (period === 'week') {
    const m = id.match(/W(\d+)/);
    return m ? `T${parseInt(m[1], 10)}` : id;
  }
  if (period === 'month') {
    const [, mo] = id.split('-');
    return `T${parseInt(mo, 10)}`;
  }
  const [, mo, d] = id.split('-');
  return `${d}/${mo}`;
}

export default function DashboardPage() {
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState('');
  const [period, setPeriod]           = useState('day');
  const [analytics, setAnalytics]     = useState(null);
  const [analyticsLoading, setAL]     = useState(true);

  useEffect(() => {
    getDashboard()
      .then((res) => setData(res.data.data))
      .catch((err) => setFetchError(err.response?.data?.message || 'Không thể tải dashboard'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setAL(true);
    getAnalytics(period)
      .then((res) => setAnalytics(res.data.data))
      .catch(() => setAnalytics(null))
      .finally(() => setAL(false));
  }, [period]);

  if (loading)    return <div className="p-8 text-gray-400">Đang tải...</div>;
  if (fetchError) return <div className="p-8 text-red-500">{fetchError}</div>;
  if (!data)      return <div className="p-8 text-red-500">Không thể tải dữ liệu</div>;

  const { stats, thisMonth, revenueGrowth, recentOrders } = data;

  const STAT_CARDS = [
    { label: 'Doanh thu tháng này', value: formatPrice(thisMonth.revenue), icon: TrendingUp,  color: 'text-green-600',  bg: 'bg-green-50',  growth: revenueGrowth },
    { label: 'Đơn hàng tháng này',  value: thisMonth.orders,               icon: ShoppingBag, color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Tổng người dùng',      value: stats.totalUsers,               icon: Users,       color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Đơn chờ xử lý',        value: stats.pendingOrders,            icon: Clock,       color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  const chartData = (analytics?.revenueData || []).map((d) => ({
    label: formatLabel(d._id, period),
    revenue: d.revenue,
    orders: d.orders,
  }));

  const topProducts = analytics?.topProducts || [];
  const maxRevenue  = topProducts[0]?.revenue || 1;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Tổng quan hoạt động kinh doanh</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">{s.label}</p>
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon size={18} className={s.color} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{s.value}</p>
            {s.growth !== undefined && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${s.growth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {s.growth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(s.growth)}% so với tháng trước
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Revenue chart + period tabs */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Biểu đồ doanh thu</h3>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === p.key
                    ? 'bg-white text-red-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {analyticsLoading ? (
          <div className="h-56 flex items-center justify-center text-gray-400 text-sm">Đang tải...</div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#E53E3E" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#E53E3E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                interval={0}
                tick={{ fontSize: period === 'day' ? 10 : 11, angle: period === 'day' ? -45 : 0, textAnchor: period === 'day' ? 'end' : 'middle' }}
                height={period === 'day' ? 52 : 30}
              />
              <YAxis
                yAxisId="rev"
                orientation="left"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => (v / 1e6).toFixed(0) + 'M'}
                width={48}
              />
              <YAxis
                yAxisId="ord"
                orientation="right"
                tick={{ fontSize: 11 }}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                formatter={(value, name) =>
                  name === 'revenue'
                    ? [formatPrice(value), 'Doanh thu']
                    : [value + ' đơn', 'Đơn hàng']
                }
              />
              <Legend
                formatter={(name) => name === 'revenue' ? 'Doanh thu' : 'Đơn hàng'}
                wrapperStyle={{ fontSize: 12 }}
              />
              <Area
                yAxisId="rev"
                type="monotone"
                dataKey="revenue"
                stroke="#E53E3E"
                strokeWidth={2}
                fill="url(#revGrad)"
                dot={false}
              />
              <Bar
                yAxisId="ord"
                dataKey="orders"
                fill="#3B82F6"
                opacity={0.65}
                radius={[3, 3, 0, 0]}
                maxBarSize={18}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top sản phẩm theo doanh thu */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800">Sản phẩm bán chạy nhất</h3>
          <p className="text-xs text-gray-400 mb-4">Xếp hạng theo doanh thu tích lũy</p>

          {analyticsLoading ? (
            <div className="text-sm text-gray-400 py-8 text-center">Đang tải...</div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p._id} className="flex items-center gap-3">
                  <span className={`w-5 text-xs font-bold text-center shrink-0 ${i < 3 ? 'text-red-500' : 'text-gray-400'}`}>
                    #{i + 1}
                  </span>
                  <img
                    src={p.images?.[0] || 'https://placehold.co/40x40'}
                    alt={p.name}
                    className="w-9 h-9 object-cover rounded-lg shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-red-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.round((p.revenue / maxRevenue) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 w-14 text-right">
                        {p.sold?.toLocaleString()} chiếc
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-red-600 shrink-0 w-24 text-right">
                    {formatPrice(p.revenue)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Đơn hàng gần đây */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Đơn hàng gần đây</h3>
          <div className="space-y-3">
            {recentOrders.map((o) => (
              <div key={o._id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{o.orderCode}</p>
                  <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString('vi-VN')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_MAP[o.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_MAP[o.status]?.text || o.status}
                  </span>
                  <span className="text-sm font-bold text-red-600">{formatPrice(o.totalPrice)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

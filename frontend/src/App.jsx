import React, { useState, useEffect } from 'react';
import './index.css';
import {
  fetchFilters, fetchKPIs, fetchSalesTrend, fetchSalesByProduct,
  fetchSalesByCountry, fetchSalesBySegment, fetchDiscountImpact,
  fetchSalesVsForecast, fetchRecords
} from './api';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import { DollarSign, TrendingUp, Package, Percent, FileText } from 'lucide-react';
import ChatWidget from './ChatWidget';
import InsightsPanel from './InsightsPanel';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
const formatNumber = (val) => new Intl.NumberFormat('en-US').format(val);

function App() {
  const [filtersData, setFiltersData] = useState({
    Year: [], 'Month Name': [], Product: [], Segment: [], Country: [], 'Discount Band': []
  });

  const [selectedFilters, setSelectedFilters] = useState({
    year: '', month: '', product: '', segment: '', country: '', discount_band: ''
  });

  const [kpis, setKpis] = useState(null);
  const [salesTrend, setSalesTrend] = useState([]);
  const [salesByProduct, setSalesByProduct] = useState([]);
  const [salesByCountry, setSalesByCountry] = useState([]);
  const [salesBySegment, setSalesBySegment] = useState([]);
  const [discountImpact, setDiscountImpact] = useState([]);
  const [salesVsForecast, setSalesVsForecast] = useState([]);
  const [recordsData, setRecordsData] = useState({ data: [], page: 1, total_pages: 1 });

  const [loading, setLoading] = useState(true);
  const [filtersError, setFiltersError] = useState(false);

  // Load Filters on mount
  useEffect(() => {
    fetchFilters()
      .then(data => {
        setFiltersData(data);
        setFiltersError(false);
      })
      .catch(err => {
        console.error("Failed to load filters:", err);
        setFiltersError(true);
      });
  }, []);

  // Fetch dashboard data when filters change
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchKPIs(selectedFilters),
      fetchSalesTrend(selectedFilters),
      fetchSalesByProduct(selectedFilters),
      fetchSalesByCountry(selectedFilters),
      fetchSalesBySegment(selectedFilters),
      fetchDiscountImpact(selectedFilters),
      fetchSalesVsForecast(selectedFilters),
      fetchRecords(selectedFilters, 1, 10)
    ]).then(([kpisData, trend, product, country, segment, discount, forecast, records]) => {
      setKpis(kpisData);
      setSalesTrend(trend);
      setSalesByProduct(product);
      setSalesByCountry(country);
      setSalesBySegment(segment);
      setDiscountImpact(discount);
      setSalesVsForecast(forecast);
      setRecordsData(records);
    }).catch(console.error).finally(() => setLoading(false));
  }, [selectedFilters]);

  const handleFilterChange = (key, value) => {
    setSelectedFilters(prev => ({ ...prev, [key]: value }));
  };

  const handlePageChange = (newPage) => {
    fetchRecords(selectedFilters, newPage, 10).then(data => setRecordsData(data)).catch(console.error);
  };

  const clearFilters = () => {
    setSelectedFilters({ year: '', month: '', product: '', segment: '', country: '', discount_band: '' });
  };

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div>
          <h1 className="page-title">Financial Sales Dashboard</h1>
          <p className="page-subtitle">Interactive analytics and performance metrics</p>
        </div>
        <button onClick={clearFilters} className="btn-clear">
          Clear Filters
        </button>
      </header>

      {/* Filters Error Banner */}
      {filtersError && (
        <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid #f87171' }}>
          <strong>Error:</strong> Could not load filters — is the backend running?
        </div>
      )}

      {/* Slicers */}
      <div className="card slicers-grid">
        {[
          { label: 'Year', key: 'year', options: filtersData.Year },
          { label: 'Month', key: 'month', options: filtersData['Month Name'] },
          { label: 'Product', key: 'product', options: filtersData.Product },
          { label: 'Segment', key: 'segment', options: filtersData.Segment },
          { label: 'Country', key: 'country', options: filtersData.Country },
          { label: 'Discount Band', key: 'discount_band', options: filtersData['Discount Band'] },
        ].map(filter => (
          <div key={filter.key} className="filter-group">
            <label className="filter-label">{filter.label}</label>
            <select
              className="select-input"
              value={selectedFilters[filter.key]}
              onChange={(e) => handleFilterChange(filter.key, e.target.value)}
            >
              <option value="">All</option>
              {filter.options && filter.options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loading-state">Loading Dashboard...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="kpi-grid">
            <KPICard title="Total Sales" value={formatCurrency(kpis?.total_sales || 0)} icon={<DollarSign className="text-blue-500" size={24} />} colorClass="bg-blue-50" />
            <KPICard title="Total Profit" value={formatCurrency(kpis?.total_profit || 0)} icon={<TrendingUp className="text-green-500" size={24} />} colorClass="bg-green-50" />
            <KPICard title="Units Sold" value={formatNumber(kpis?.total_units_sold || 0)} icon={<Package className="text-purple-500" size={24} />} colorClass="bg-purple-50" />
            <KPICard title="Profit Margin" value={`${(kpis?.profit_margin_pct || 0).toFixed(2)}%`} icon={<Percent className="text-yellow-500" size={24} />} colorClass="bg-yellow-50" />
            <KPICard title="Avg Discount" value={`${(kpis?.avg_discount_pct || 0).toFixed(2)}%`} icon={<TrendingUp className="text-red-500" size={24} />} colorClass="bg-red-50" />
          </div>

          {/* Insights */}
          <InsightsPanel filters={selectedFilters} />

          {/* Charts Grid */}
          <div className="charts-grid">
            {/* Trend */}
            <div className="card">
              <h3 className="chart-title">Sales & Profit Trend</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={salesTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="Period" tick={{fontSize: 12}} tickMargin={10} />
                    <YAxis yAxisId="left" tickFormatter={(v) => `$${v/1000}k`} tick={{fontSize: 12}} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `$${v/1000}k`} tick={{fontSize: 12}} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={3} dot={{r: 4}} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Product */}
            <div className="card">
              <h3 className="chart-title">Sales by Product</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesByProduct} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={(v) => `$${v/1000}k`} tick={{fontSize: 12}} />
                    <YAxis dataKey="Product" type="category" width={100} tick={{fontSize: 12}} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="Sales" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Country */}
            <div className="card">
              <h3 className="chart-title">Sales by Country</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesByCountry}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="Country" tick={{fontSize: 12}} />
                    <YAxis tickFormatter={(v) => `$${v/1000}k`} tick={{fontSize: 12}} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="Sales" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Segment */}
            <div className="card pie-chart-card">
              <h3 className="chart-title">Sales Share by Segment</h3>
              <div className="pie-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={salesBySegment} dataKey="Sales" nameKey="Segment" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                      {salesBySegment.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Discount Impact */}
            <div className="card">
              <h3 className="chart-title">Profit by Discount Band</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={discountImpact}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="Discount Band" tick={{fontSize: 12}} />
                    <YAxis tickFormatter={(v) => `$${v/1000}k`} tick={{fontSize: 12}} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sales vs Forecast */}
            <div className="card">
              <h3 className="chart-title">Sales vs Forecast (by Month)</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesVsForecast}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="Month Name" tick={{fontSize: 10}} tickFormatter={(value) => value.slice(0, 3)}/>
                    <YAxis tickFormatter={(v) => `$${v/1000}k`} tick={{fontSize: 12}} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Forecast" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="card card-no-padding">
            <div className="table-header-container">
              <FileText color="#9ca3af" size={20} />
              <h3 className="table-title">Raw Data Records</h3>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Segment</th>
                    <th>Country</th>
                    <th>Product</th>
                    <th>Sales</th>
                    <th>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {recordsData.data.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.Date || '-'}</td>
                      <td>{row.Segment}</td>
                      <td>{row.Country}</td>
                      <td style={{fontWeight: 500}}>{row.Product}</td>
                      <td>{formatCurrency(row.Sales)}</td>
                      <td style={{color: 'var(--secondary)', fontWeight: 500}}>{formatCurrency(row.Profit)}</td>
                    </tr>
                  ))}
                  {recordsData.data.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>No records found matching filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span style={{fontSize: '0.875rem', color: 'var(--text-muted)'}}>
                Page <span style={{fontWeight: 600, color: 'var(--dark)'}}>{recordsData.page}</span> of <span style={{fontWeight: 600, color: 'var(--dark)'}}>{recordsData.total_pages}</span>
              </span>
              <div style={{display: 'flex', gap: '0.5rem'}}>
                <button
                  className="btn-pagination"
                  disabled={recordsData.page <= 1}
                  onClick={() => handlePageChange(recordsData.page - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn-pagination"
                  disabled={recordsData.page >= recordsData.total_pages}
                  onClick={() => handlePageChange(recordsData.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <ChatWidget />
    </div>
  );
}

function KPICard({ title, value, icon, colorClass }) {
  return (
    <div className="card kpi-card">
      <div className={`kpi-icon-wrapper ${colorClass}`}>
        {icon}
      </div>
      <div>
        <h4 className="kpi-title">{title}</h4>
        <p className="kpi-value">{value}</p>
      </div>
    </div>
  );
}

export default App;

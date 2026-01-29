import type { MetricsSnapshot, ReportInsight } from '../../types/index.js';
import type { TrendData } from '../../metrics/index.js';

interface EmailData {
  date: string;
  metrics: MetricsSnapshot;
  insights: ReportInsight[];
  trends: TrendData[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

function formatPercent(pct: number, showSign = true): string {
  const sign = showSign && pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function getChangeColor(change: number): string {
  if (change > 0) return '#10b981'; // green
  if (change < 0) return '#ef4444'; // red
  return '#6b7280'; // gray
}

function getInsightIcon(type: ReportInsight['type']): string {
  switch (type) {
    case 'positive':
      return '&#x2705;'; // Green check
    case 'negative':
      return '&#x26A0;'; // Warning
    case 'alert':
      return '&#x1F6A8;'; // Alert
    default:
      return '&#x2139;'; // Info
  }
}

function getInsightColor(type: ReportInsight['type']): string {
  switch (type) {
    case 'positive':
      return '#dcfce7'; // Light green
    case 'negative':
      return '#fef2f2'; // Light red
    case 'alert':
      return '#fef3c7'; // Light yellow
    default:
      return '#f3f4f6'; // Light gray
  }
}

export function generateEmailHtml(data: EmailData): string {
  const { date, metrics, insights, trends } = data;

  const netProfit = metrics.total_revenue - metrics.total_costs;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Business Report - ${date}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9fafb;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .header p {
      margin: 8px 0 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .section {
      padding: 24px;
      border-bottom: 1px solid #e5e7eb;
    }
    .section:last-child {
      border-bottom: none;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 16px;
      color: #111827;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
    }
    .metric-card {
      background: #f9fafb;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .metric-value {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
    }
    .metric-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }
    .metric-change {
      font-size: 12px;
      margin-top: 4px;
    }
    .insight {
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .insight:last-child {
      margin-bottom: 0;
    }
    .insight-title {
      font-weight: 600;
      margin-bottom: 4px;
    }
    .insight-description {
      font-size: 14px;
      color: #4b5563;
    }
    .app-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .app-table th {
      text-align: left;
      padding: 12px 8px;
      border-bottom: 2px solid #e5e7eb;
      font-weight: 600;
      color: #6b7280;
      font-size: 12px;
      text-transform: uppercase;
    }
    .app-table td {
      padding: 12px 8px;
      border-bottom: 1px solid #f3f4f6;
    }
    .app-table tr:last-child td {
      border-bottom: none;
    }
    .app-name {
      font-weight: 500;
    }
    .provider-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .provider-table th {
      text-align: left;
      padding: 8px;
      border-bottom: 2px solid #e5e7eb;
      font-weight: 600;
      color: #6b7280;
      font-size: 12px;
      text-transform: uppercase;
    }
    .provider-table td {
      padding: 8px;
      border-bottom: 1px solid #f3f4f6;
    }
    .trend-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
      font-size: 14px;
    }
    .trend-date {
      color: #6b7280;
    }
    .footer {
      text-align: center;
      padding: 24px;
      color: #9ca3af;
      font-size: 12px;
    }
    .footer a {
      color: #6366f1;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Daily Business Report</h1>
      <p>${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>

    <!-- Key Metrics -->
    <div class="section">
      <h2 class="section-title">Portfolio Overview</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-value">${formatCurrency(metrics.total_revenue)}</div>
          <div class="metric-label">Revenue</div>
          <div class="metric-change" style="color: ${getChangeColor(metrics.revenue_change_pct)}">
            ${formatPercent(metrics.revenue_change_pct)}
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${formatCurrency(metrics.total_mrr)}</div>
          <div class="metric-label">MRR</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${formatNumber(metrics.total_dau)}</div>
          <div class="metric-label">DAU</div>
          <div class="metric-change" style="color: ${getChangeColor(metrics.dau_change_pct)}">
            ${formatPercent(metrics.dau_change_pct)}
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${formatNumber(metrics.total_installs)}</div>
          <div class="metric-label">Installs</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${formatCurrency(metrics.total_costs)}</div>
          <div class="metric-label">Costs</div>
          <div class="metric-change" style="color: ${getChangeColor(-metrics.costs_change_pct)}">
            ${formatPercent(metrics.costs_change_pct)}
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-value" style="color: ${netProfit >= 0 ? '#10b981' : '#ef4444'}">${formatCurrency(netProfit)}</div>
          <div class="metric-label">Net Profit</div>
        </div>
      </div>
    </div>

    <!-- Insights -->
    ${insights.length > 0 ? `
    <div class="section">
      <h2 class="section-title">Key Insights</h2>
      ${insights.map(insight => `
        <div class="insight" style="background: ${getInsightColor(insight.type)}">
          <div class="insight-title">${getInsightIcon(insight.type)} ${insight.title}</div>
          <div class="insight-description">${insight.description}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- App Performance -->
    <div class="section">
      <h2 class="section-title">App Performance</h2>
      <table class="app-table">
        <thead>
          <tr>
            <th>App</th>
            <th>Revenue</th>
            <th>MRR</th>
            <th>DAU</th>
            <th>Installs</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.apps.map(app => `
            <tr>
              <td class="app-name">${app.app_name}</td>
              <td>
                ${formatCurrency(app.revenue)}
                <span style="color: ${getChangeColor(app.revenue_change_pct)}; font-size: 12px;">
                  ${formatPercent(app.revenue_change_pct)}
                </span>
              </td>
              <td>${formatCurrency(app.mrr)}</td>
              <td>
                ${formatNumber(app.dau)}
                <span style="color: ${getChangeColor(app.dau_change_pct)}; font-size: 12px;">
                  ${formatPercent(app.dau_change_pct)}
                </span>
              </td>
              <td>${formatNumber(app.installs)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Provider Costs -->
    ${metrics.providers.filter(p => p.cost > 0).length > 0 ? `
    <div class="section">
      <h2 class="section-title">Infrastructure Costs</h2>
      <table class="provider-table">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Cost</th>
            <th>Usage</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.providers.filter(p => p.cost > 0).map(provider => `
            <tr>
              <td>${provider.provider_name}</td>
              <td>${formatCurrency(provider.cost)}</td>
              <td>${provider.usage_quantity ? `${formatNumber(provider.usage_quantity)} ${provider.usage_unit || ''}` : '-'}</td>
              <td style="color: ${getChangeColor(-provider.cost_change_pct)}">${formatPercent(provider.cost_change_pct)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- 7-Day Trend -->
    ${trends.length > 0 ? `
    <div class="section">
      <h2 class="section-title">7-Day Revenue Trend</h2>
      ${trends.map(day => `
        <div class="trend-row">
          <span class="trend-date">${day.date}</span>
          <span>${formatCurrency(day.revenue)}</span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="footer">
      <p>Generated by Business Metrics Hub</p>
      <p>
        <a href="#">View Dashboard</a> &bull;
        <a href="#">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
}

export function generateTextEmail(data: EmailData): string {
  const { date, metrics, insights } = data;

  let text = `DAILY BUSINESS REPORT - ${date}\n`;
  text += `${'='.repeat(40)}\n\n`;

  text += `PORTFOLIO OVERVIEW\n`;
  text += `-`.repeat(20) + `\n`;
  text += `Revenue: ${formatCurrency(metrics.total_revenue)} (${formatPercent(metrics.revenue_change_pct)})\n`;
  text += `MRR: ${formatCurrency(metrics.total_mrr)}\n`;
  text += `DAU: ${formatNumber(metrics.total_dau)} (${formatPercent(metrics.dau_change_pct)})\n`;
  text += `Installs: ${formatNumber(metrics.total_installs)}\n`;
  text += `Costs: ${formatCurrency(metrics.total_costs)}\n`;
  text += `Net Profit: ${formatCurrency(metrics.total_revenue - metrics.total_costs)}\n\n`;

  if (insights.length > 0) {
    text += `KEY INSIGHTS\n`;
    text += `-`.repeat(20) + `\n`;
    for (const insight of insights) {
      text += `* ${insight.title}: ${insight.description}\n`;
    }
    text += `\n`;
  }

  text += `APP PERFORMANCE\n`;
  text += `-`.repeat(20) + `\n`;
  for (const app of metrics.apps) {
    text += `${app.app_name}\n`;
    text += `  Revenue: ${formatCurrency(app.revenue)} | DAU: ${formatNumber(app.dau)} | Installs: ${formatNumber(app.installs)}\n`;
  }

  return text;
}

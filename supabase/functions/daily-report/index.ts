// Supabase Edge Function for daily report generation and delivery
// Deploy with: supabase functions deploy daily-report

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetricsSnapshot {
  total_revenue: number;
  total_mrr: number;
  total_dau: number;
  total_installs: number;
  total_costs: number;
  revenue_change_pct: number;
  dau_change_pct: number;
  costs_change_pct: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get target date
    const url = new URL(req.url);
    const dateParam = url.searchParams.get('date');

    const date = dateParam
      ? new Date(dateParam + 'T00:00:00Z')
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          d.setHours(0, 0, 0, 0);
          return d;
        })();

    const dateStr = date.toISOString().split('T')[0]!;
    console.log(`Generating report for ${dateStr}`);

    // Get previous day for comparison
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0]!;

    // Fetch metrics for both days
    const [
      { data: currentRevenue },
      { data: prevRevenue },
      { data: currentUsers },
      { data: prevUsers },
      { data: currentInstalls },
      { data: currentSubs },
      { data: currentCosts },
      { data: prevCosts },
    ] = await Promise.all([
      supabase.from('daily_revenue').select('*').eq('date', dateStr),
      supabase.from('daily_revenue').select('*').eq('date', prevDateStr),
      supabase.from('daily_active_users').select('*').eq('date', dateStr).eq('platform', 'all'),
      supabase.from('daily_active_users').select('*').eq('date', prevDateStr).eq('platform', 'all'),
      supabase.from('daily_installs').select('*').eq('date', dateStr),
      supabase.from('daily_subscriptions').select('*').eq('date', dateStr),
      supabase.from('daily_provider_costs').select('*').eq('date', dateStr),
      supabase.from('daily_provider_costs').select('*').eq('date', prevDateStr),
    ]);

    // Calculate totals
    const totalRevenue = (currentRevenue || []).reduce((sum, r) => sum + (r.net_revenue || 0), 0);
    const prevTotalRevenue = (prevRevenue || []).reduce((sum, r) => sum + (r.net_revenue || 0), 0);

    const totalDau = (currentUsers || []).reduce((sum, u) => sum + (u.dau || 0), 0);
    const prevTotalDau = (prevUsers || []).reduce((sum, u) => sum + (u.dau || 0), 0);

    const totalInstalls = (currentInstalls || []).reduce((sum, i) => sum + (i.installs || 0), 0);
    const totalMrr = (currentSubs || []).reduce((sum, s) => sum + (s.mrr || 0), 0);

    const totalCosts = (currentCosts || []).reduce((sum, c) => sum + (c.cost || 0), 0);
    const prevTotalCosts = (prevCosts || []).reduce((sum, c) => sum + (c.cost || 0), 0);

    const metrics: MetricsSnapshot = {
      total_revenue: totalRevenue,
      total_mrr: totalMrr,
      total_dau: totalDau,
      total_installs: totalInstalls,
      total_costs: totalCosts,
      revenue_change_pct: prevTotalRevenue > 0
        ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100
        : 0,
      dau_change_pct: prevTotalDau > 0
        ? ((totalDau - prevTotalDau) / prevTotalDau) * 100
        : 0,
      costs_change_pct: prevTotalCosts > 0
        ? ((totalCosts - prevTotalCosts) / prevTotalCosts) * 100
        : 0,
    };

    // Generate simple insights
    const insights = [];

    if (metrics.revenue_change_pct !== 0) {
      insights.push({
        type: metrics.revenue_change_pct > 0 ? 'positive' : 'negative',
        category: 'revenue',
        title: metrics.revenue_change_pct > 0 ? 'Revenue Up' : 'Revenue Down',
        description: `Revenue ${metrics.revenue_change_pct > 0 ? 'increased' : 'decreased'} by ${Math.abs(metrics.revenue_change_pct).toFixed(1)}%`,
      });
    }

    if (metrics.dau_change_pct !== 0) {
      insights.push({
        type: metrics.dau_change_pct > 0 ? 'positive' : 'negative',
        category: 'users',
        title: metrics.dau_change_pct > 0 ? 'DAU Growing' : 'DAU Declining',
        description: `Daily active users ${metrics.dau_change_pct > 0 ? 'grew' : 'dropped'} by ${Math.abs(metrics.dau_change_pct).toFixed(1)}%`,
      });
    }

    // Save report
    await supabase.from('daily_reports').upsert({
      date: dateStr,
      report_type: 'daily',
      summary_text: insights.map((i) => `${i.title}: ${i.description}`).join('\n'),
      insights,
      metrics_snapshot: metrics,
    }, {
      onConflict: 'date,report_type',
    });

    // Send email if Resend is configured
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const emailTo = Deno.env.get('REPORT_EMAIL_TO');

    if (resendApiKey && emailTo) {
      const emailHtml = generateEmailHtml(dateStr, metrics, insights);

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: Deno.env.get('REPORT_EMAIL_FROM') || 'reports@example.com',
          to: emailTo.split(','),
          subject: `Daily Business Report - ${dateStr}`,
          html: emailHtml,
        }),
      });

      if (emailResponse.ok) {
        // Update report with email sent time
        await supabase
          .from('daily_reports')
          .update({
            email_sent_at: new Date().toISOString(),
            email_recipients: emailTo.split(','),
          })
          .eq('date', dateStr)
          .eq('report_type', 'daily');

        console.log('Report email sent successfully');
      } else {
        console.error('Failed to send email:', await emailResponse.text());
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: dateStr,
        metrics,
        insights,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Report generation error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateEmailHtml(date: string, metrics: MetricsSnapshot, insights: any[]): string {
  const formatCurrency = (n: number) => `$${n.toFixed(2)}`;
  const formatPercent = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .metric { display: inline-block; width: 45%; margin: 10px 2%; text-align: center; background: white; padding: 15px; border-radius: 8px; }
    .metric-value { font-size: 24px; font-weight: bold; }
    .metric-label { color: #6b7280; font-size: 12px; }
    .insight { background: white; padding: 12px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #6366f1; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Daily Business Report</h1>
    <p>${date}</p>
  </div>
  <div class="content">
    <div class="metric">
      <div class="metric-value">${formatCurrency(metrics.total_revenue)}</div>
      <div class="metric-label">REVENUE (${formatPercent(metrics.revenue_change_pct)})</div>
    </div>
    <div class="metric">
      <div class="metric-value">${formatCurrency(metrics.total_mrr)}</div>
      <div class="metric-label">MRR</div>
    </div>
    <div class="metric">
      <div class="metric-value">${metrics.total_dau.toLocaleString()}</div>
      <div class="metric-label">DAU (${formatPercent(metrics.dau_change_pct)})</div>
    </div>
    <div class="metric">
      <div class="metric-value">${formatCurrency(metrics.total_costs)}</div>
      <div class="metric-label">COSTS (${formatPercent(metrics.costs_change_pct)})</div>
    </div>

    <h3>Key Insights</h3>
    ${insights.map((i) => `<div class="insight"><strong>${i.title}</strong>: ${i.description}</div>`).join('')}

    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
      Business Metrics Hub
    </p>
  </div>
</body>
</html>
`;
}

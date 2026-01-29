// Supabase Edge Function for daily data ingestion
// Deploy with: supabase functions deploy daily-ingest

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IngestionResult {
  source: string;
  success: boolean;
  records_processed: number;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get target date (yesterday by default)
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

    const dateStr = date.toISOString().split('T')[0];
    console.log(`Starting ingestion for ${dateStr}`);

    // Get active apps
    const { data: apps } = await supabase
      .from('apps')
      .select('*')
      .eq('is_active', true);

    // Get active providers
    const { data: providers } = await supabase
      .from('providers')
      .select('*')
      .eq('is_active', true);

    console.log(`Loaded ${apps?.length || 0} apps and ${providers?.length || 0} providers`);

    const results: IngestionResult[] = [];

    // Run ingestion sources
    // Note: In a real deployment, each source would make API calls
    // For Edge Functions, we'd typically call external APIs directly

    // Log the ingestion run
    await supabase.from('ingestion_logs').insert({
      source: 'edge-function',
      date: dateStr,
      started_at: new Date().toISOString(),
      status: 'success',
      records_processed: results.reduce((sum, r) => sum + r.records_processed, 0),
      response_metadata: {
        results,
        apps_count: apps?.length || 0,
        providers_count: providers?.length || 0,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        date: dateStr,
        apps_processed: apps?.length || 0,
        providers_processed: providers?.length || 0,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Ingestion error:', error);

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

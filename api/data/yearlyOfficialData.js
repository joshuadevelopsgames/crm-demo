import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * API endpoint for yearly official LMN data
 * Serves data from Supabase table (if exists) or JSON file (fallback)
 */

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://lecrm-dev.vercel.app',
    'https://lecrm-stg.vercel.app',
    'https://lecrm.vercel.app'
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { year } = req.query;

      // Try to get data from Supabase first
      let useSupabase = false;
      let yearlyData = {};
      let availableYears = [];

      try {
        const supabase = getSupabase();
        
        // Check if table exists by trying to query it
        const { data: testData, error: testError } = await supabase
          .from('yearly_official_estimates')
          .select('source_year')
          .limit(1);

        if (!testError && testData !== null) {
          // Table exists, use Supabase
          useSupabase = true;

          if (year) {
            // Get data for specific year
            const yearInt = parseInt(year);
            const { data, error } = await supabase
              .from('yearly_official_estimates')
              .select('*')
              .eq('source_year', yearInt)
              .order('estimate_close_date', { ascending: false });

            if (error) throw error;

            return res.status(200).json({
              success: true,
              data: data || [],
              year: yearInt,
              count: data?.length || 0,
              source: 'supabase',
              availableYears: await getAvailableYears(supabase)
            });
          } else {
            // Get all years
            const { data: allData, error } = await supabase
              .from('yearly_official_estimates')
              .select('*')
              .order('source_year', { ascending: false })
              .order('estimate_close_date', { ascending: false });

            if (error) throw error;

            // Group by year
            const grouped = {};
            allData.forEach(est => {
              const year = est.source_year;
              if (!grouped[year]) grouped[year] = [];
              grouped[year].push(est);
            });

            availableYears = Object.keys(grouped).map(y => parseInt(y)).sort();
            const summary = {};
            
            Object.keys(grouped).forEach(year => {
              const yearData = grouped[year];
              const sold = yearData.filter(e => {
                const status = (e.status || '').toLowerCase();
                return status.includes('sold') || 
                       status === 'contract signed' ||
                       status === 'work complete' ||
                       status === 'billing complete';
              });
              const soldDollar = sold.reduce((sum, e) => sum + (parseFloat(e.total_price) || 0), 0);
              
              summary[year] = {
                total: yearData.length,
                sold: sold.length,
                soldDollar: soldDollar
              };
            });

            return res.status(200).json({
              success: true,
              data: grouped,
              summary,
              availableYears,
              source: 'supabase',
              message: 'Yearly official data loaded from Supabase'
            });
          }
        }
      } catch (supabaseError) {
        // Table doesn't exist or error, fall back to JSON file
        console.log('Supabase table not available, using JSON file:', supabaseError.message);
      }

      // Fallback: Read from JSON file
      const dataPath = join(process.cwd(), 'yearly_official_data.json');
      
      if (!existsSync(dataPath)) {
        return res.status(200).json({
          success: true,
          data: {},
          availableYears: [],
          source: 'none',
          message: 'No yearly official data available yet'
        });
      }

      yearlyData = JSON.parse(readFileSync(dataPath, 'utf-8'));
      availableYears = Object.keys(yearlyData).map(y => parseInt(y)).sort();

      // If year is specified, return only that year's data
      if (year) {
        const yearInt = parseInt(year);
        const yearData = yearlyData[yearInt] || [];
        
        return res.status(200).json({
          success: true,
          data: yearData,
          year: yearInt,
          count: yearData.length,
          source: 'json',
          availableYears
        });
      }

      // Return all years
      const summary = {};
      
      Object.keys(yearlyData).forEach(year => {
        const yearData = yearlyData[year];
        const sold = yearData.filter(e => {
          const status = (e.status || '').toLowerCase();
          return status.includes('sold') || 
                 status === 'contract signed' ||
                 status === 'work complete' ||
                 status === 'billing complete';
        });
        const soldDollar = sold.reduce((sum, e) => sum + (e.total_price || 0), 0);
        
        summary[year] = {
          total: yearData.length,
          sold: sold.length,
          soldDollar: soldDollar
        };
      });

      return res.status(200).json({
        success: true,
        data: yearlyData,
        summary,
        availableYears,
        source: 'json',
        message: 'Yearly official data loaded from JSON file'
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

// Helper function to get available years from Supabase
async function getAvailableYears(supabase) {
  try {
    const { data, error } = await supabase
      .from('yearly_official_estimates')
      .select('source_year')
      .order('source_year', { ascending: false });

    if (error) throw error;

    const years = [...new Set(data.map(d => d.source_year))].sort((a, b) => b - a);
    return years;
  } catch (error) {
    console.error('Error getting available years:', error);
    return [];
  }
}


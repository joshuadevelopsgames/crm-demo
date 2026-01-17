/**
 * API endpoint for storing and retrieving scorecard templates
 * Data is stored in Supabase database with versioning support
 */

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export default async function handler(req, res) {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://crm-demo.vercel.app',
    'https://crm-demo.vercel.app',
    'https://crm-demo.vercel.app'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    
    if (req.method === 'GET') {
      // Get all templates, optionally filtered by is_default or is_current_version
      const { is_default, is_current, include_versions } = req.query;
      
      let query = supabase
        .from('scorecard_templates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (is_default === 'true') {
        query = query.eq('is_default', true);
      }
      
      if (is_current === 'true') {
        query = query.eq('is_current_version', true);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }
      
      // If not including versions, only return current versions
      if (include_versions !== 'true') {
        const currentVersions = data.filter(t => t.is_current_version);
        return res.status(200).json({
          success: true,
          data: currentVersions,
          count: currentVersions.length
        });
      }
      
      return res.status(200).json({
        success: true,
        data: data || [],
        count: data?.length || 0
      });
    }
    
    if (req.method === 'POST') {
      const { action, data } = req.body;
      
      if (action === 'create') {
        // Create new template
        // Remove 'sections' field as it's not in the database schema
        const { sections, ...templateDataWithoutSections } = data;
        const templateData = {
          ...templateDataWithoutSections,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { data: created, error } = await supabase
          .from('scorecard_templates')
          .insert(templateData)
          .select()
          .single();
        
        if (error) {
          console.error('Supabase error:', error);
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
        
        return res.status(201).json({
          success: true,
          data: created
        });
      }
      
      if (action === 'update_with_version') {
        // Update template by creating a new version
        const { templateId, templateData } = data;
        
        // First, get the current template
        const { data: currentTemplate, error: fetchError } = await supabase
          .from('scorecard_templates')
          .select('*')
          .eq('id', templateId)
          .eq('is_current_version', true)
          .single();
        
        if (fetchError || !currentTemplate) {
          return res.status(404).json({
            success: false,
            error: 'Template not found'
          });
        }
        
        // Mark old version as not current
        await supabase
          .from('scorecard_templates')
          .update({ is_current_version: false })
          .eq('id', templateId);
        
        // Create new version
        // Remove 'sections' field as it's not in the database schema
        const { sections, ...templateDataWithoutSections } = templateData;
        const newVersionNumber = (currentTemplate.version_number || 1) + 1;
        const parentId = currentTemplate.parent_template_id || currentTemplate.id;
        
        const newVersion = {
          ...templateDataWithoutSections,
          name: currentTemplate.name, // Keep same name
          is_default: currentTemplate.is_default,
          version_number: newVersionNumber,
          is_current_version: true,
          parent_template_id: parentId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { data: created, error: createError } = await supabase
          .from('scorecard_templates')
          .insert(newVersion)
          .select()
          .single();
        
        if (createError) {
          console.error('Supabase error:', createError);
          return res.status(500).json({
            success: false,
            error: createError.message
          });
        }
        
        return res.status(201).json({
          success: true,
          data: created,
          previous_version: currentTemplate
        });
      }
      
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use "create" or "update_with_version"'
      });
    }
    
    if (req.method === 'PUT') {
      // Update template (simple update, no versioning)
      const { id, sections, ...updateDataWithoutSections } = req.body;
      // Remove 'sections' field as it's not in the database schema
      updateDataWithoutSections.updated_at = new Date().toISOString();
      
      const { data: updated, error } = await supabase
        .from('scorecard_templates')
        .update(updateDataWithoutSections)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: 'Template not found'
          });
        }
        console.error('Supabase error:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }
      
      return res.status(200).json({
        success: true,
        data: updated
      });
    }
    
    if (req.method === 'DELETE') {
      // Delete template by ID
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID is required'
        });
      }
      
      const { error } = await supabase
        .from('scorecard_templates')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Template deleted successfully'
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


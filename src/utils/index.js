/**
 * Utility function to create page URLs for routing
 * @param {string} pageName - Name of the page (e.g., 'Dashboard', 'AccountDetail?id=123')
 * @returns {string} - Formatted URL path
 */
export function createPageUrl(pageName) {
  // Split page name and query string
  const [page, queryString] = pageName.split('?');
  
  // Convert page name to kebab-case for URLs
  const kebabCase = page.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
  
  // Append query string if it exists
  return queryString ? `/${kebabCase}?${queryString}` : `/${kebabCase}`;
}






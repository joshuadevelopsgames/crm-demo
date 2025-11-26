/**
 * Utility function to create page URLs for routing
 * @param {string} pageName - Name of the page (e.g., 'Dashboard', 'AccountDetail')
 * @returns {string} - Formatted URL path
 */
export function createPageUrl(pageName) {
  // Convert page names to kebab-case for URLs
  const kebabCase = pageName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
  return `/${kebabCase}`;
}






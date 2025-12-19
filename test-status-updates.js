// Quick test for status updates
function mapStatus(status, pipelineStatus) {
  const pipeline = (pipelineStatus || '').toLowerCase();
  if (pipeline === 'sold') return 'won';
  if (pipeline === 'lost') return 'lost';
  if (pipeline === 'pending') return 'lost';
  
  const stat = (status || '').toLowerCase().trim();
  
  // Explicit Won statuses
  if (
    stat === 'email contract award' ||
    stat === 'verbal contract award' ||
    stat === 'work complete' ||
    stat === 'work in progress' ||
    stat === 'billing complete' ||
    stat === 'contract signed' ||
    stat === 'contract awarded' ||
    stat === 'proposal accepted' ||
    stat === 'quote accepted' ||
    stat === 'estimate accepted' ||
    stat === 'approved' ||
    stat === 'completed' ||
    stat.includes('email contract award') ||
    stat.includes('verbal contract award') ||
    stat.includes('work complete') ||
    stat.includes('billing complete') ||
    stat.includes('contract signed') ||
    stat.includes('contract awarded') ||
    stat.includes('proposal accepted') ||
    stat.includes('quote accepted') ||
    stat.includes('estimate accepted') ||
    (stat.includes('accepted') && !stat.includes('rejected')) ||
    (stat === 'approved' || stat.includes('approved')) ||
    (stat === 'completed' || stat.includes('completed'))
  ) {
    if (stat.includes('contract signed') && stat.includes('pending')) {
      return 'lost';
    }
    return 'won';
  }
  
  // Explicit Lost statuses
  if (
    stat === 'estimate in progress - lost' ||
    stat === 'review + approve - lost' ||
    stat === 'client proposal phase - lost' ||
    stat === 'estimate lost' ||
    stat === 'estimate on hold' ||
    stat === 'estimate lost - no reply' ||
    stat === 'estimate lost - price too high' ||
    stat.includes('estimate in progress - lost') ||
    stat.includes('review + approve - lost') ||
    stat.includes('client proposal phase - lost') ||
    stat.includes('estimate lost - no reply') ||
    stat.includes('estimate lost - price too high') ||
    stat.includes('estimate on hold')
  ) {
    return 'lost';
  }
  
  // Pattern-based Won
  if (
    stat.includes('contract signed') ||
    stat.includes('contract award') ||
    stat.includes('sold') ||
    stat.includes('email contract') ||
    stat.includes('verbal contract') ||
    stat.includes('work complete') ||
    stat.includes('billing complete')
  ) {
    return 'won';
  }
  
  // Pattern-based Lost
  if (
    stat.includes('estimate lost') ||
    stat.includes('lost') ||
    stat.includes('on hold')
  ) {
    return 'lost';
  }
  
  if (
    stat.includes('in progress') ||
    stat.includes('pending') ||
    stat === ''
  ) {
    return 'lost';
  }
  
  return 'lost';
}

console.log('Testing new status handling:\n');
console.log('Proposal Accepted:', mapStatus('Proposal Accepted', ''));
console.log('Quote Accepted:', mapStatus('Quote Accepted', ''));
console.log('Estimate Accepted:', mapStatus('Estimate Accepted', ''));
console.log('Approved:', mapStatus('Approved', ''));
console.log('Completed:', mapStatus('Completed', ''));
console.log('Contract Signed - Pending:', mapStatus('Contract Signed - Pending', ''));
console.log('Contract Awarded:', mapStatus('Contract Awarded', ''));

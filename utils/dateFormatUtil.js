// formats needed
// TIME
    // 7:00 PM
        // convert from timestamp
        // automatically do AM or PM during conversion
export function formatTime(isoString) {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

//DATE
    // Friday, Jul 17
    // Friday, Jul 17 · 7:00 PM -> will be formatted in component
        // Day, Short month Short Day · Call Time formatter
export function formatEventDate(isoString) {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });
}

// July 16
        // Month Day
export function formatMonthDay(isoString) {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  });
}
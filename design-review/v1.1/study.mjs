document.querySelectorAll('.court-record details').forEach(details => {
  details.addEventListener('toggle', () => {
    details.querySelector('summary>span:last-child').textContent = details.open ? '−' : '+';
  });
});

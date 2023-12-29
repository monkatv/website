$(document).ready(function() {
  let prefers = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  let html = document.querySelector('html');

  html.classList.add(prefers);
  html.setAttribute('data-bs-theme', prefers);

  $('h3#bttv-emotes-statistics+table').dataTable( {
    "autoWidth": true,
    "pageLength": 50,
    "order": [[ 1, 'desc' ]],
    "lengthMenu": [
      [10, 25, 50, 100, -1],
      [10, 25, 50, 100, 'All']
    ]
  } );
  $('h3#ffz-emotes-statistics+table').dataTable( {
    "autoWidth": true,
    "pageLength": 25,
    "order": [[ 1, 'desc' ]],
    "lengthMenu": [
      [10, 25, 50, -1],
      [10, 25, 50, 'All']
    ]
  } );
  $('h3#7tv-emotes-statistics+table').dataTable( {
    "autoWidth": true,
    "pageLength": 100,
    "order": [[ 1, 'desc' ]],
    "lengthMenu": [
      [10, 25, 50, 100, 500, -1],
      [10, 25, 50, 100, 500, 'All']
    ]
  } );
  $('h3#channel-emotes-statistics+table').dataTable( {
    "autoWidth": true,
    "pageLength": 25,
    "order": [[ 1, 'desc' ]],
    "lengthMenu": [
      [10, 25, 50, -1],
      [10, 25, 50, 'All']
    ]
  } );
} );
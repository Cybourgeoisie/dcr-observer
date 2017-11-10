// Configuration
var valid_uri_hashes = ['home', 'dist', 'addr'];

// Show and hide page elements as we navigate the site
function handleNavigation(uri_hash) {
	if (!uri_hash || valid_uri_hashes.indexOf(uri_hash) === -1) {
		return;
	}

	// Hide all existing pages
	$('.dcr-page').hide();

	// Show the requested page
	$('.dcr-page-' + uri_hash).show();

	// Make sure the navigation button is active
	$('ul.navbar-nav li').removeClass('active');
	$('a[href="#' + uri_hash + '"]').parent('li').addClass('active');
}

function setEvents() {
	// Find all internal links, bind to handle navigation
	$('a.page-toggle').click(function(event) {
		//event.preventDefault();
		var uri_hash = $(this).attr('href').substr(1);
		handleNavigation(uri_hash);
	});
}

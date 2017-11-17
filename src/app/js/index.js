// Configuration
var valid_uri_hashes = ['home', 'top-hd', 'dist', 'dist-hd', 'addr'];
var dcr_price = 30.0;
var total_dcr = 7000000;
var current_block_height = 190000;

function boot() {
	$.post('api/State/getInfo')
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		total_dcr = data.total_dcr;
	 		current_block_height = data.height;
			handleNavigation(window.location.hash.substr(1) || "home");
	 	}
	});

	// Startup logic
	setEvents();
	getDcrPrice();
}

function getDcrPrice() {
	$.getJSON('https://api.coinmarketcap.com/v1/ticker/decred/', function(data) {
		dcr_price = parseFloat(data[0].price_usd);
	});
}

// Show and hide page elements as we navigate the site
function handleNavigation(uri_hash) {
	// Pull off any parameters
	var uri_hash_els = uri_hash.split('=');
	var uri = uri_hash_els[0];
	var uri_param = uri_hash_els[1];

	if (!uri_hash || valid_uri_hashes.indexOf(uri) === -1) {
		return;
	}

	// Hide all existing pages, show loading screen
	$('.dcr-page').hide();
	$('.dcr-page-loader').show();

	// If we're viewing an address, pass along to the address page
	if (uri == 'addr' && uri_param && uri_param.length) {
		loadAddressInfo(uri_param, function() { showPage('addr'); });
	} else if (uri == 'home') {
		pullTopAddresses(function() { showPage('home'); });
	} else if (uri == 'dist') {
		pullWealthDistribution(function() { showPage('dist'); });
	} else {
		showPage(uri);
	}
}

function showPage(uri) {
	// Hide all existing pages
	$('.dcr-page').hide();

	// Show the requested page
	$('.dcr-page-' + uri).show();

	// Make sure the navigation button is active
	$('ul.navbar-nav li').removeClass('active');
	var $parent_li = $('a[href="#' + uri + '"]').closest('li');
	$parent_li.addClass('active');
}

function setEvents() {
	// Find all internal links, bind to handle navigation
	$('a.page-toggle').click(function(event) {
		//event.preventDefault();
		var uri_hash = $(this).attr('href').substr(1);
		handleNavigation.call(this, uri_hash);
	});

	// Hash change - change page
	window.onhashchange = function() {
		handleNavigation.call(this, window.location.hash.substr(1) || "home");
	}

	// Address searching
	$('#dcr-address-search').submit(function(event) {
		event.preventDefault();
		var address = $(this).find('input#dcr-address-input').val();
		window.location.hash = '#addr=' + address;
		handleNavigation.call(this, 'addr=' + address);
	});
}

function loadAddressInfo(address, callback) {
	$.post('api/Address/getDetails', { 'address' : address })
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		setAddressInfo(data.addr_info);
	 		if (callback && typeof callback === 'function') {
	 			callback.call(this, data.addr_info);	 			
	 		}
	 	}
	});
}

function setAddressInfo(addr_info) {
	var start_date = new Date(addr_info.start*1000);
	var end_date = new Date(addr_info.end*1000);

	// Set address data
	$('.addr-last-date').html(end_date.toLocaleDateString());
	$('.addr-first-date').html(start_date.toLocaleDateString());
	$('.addr-last-activity').html(parseInt(addr_info.last).toLocaleString());
	$('.addr-first-activity').html(parseInt(addr_info.first).toLocaleString());
	$('.addr-total-out').html(parseInt(addr_info.vin).toLocaleString());
	$('.addr-total-in').html(parseInt(addr_info.vout).toLocaleString());
	$('.addr-num-tx').html(parseInt(addr_info.tx).toLocaleString());
	$('.addr-num-stx').html(parseInt(addr_info.stx).toLocaleString());
	$('.addr-pct-stx').html((parseFloat(addr_info.stx)/parseFloat(addr_info.tx)*100).toFixed(2));
	$('.addr-staked-out').html(parseInt(addr_info.svin).toLocaleString());
	$('.addr-staked-in').html(parseInt(addr_info.svout).toLocaleString());
	$('.addr-balance').html(parseInt(addr_info.balance).toLocaleString());
	$('.addr-fiat-value').html('$' + parseInt(parseFloat(addr_info.balance)*dcr_price).toLocaleString());
	$('.addr-address').html(addr_info.address);
	$('.addr-view-block-explorer').attr('href', 'https://explorer.dcrdata.org/explorer/address/' + addr_info.address);
	$('.addr-rank').html(addr_info.rank);
}

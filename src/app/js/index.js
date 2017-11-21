// Configuration
var valid_uri_hashes = ['home', 'top-hd', 'dist', 'dist-hd', 'addr', 'hd-addr', '404', 'maintenance'];
var dcr_price = 30.0;
var total_dcr = 6617242.27624844;
var current_block_height = 187908;
var historical_data_block = 190000;

function boot() {
	$.post('api/State/getInfo')
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		total_dcr = data.total_dcr;
	 		current_block_height = data.height;

	 		// Display current height and amount
	 		$('span.dcr-current-block-height').html(parseInt(current_block_height).toLocaleString());
	 		$('span.historical-slider-value').html(parseInt(current_block_height).toLocaleString());
	 		$('span.dcr-current-total-supply').html(parseFloat(total_dcr).toLocaleString());

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
		$('span.dcr-current-price').html(dcr_price);
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
	} else if (uri == 'hd-addr' && uri_param && uri_param.length) {
		loadHdAddressInfo(uri_param, function() { showPage('hd-addr'); });
	} else if (uri == 'home') {
		pullTopAddresses(function() { showPage('home'); });
	} else if (uri == 'dist') {
		pullWealthDistribution(function() { showPage('dist'); });
	} else if (uri == 'top-hd') {
		pullTopNetworks(function() { showPage('top-hd'); });
	} else if (uri == 'dist-hd') {
		pullWealthDistributionNetworks(function() { showPage('dist-hd'); });
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
		$('.navbar-collapse').collapse('hide');
	});

	// Hash change - change page
	window.onhashchange = function() {
		handleNavigation.call(this, window.location.hash.substr(1) || "home");
	}

	// Address searching
	$('#dcr-address-search').submit(function(event) {
		event.preventDefault();
		var address = $(this).find('input#dcr-address-input').val();
		if (!address) {
			return;
		}

		$('.navbar-collapse').collapse('hide');
		window.location.hash = '#addr=' + address;
		handleNavigation.call(this, 'addr=' + address);
	});

	// Attach logic to the slider
	$('.historical-slider-input').slider({
		"formatter": function(value) {
			return 'Block: ' + value;
		}
	});

	$('.historical-slider-input').on("slide", function(slideEvt) {
		var block = (slideEvt.value==190000) ? parseInt(current_block_height) : slideEvt.value;
		$('.historical-slider-value').html(block.toLocaleString());
	});

	$('.historical-slider-button').click(function(event) {
		historical_data_block = $('.historical-slider-input').val();

		// Reload the data
		var uri = window.location.hash.substr(1) || "home";
		if (uri == 'home') {
			pullTopAddresses();
		} else if (uri == 'dist') {
			pullWealthDistribution();
		} else if (uri == 'top-hd') {
			pullTopNetworks();
		} else if (uri == 'dist-hd') {
			pullWealthDistributionNetworks();
		}
	});
}

function loadAddressInfo(address, callback) {
	$.post('api/Address/getDetails', { 'address' : address })
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
			$('span.addr-est-wallet-loading').show();
			$('span.addr-est-wallet-none').hide();
			$('span.addr-est-wallet').hide();
	 		$.post('api/Address/getImmediateNetwork', { 'address' : address })
	 		.done(function(data) {
	 			if (data.hasOwnProperty('success') && data.success) {
	 				setAddressNetwork(data, address);
				}
			});

	 		setAddressInfo(data.addr_info);
	 		if (callback && typeof callback === 'function') {
	 			callback.call(this, data.addr_info);	 			
	 		}
	 	} else {
	 		showPage('404');
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

	// If the address has an identifier, display it
	$('.dcr-badge-address-identifier').hide();
	$('span.addr-identifier').html('');
	if (addr_info.hasOwnProperty('identifier') && addr_info.identifier) {
		$('.dcr-badge-address-identifier').show();
		$('span.addr-identifier').html(addr_info.identifier);
	}
}

function setAddressNetwork(network_info, address) {
	$('span.addr-est-wallet-loading').hide();
	$('span.addr-est-wallet-none').hide();
	$('span.addr-est-wallet').hide();

	// Report the count
	if (network_info && network_info.network_size && parseInt(network_info.network_size) > 1) {
		$('span.addr-est-wallet').show();
		$('span.addr-est-wallet > a').attr('href', '#hd-addr=' + address).html(parseInt(network_info.network_size) + ' addresses');
	} else {
		$('span.addr-est-wallet-none').show();
	}
}

function loadHdAddressInfo(address, callback) {
	$.post('api/Address/getHdDetails', { 'address' : address })
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		setHdAddressInfo(data.addresses, address);
	 		if (callback && typeof callback === 'function') {
	 			callback.call(this, data.addresses);	 			
	 		}
	 	}
	});
}

function setHdAddressInfo(hd_addresses, req_address) {
	// Set the current requested address
	$('.hd-top-address').html(req_address);

	// Get the DOM elements we're modifying
	var $hd_address_table = $('.table-hd-addresses');
	var $hd_address_tbody = $hd_address_table.find('tbody');
	var $hd_address_row = $hd_address_table.find('tr:last').clone(true).show();

	// Clear the existing data
	$hd_address_tbody.html('');

	// Collect the cumulative information
	var total_balance = 0, total_received = 0, total_sent = 0
	for (var i = 0; i < hd_addresses.length; i++) {
		total_balance  += parseFloat(hd_addresses[i].balance);
		total_received += parseFloat(hd_addresses[i].vout);
		total_sent     += parseFloat(hd_addresses[i].vin);

		// Get local information
		var address    = hd_addresses[i].address;
		var balance    = hd_addresses[i].balance;
		var identifier = hd_addresses[i].identifier;
		var tx_hash    = hd_addresses[i].tx_hash;

		// Add a row
		var $new_row = $hd_address_row.clone(true);
		$new_row.find('th').html(i+1);
		$new_row.find('td.hd-addr-address > a').html(address).data('address', address).attr('href', '#addr=' + address);
		$new_row.find('td.hd-addr-balance > .hd-addr-balance-value').html(parseFloat(balance).toLocaleString());

		// If the address has an identifier, display it
		$new_row.find('.hd-badge-address-identifier').hide();
		$new_row.find('.hd-addr-identifier').html('');
		if (hd_addresses[i].hasOwnProperty('identifier') && identifier) {
			$new_row.find('.hd-badge-address-identifier').show();
			$new_row.find('.hd-addr-identifier').html(identifier);
		}

		// Only display first 10 addresses by default
		if (i >= 10) {
			$new_row.hide();
		}

		$hd_address_tbody.append($new_row);
	}

	// Allow user to see more
	// Reset the "show all" button
	$('button.show-all-hd').removeAttr('disabled').html('Show All Addresses*');

	// Set the "show all" button to do something
	$('button.show-all-hd').click(function(event) {
		$('.table-hd-addresses tr').show();
		$('button.show-all-hd').attr("disabled", "disabled").html('Showing All Addresses');
	});

	// Set cumulative information
	$('.hd-balance').html(total_balance.toLocaleString());
	$('.hd-fiat-value').html('$' + parseInt(parseFloat(total_balance)*dcr_price).toLocaleString());
	$('.hd-total-in').html(total_received.toLocaleString());
	$('.hd-total-out').html(total_sent.toLocaleString());
	$('.hd-num-addresses').html(hd_addresses.length);

}
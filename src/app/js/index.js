// Configuration
var valid_uri_hashes = ['home', 'top-hd', 'dist', 'dist-hd', 'addr'];
var address_store;
var dcr_price = 30.0;

function getDcrPrice() {
	$.getJSON('https://api.coinmarketcap.com/v1/ticker/decred/', function(data) {
		dcr_price = parseFloat(data[0].price_usd);
	});
}

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
	var $parent_li = $('a[href="#' + uri_hash + '"]').closest('li');
	$parent_li.addClass('active');

	// If we're viewing an address, pass along to the address page
	if (uri_hash == 'addr') {
		loadAddressInfo.call(this);
	}
}

function setEvents() {
	// Find all internal links, bind to handle navigation
	$('a.page-toggle').click(function(event) {
		//event.preventDefault();
		var uri_hash = $(this).attr('href').substr(1);
		handleNavigation.call(this, uri_hash);
	});

	$('#dcr-address-search').submit(function(event) {
		event.preventDefault();

		var address = $(this).find('input#dcr-address-input').val();

		$.post('api/Address/getDetails', { 'address' : address })
		 .done(function(data) {
		 	console.log(data);
		 	if (data.hasOwnProperty('success') && data.success) {
		 		// Go to the address page & load this address's details
		 		setAddressInfo(data.addr_info);
		 		window.location.hash = '#addr';
				handleNavigation.call(this, 'addr');
		 	}
		});
	});
}

var address_details;
function setAddressInfo(addr_info) {
	address_details = addr_info;
}

function loadAddressInfo() {
	var $this = $(this);
	var address = $this.data('address');

	var addr_info;
	if (address_details && !address) {
		addr_info = address_details;
		address = addr_info['address'];
	} else if (address) {
		addr_info = address_store[address];
	} else {
		// 404
		window.location.hash = '#home';
		handleNavigation.call(this, 'home');
		return;
	}

	var start_date = new Date(addr_info.start*1000);
	var end_date = new Date(addr_info.end*1000);

	// Set address data
	$('.addr-last-date').html(end_date.toLocaleDateString());
	$('.addr-first-date').html(start_date.toLocaleDateString());
	$('.addr-last-activity').html(parseInt(addr_info.last).toLocaleString());
	$('.addr-first-activity').html(parseInt(addr_info.first).toLocaleString());
	$('.addr-total-out').html(parseInt(addr_info.out).toLocaleString());
	$('.addr-total-in').html(parseInt(addr_info.in).toLocaleString());
	$('.addr-num-tx').html(parseInt(addr_info.tx).toLocaleString());
	$('.addr-num-stx').html(parseInt(addr_info.stx).toLocaleString());
	$('.addr-pct-stx').html((parseFloat(addr_info.stx)/parseFloat(addr_info.tx)*100).toFixed(2));
	$('.addr-staked-out').html(parseInt(addr_info.sout).toLocaleString());
	$('.addr-staked-in').html(parseInt(addr_info.sin).toLocaleString());
	$('.addr-balance').html(parseInt(addr_info.val).toLocaleString());
	$('.addr-fiat-value').html('$' + parseInt(parseFloat(addr_info.val)*dcr_price).toLocaleString());
	$('.addr-address').html(address);
	$('.addr-view-block-explorer').attr('href', 'https://explorer.dcrdata.org/explorer/address/' + address);
	$('.addr-rank').html(addr_info.rank);
}

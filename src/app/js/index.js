// Configuration
var valid_uri_hashes = ['home', 'dist', 'addr'];
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
	$('a[href="#' + uri_hash + '"]').parent('li').addClass('active');

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
}

function pullTopAddresses() {
	var $top_address_table = $('.table-addresses');
	var $top_address_tbody = $top_address_table.find('tbody');
	var $top_address_row = $top_address_table.find('tr:last').clone(true);

	// Clear the existing data
	$top_address_tbody.html('');

	$.getJSON("./data/top_500_info_list.json", function(data) {
		// Pull the total supply
		var total_dcr = data.total_dcr;

		// Sort the list by value
		var sorted_list = [];
		for (var address in data.top) {
			sorted_list.push([address, data.top[address].val]);
		}
		sorted_list.sort(function(a, b) {return b[1] - a[1];});

		// Now display them all
		var sum_balance = 0;
		for (var i = 0; i < sorted_list.length; i++) {
			var address = sorted_list[i][0];
			data.top[address].rank = i+1;
			var address_info = data.top[address];

			var balance = parseFloat(address_info.val);
			sum_balance += balance;
			balance = balance.toFixed(1);

			var num_tx  = parseFloat(address_info.tx);
			var num_stx = parseFloat(address_info.stx);
			var pct_stx = ((num_stx/num_tx)*100).toFixed(2);

			var pct = ((parseFloat(address_info.val) / total_dcr) * 100).toFixed(2);

			var $new_row = $top_address_row.clone(true);
			$new_row.find('th').html(address_info.rank);
			$new_row.find('td.top-td-address > a').html(address).data('address', address);
			$new_row.find('td.top-td-balance').html(parseInt(balance).toLocaleString() + ' DCR');
			$new_row.find('td.top-td-percent').html(pct + '%');
			$new_row.find('td.top-td-num-tx').html(num_tx);
			$new_row.find('td.top-td-pct-stx').html(pct_stx + '%');

			// Only display first 10 addresses by default
			if (i >= 10) {
				$new_row.hide();
			}

			$top_address_tbody.append($new_row);
		}

		// Set the "show all 500" button to do something
		$('button.show-all-500').click(function(event) {
			$('.table-addresses tr').show();
			$('button.show-all-500').attr("disabled", "disabled").html('Showing All 500');
		});

		// Show totals and percentages
		$('.top-sum').html(parseInt(sum_balance).toLocaleString());
		$('.total-dcr').html(parseInt(total_dcr).toLocaleString());

		var sum_percent = ((sum_balance / total_dcr) * 100).toFixed(2);
		$('.top-sum-percent').html(sum_percent + '%');

		// Store the top addresses outside of this function for the address page
		address_store = data.top;
	});
}

function pullWealthDistribution() {
	var $distrib_table = $('.table-distribution');
	var $distrib_tbody = $distrib_table.find('tbody');
	var $distrib_row = $distrib_table.find('tr:last').clone(false);

	// Clear the existing data
	$distrib_tbody.html('');

	$.getJSON("./data/wealth_distribution.json", function(data) {
		// Pull the total supply
		var bins      = data.bins;
		var counts    = data.counts;
		var values    = data.value;
		//var total_dcr = data.total_dcr;

		// Get the total address count
		var total_accts = 0, total_dcr = 0;
		for (var i = 0; i < counts.length; i++) {
			total_accts += counts[i];
			total_dcr += values[i];
		}

		// Now display them all
		for (var i = 0; i < bins.length; i++) {
			var bin;
			if (i == 0) {
				bin = "0 to " + parseInt(bins[i]).toLocaleString() + " DCR";
			} else {
				bin = parseInt(bins[i-1]).toLocaleString() + " to " + parseInt(bins[i]).toLocaleString() + " DCR";
			}

			var count = counts[i];
			var value = values[i];

			var pct_accts = ((parseFloat(count) / total_accts) * 100).toFixed(4);
			var pct_dcr = ((parseFloat(value) / total_dcr) * 100).toFixed(2);

			var $new_row = $distrib_row.clone(false);
			$new_row.find('th').html(bin);
			$new_row.find('td.td-num-addrs').html(parseInt(count).toLocaleString());
			$new_row.find('td.td-pct-addrs .wealth-pct-addrs').html(pct_accts + "%");
			$new_row.find('td.td-pct-addrs .progress-bar').css('width', pct_accts + '%');
			$new_row.find('td.td-sum').html(parseInt(value).toLocaleString() + " DCR");
			//$new_row.find('td.td-sum-value').html();
			$new_row.find('td.td-pct-supply .wealth-pct-supply').html(pct_dcr + "%");
			$new_row.find('td.td-pct-supply .progress-bar').css('width', pct_dcr + '%');
			$distrib_tbody.append($new_row);
		}
	});
}

function loadAddressInfo() {
	var $this = $(this);
	var address = $this.data('address');

	// 404
	if (!address) {
		window.location.hash = '#home';
		handleNavigation.call(this, 'home');
		return;
	}

	// Get the address info
	var addr_info = address_store[address];

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

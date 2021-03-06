// Configuration
var valid_uri_hashes = ['home', 'top-hd', 'dist', 'dist-hd', 'dist-listing', 'dist-hd-listing', 'addr', 'hd-addr', 'vote-results', 'issue-results', 'voting', 'voting-hd', 'voting-stakesubmission', '404', 'maintenance'];
var dcr_price = 30.0;
var total_dcr = 6651899.447322492;
var current_block_height = 189416;
var historical_data_block = 190000;

// Maintenance Mode
var MAINTENANCE_MODE = false;

function boot() {
	if (MAINTENANCE_MODE) {
		// Startup logic
		setEvents();
		getDcrPrice();

		// Display current height and amount
		$('span.dcr-current-block-height').html(parseInt(current_block_height).toLocaleString());
		$('span.historical-slider-value').html(parseInt(current_block_height).toLocaleString());
		$('span.dcr-current-total-supply').html(parseFloat(total_dcr).toLocaleString());

		// Display current RCI
		var max_rci   = parseInt((current_block_height-4096)/8064)+1;
		var max_block = (max_rci-1) * 8064 + 4096;
		$('span.historical-vote-results-slider-value').html(max_block.toLocaleString());
		$('span.historical-vote-results-slider-rci').html(max_rci.toLocaleString());
		$('.historical-vote-results-slider-input').data('slider-max', max_block);
		$('.historical-vote-results-slider-input').data('slider-value', max_block);

		setHistoricalSliderEvents();

		handleNavigation(window.location.hash.substr(1) || "home");
		return;
	}

	$.post('api/State/getInfo')
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		total_dcr = data.total_dcr;
	 		current_block_height = data.height;

	 		// Display current height and amount
	 		$('span.dcr-current-block-height').html(parseInt(current_block_height).toLocaleString());
	 		$('span.historical-slider-value').html(parseInt(current_block_height).toLocaleString());
	 		$('span.dcr-current-total-supply').html(parseFloat(total_dcr).toLocaleString());

	 		// Display current RCI
			var max_rci   = parseInt((current_block_height-4096)/8064)+1;
			var max_block = (max_rci-1) * 8064 + 4096;
			$('span.historical-vote-results-slider-value').html(max_block.toLocaleString());
			$('span.historical-vote-results-slider-rci').html(max_rci.toLocaleString());
			$('.historical-vote-results-slider-input').attr('data-slider-max', max_block);
			$('.historical-vote-results-slider-input').attr('data-slider-value', max_block);

			setHistoricalSliderEvents();

	 		$.getJSON('https://api.coinmarketcap.com/v1/ticker/decred/', function(data) {
	 			dcr_price = parseFloat(data[0].price_usd);
				$('span.dcr-current-price').html(dcr_price);
				handleNavigation(window.location.hash.substr(1) || "home");
			});
	 	}
	});

	// Startup logic
	setEvents();
	//getDcrPrice();
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
		if (MAINTENANCE_MODE) {
			showPage('maintenance');
		} else {
			loadAddressInfo(uri_param, function() { showPage('addr'); });			
		}
	} else if (uri == 'hd-addr' && uri_param && uri_param.length) {
		if (MAINTENANCE_MODE) {
			showPage('maintenance');
		} else {
			loadHdAddressInfo(uri_param, function() { showPage('hd-addr'); });
		}
	} else if (uri == 'home') {
		pullTopAddresses(function() { showPage('home'); });
	} else if (uri == 'dist') {
		pullWealthDistribution(function() { showPage('dist'); });
	} else if (uri == 'top-hd') {
		pullTopNetworks(function() { showPage('top-hd'); });
	} else if (uri == 'dist-hd') {
		pullWealthDistributionNetworks(function() { showPage('dist-hd'); });
	} else if (uri == 'dist-listing' && uri_param && uri_param.length) {
		if (MAINTENANCE_MODE) {
			showPage('maintenance');
		} else {
			loadDistributionListing(uri_param, false, function() { showPage('dist-listing'); });
		}
	} else if (uri == 'dist-hd-listing' && uri_param && uri_param.length) {
		if (MAINTENANCE_MODE) {
			showPage('maintenance');
		} else {
			loadDistributionListing(uri_param, true, function() { showPage('dist-listing'); });
		}
	} else if (uri == 'vote-results') {
		if (MAINTENANCE_MODE) {
			showPage('maintenance');
		} else {
			// Get the RCI
			var rci = parseInt(($('.historical-vote-results-slider-input').val()-4096)/8064)+1;
			pullVoteResultsFromApi(rci, function() { showPage('vote-results'); });
		}
	} else if (uri == 'issue-results' && uri_param && uri_param.length) {
		if (MAINTENANCE_MODE) {
			showPage('maintenance');
		} else {
			// Get the RCI
			var rci = parseInt(($('.historical-vote-results-slider-input').val()-4096)/8064)+1;
			pullIssueResultsFromApi(uri_param, rci, function() { showPage('issue-results'); });
		}
	} else if (uri == 'voting') {
		if (MAINTENANCE_MODE) {
			showPage('maintenance');
		} else {
			pullTicketDistributionFromApi(function() { showPage('voting'); });
		}
	} else if (uri == 'voting-hd') {
		if (MAINTENANCE_MODE) {
			showPage('maintenance');
		} else {
			pullTicketNetworkDistributionFromApi(function() { showPage('voting-hd'); });
		}
	} else if (uri == 'voting-stakesubmission') {
		if (MAINTENANCE_MODE) {
			showPage('maintenance');
		} else {
			pullTicketStakePoolDistributionFromApi(function() { showPage('voting-stakesubmission'); });
		}
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

function setHistoricalSliderEvents() {
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

	// Attach logic to the slider
	$('.historical-vote-results-slider-input').slider({
		"formatter": function(value) {
			return 'Block: ' + value;
		}
	});

	$('.historical-vote-results-slider-input').on("slide", function(slideEvt) {
		var block = slideEvt.value;
		var rci = parseInt((block-4096)/8064)+1;
		$('.historical-vote-results-slider-value').html(block.toLocaleString());
		$('.historical-vote-results-slider-rci').html(rci);
	});

	$('.historical-vote-results-slider-button').click(function(event) {
		// Get the RCI
		var rci = parseInt(($('.historical-vote-results-slider-input').val()-4096)/8064)+1;

		// Reload the data
		var uri_hash = window.location.hash.substr(1) || "vote-results";
		var uri_hash_els = uri_hash.split('=');
		var uri = uri_hash_els[0];
		var uri_param = uri_hash_els[1];

		if (uri == 'vote-results') {
			pullVoteResultsFromApi(rci);
		} else if (uri == 'issue-results') {
			pullIssueResultsFromApi(uri_param, rci);
		}
	});

	$('.historical-vote-results-slider-all-time').click(function(event) { 
		// Reload the data
		var uri_hash = window.location.hash.substr(1) || "vote-results";
		var uri_hash_els = uri_hash.split('=');
		var uri = uri_hash_els[0];
		var uri_param = uri_hash_els[1];

		if (uri == 'vote-results') {
			pullVoteResultsFromApi(0);
		} else if (uri == 'issue-results') {
			pullIssueResultsFromApi(uri_param, 0);
		}
	});
}

function setEvents() {
	// Activate all tooltips
	$('[data-toggle="tooltip"]').tooltip();

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

	// Clear the data modal
	$('.modal').on('show.bs.modal', function (e) {
		// Kill the data view
		var modal_loader = $('.modal-data-loading').show();
		$('#modal-d3').html('').html(modal_loader);
	});

	// Handle the data modal
	$('.modal').on('shown.bs.modal', function (e) {
		if (MAINTENANCE_MODE) {
			return;
		}

		var $source = $(e.relatedTarget);
		if ($source.data('origin') == 'dist-addr' || $source.data('origin') == 'dist-hd-addr') {
			getWealthDistributionPie($(this), $source);
		} else if ($source.data('origin') == 'hd-addr') {
			getAddressDistributionPie($(this), $source);
		} else if ($source.data('origin') == 'addr-input' || $source.data('origin') == 'hd-addr-input') {
			getAddressInputPie($(this), $source);
		} else if ($source.data('origin') == 'vote-results-issue') {
			getIssueVoteResultsPie($(this), $source);
		} else if ($source.data('origin') == 'vote-results-versions') {
			getVersionVoteResultsPie($(this), $source);
		} else if ($source.data('origin') == 'hd-addr-view-connection') {
			getAddressConnection($(this), $source);
		}
	});

	$('.modal').on('hidden.bs.modal', function (e) {
		// Kill the data view
		var modal_loader = $('.modal-data-loading').show();
		$('#modal-d3').html('').html(modal_loader);
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

	 		setAddressInfo(data);
	 		if (callback && typeof callback === 'function') {
	 			callback.call(this, data.addr_info);	 			
	 		}
	 	} else {
	 		showPage('404');
	 	}
	});
}

function setAddressInfo(data) {
	var addr_info = data.addr_info;
	var voting_tally = data.voting_tally;
	var voting_record = data.voting_record;

	var start_date = new Date(addr_info.start*1000);
	var end_date = new Date(addr_info.end*1000);

	// Set address data
	$('.addr-last-date').html(end_date.toLocaleDateString());
	$('.addr-first-date').html(start_date.toLocaleDateString());
	$('.addr-last-activity').html(parseInt(addr_info.last).toLocaleString());
	$('.addr-first-activity').html(parseInt(addr_info.first).toLocaleString());
	$('.addr-total-out').html(parseFloat(addr_info.vin).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}));
	$('.addr-total-in').html(parseFloat(addr_info.vout).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}));
	$('.addr-num-tx').html(parseInt(addr_info.tx).toLocaleString());
	$('.addr-num-stx').html(parseInt(addr_info.stx).toLocaleString());
	$('.addr-pct-stx').html((parseFloat(addr_info.stx)/parseFloat(addr_info.tx)*100).toFixed(2));
	$('.addr-staked-out').html(parseFloat(addr_info.svin).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}));
	$('.addr-staked-in').html(parseFloat(addr_info.svout).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}));
	$('.addr-address').html(addr_info.address);
	$('.addr-view-block-explorer').attr('href', 'https://explorer.dcrdata.org/explorer/address/' + addr_info.address);
	$('.addr-rank').html(addr_info.rank);

	// Set the button to view the balance breakdown
	$('.addr-input-btn').data('address', addr_info.address);

	// Balances
	//var total_balance = parseFloat(addr_info.balance) + parseFloat(addr_info.actively_staking);
	var total_balance = parseFloat(addr_info.balance);
	$('.addr-balance').html(parseFloat(addr_info.balance).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}));
	$('.addr-fiat-value').html('$' + (parseFloat(addr_info.balance)*dcr_price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}));
	$('.addr-liquid-balance').html(parseFloat(addr_info.liquid).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}));
	$('.addr-stake-submissions').html(parseFloat(addr_info.active_stake_submissions).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}));
	//$('.addr-actively-staking').html(parseFloat(addr_info.actively_staking).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}));
	$('.addr-total-balance').html(total_balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}));
	
	// If the address has an identifier, display it
	$('.dcr-badge-address-identifier').hide();
	$('span.addr-identifier').html('');
	if (addr_info.hasOwnProperty('identifier') && addr_info.identifier) {
		$('.dcr-badge-address-identifier').show();
		$('span.addr-identifier').html(addr_info.identifier);
	}

	// Display known origin
	$('.dcr-badge-address-origin').hide();
	$('span.addr-origin').html('');
	if (addr_info.hasOwnProperty('origin') && addr_info.origin) {
		$('.dcr-badge-address-origin').show();
		$('span.addr-origin').html(addr_info.origin);
	}

	// If the address is a ticket, display it
	$('.dcr-badge-address-ticket').hide();
	$('span.addr-ticket').html('');
	if (addr_info.hasOwnProperty('ticket') && addr_info.ticket) {
		$('.dcr-badge-address-ticket').show();
		$('span.addr-ticket').html(addr_info.ticket);
	}

	// If the address is actively staking, notify
	$('.dcr-badge-address-actively-staking').hide();
	if (addr_info.hasOwnProperty('actively_staking') && addr_info.actively_staking == 't') {
		$('.dcr-badge-address-actively-staking').show();
	}

	// Display current staking details
	$('.addr-active-tickets').html(addr_info.active_tickets);
	$('.addr-completed-tickets').html(addr_info.completed_tickets);
	$('.addr-revoked-tickets').html(addr_info.revoked_tickets);
	$('.addr-active-stakesubmissions').html(addr_info.active_stakesubmissions);
	$('.addr-completed-stakesubmissions').html(addr_info.completed_stakesubmissions);

	// Show the address's voting record
	showVotingRecord('addr', data.voting_tally, data.voting_record, data.tickets_staked);
}

function showVotingRecord(addr_or_hd, voting_tally, voting_record, tickets_staked) {
	var prefix = 'addr';
	if (addr_or_hd == 'hd') {
		prefix = 'hd-addr';
	}

	if (voting_tally.all > 0) {
		$('.' + prefix + '-voting-record-container-none').hide();
		$('.' + prefix + '-voting-record-container').show();

		var $vr_row = $('.' + prefix + '-voting-record:last').clone(true);
		$('.' + prefix + '-voting-record-container').html('');

		if (voting_tally.v4 > 0) {
			$row = $vr_row.clone(true);
			$row.find('.' + prefix + '-staking-version').html('V4 Votes'); // Set the header
			$vr_tr = $row.find('.table-' + prefix + '-votes > tbody > tr:last').clone(true); // Copy a tr
			$row.find('.table-' + prefix + '-votes > tbody').html(''); // Clear all other tr's

			var issues = ['v4-sdiff', 'v4-lnsupport'];
			for (var i = 0; i < issues.length; i++) {
				$tr = $vr_tr.clone(true);
				$tr.find('.' + prefix + '-votes-issue').html(voting_record[issues[i]]['issue']);
				$tr.find('.' + prefix + '-votes-yes').html(voting_record[issues[i]]['yes']);
				$tr.find('.' + prefix + '-votes-no').html(voting_record[issues[i]]['no']);
				$tr.find('.' + prefix + '-votes-abstain').html(voting_record[issues[i]]['abstain']);
				$row.find('.table-' + prefix + '-votes > tbody').append($tr);
			}

			$('.' + prefix + '-voting-record-container').append($row);
		}

		if (voting_tally.v5 > 0) {
			$row = $vr_row.clone(true);
			$row.find('.' + prefix + '-staking-version').html('V5 Votes'); // Set the header
			$tr = $row.find('.table-' + prefix + '-votes > tbody > tr:last').clone(true); // Copy a tr
			$row.find('.table-' + prefix + '-votes > tbody').html(''); // Clear all other tr's

			var issues = ['v5-lnfeatures'];
			for (var i = 0; i < issues.length; i++) {
				$tr.find('.' + prefix + '-votes-issue').html(voting_record[issues[i]]['issue']);
				$tr.find('.' + prefix + '-votes-yes').html(voting_record[issues[i]]['yes']);
				$tr.find('.' + prefix + '-votes-no').html(voting_record[issues[i]]['no']);
				$tr.find('.' + prefix + '-votes-abstain').html(voting_record[issues[i]]['abstain']);
				$row.find('.table-' + prefix + '-votes > tbody').append($tr);
			}

			$('.' + prefix + '-voting-record-container').append($row);
		}
	} else {
		$('.' + prefix + '-voting-record-container-none').show();
		$('.' + prefix + '-voting-record-container').hide();
	}

	$('.' + prefix + '-tickets-staked').html(tickets_staked);
	$('.' + prefix + '-total-votes').html(voting_tally.all);
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

function getAddressConnection($modal, $source) {
	// Display the loader
	$modal.find('.modal-data-loading').show();

	// Pull the address from the data source
	var address_from = $source.data('from');
	var address_to   = $source.data('to');

	// Set title
	$modal.find('.modal-title').html('Connection Between Addresses');

	$.post('api/Address/getAddressConnection', {'from': address_from, 'to':address_to})
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		// Hide the loader
			$modal.find('.modal-data-loading').hide();

			// Generate the table
			$table = $('.modal-connection-table').clone(true).show();
			$tbody = $table.find('tbody');
			$row   = $tbody.find('tr').clone(true);
			$tbody.html('');

			// Collect the path
			var path = data.path;
			for (var i = 0; i < path.length; i++) {
				$new_row = $row.clone(true);
				$new_row.find('.addr-connection-table-address > a').attr('href', '#addr=' + path[i].address).html(path[i].address);
				if (path[i].hasOwnProperty('tx')) {
					$new_row.find('.addr-connection-table-tx > a').attr('href', 'https://explorer.dcrdata.org/explorer/tx/' + path[i].tx).html('View');
				} else {
					$new_row.find('.addr-connection-table-tx > a').attr('href', '').html('');
				}
				$new_row.appendTo($tbody);
			}

	 		// Load the data
	 		$modal.find('.modal-body').append($table);
	 	} else {
	 		console.log("Error");
	 		console.log(data);
	 	}
	});
}

function getAddressDistributionPie($modal, $source) {
	// Display the loader
	$modal.find('.modal-data-loading').show();

	// Pull the address from the data source
	var address = $source.data('address');

	// Set title
	$modal.find('.modal-title').html('Address Breakdown for HD Wallet');

	$.post('api/Address/getHdChartBreakdown', {'address': address})
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		// Hide the loader
			$modal.find('.modal-data-loading').hide();

	 		// Load the pie
	 		showAddressDistributionPie(data);
	 	}
	});
}

function getAddressInputPie($modal, $source) {
	// Display the loader
	$modal.find('.modal-data-loading').show();

	// Pull the address from the data source
	var address = $source.data('address');

	// Set title
	var addr_or_wallet, api_address;
	if ($source.data('origin') == 'hd-addr-input') {
		addr_or_wallet = 'Wallet';
		api_address = 'api/Address/getHdVoutDetails';
		$modal.find('.modal-title').html('HD Wallet Input Breakdown');
	} else {
		addr_or_wallet = 'Address';
		api_address = 'api/Address/getVoutDetails';
		$modal.find('.modal-title').html('Address Input Breakdown');
	}

	$.post(api_address, {'address': address})
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		// Hide the loader
			$modal.find('.modal-data-loading').hide();

	 		// Load the pie
	 		showAddressInputPie(data, addr_or_wallet);
	 	}
	});
}

function loadHdAddressInfo(address, callback) {
	$.post('api/Address/getHdDetails', { 'address' : address })
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		setHdAddressInfo(data, address);
	 		if (callback && typeof callback === 'function') {
	 			callback.call(this, data.addresses);	 			
	 		}
	 	}
	});
}

var remaining_hd_addresses_to_load = [];
function setHdAddressInfo(data, req_address) {
	var hd_addresses = data.addresses;
	var network = data.network;

	// Set the current requested address
	$('.hd-top-address').html(req_address);

	// Get the DOM elements we're modifying
	var $hd_address_table = $('.table-hd-addresses');
	var $hd_address_tbody = $hd_address_table.find('tbody');
	var $hd_address_row = $hd_address_table.find('tr:last').clone(true).show();

	// Clear the existing data
	$hd_address_tbody.html('');

	// Set the cumulative information
	var total_balance  = parseFloat(network.balance);
	var total_received = parseFloat(network.vout);
	var total_sent     = parseFloat(network.vin);
	var identifier     = network.identifier;

	// Collect the cumulative information
	for (var i = 0; i < Math.min(hd_addresses.length, 10); i++) {
		addHdAddressRow($hd_address_tbody, $hd_address_row, hd_addresses[i], i+1);
	}

	if (hd_addresses.length > 10) {
		// Store the remaining addresses for loading via "show all"
		remaining_hd_addresses_to_load = hd_addresses.slice(10);
		$('button.show-all-hd').removeAttr('disabled').html('Show Top Addresses*');
	} else {
		$('button.show-all-hd').attr("disabled", "disabled").html('Showing Top Addresses*');
	}

	// Set the "show all" button to do something
	$('button.show-all-hd').off();
	$('button.show-all-hd').click(function(event) {
		var $hd_address_table = $('.table-hd-addresses');
		var $hd_address_tbody = $hd_address_table.find('tbody');
		var $hd_address_row = $hd_address_table.find('tr:last').clone(true).show();

		for (var i = 0; i < remaining_hd_addresses_to_load.length; i++) {
			addHdAddressRow($hd_address_tbody, $hd_address_row, remaining_hd_addresses_to_load[i], i + 11);
		}
		$('.hd-addr-view-connection').data('from', req_address);

		$('button.show-all-hd').attr("disabled", "disabled").html('Showing All Addresses');
	});

	// Set the button to view the balance breakdown
	$('.hd-addr-input-btn').data('address', req_address);

	// Set cumulative information
	$('.hd-addr-view-all').data('address', req_address);
	$('.hd-addr-view-connection').data('from', req_address).removeAttr("disabled");
	$('.hd-addr-view-connection[data-to=\'' + req_address + '\']').attr("disabled", "disabled");
	$('.hd-balance').html(total_balance.toLocaleString());
	$('.hd-fiat-value').html('$' + parseInt(parseFloat(total_balance)*dcr_price).toLocaleString());
	$('.hd-total-in').html(total_received.toLocaleString());
	$('.hd-total-out').html(total_sent.toLocaleString());
	$('.hd-num-addresses').html(network.num_addresses);

	// Balance info
	$('.hd-addr-liquid-balance').html(parseFloat(network.liquid).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}));
	$('.hd-addr-stake-submissions').html(parseFloat(network.active_stake_submissions).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}));
	$('.hd-addr-total-balance').html(parseFloat(network.balance).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}));

	// If the top address has an identifier, display it
	var $identifier = $('.dcr-badge-hd-address-identifier');
	$identifier.hide();
	$identifier.find('span.hd-addr-identifier').html('');
	if (identifier && identifier.length > 0) {
		$identifier.show();
		$identifier.find('span.hd-addr-identifier').html(identifier);
	}

	// Display known origin
	var $origin = $('.dcr-badge-hd-address-origin');
	$origin.hide();
	$origin.find('span.hd-addr-origin').html('');
	if (network.origin && network.origin.length > 0) {
		$origin.show();
		$origin.find('span.hd-addr-origin').html(network.origin);
	}

	// If the top address is a ticket, display it
	var $ticket = $('.dcr-badge-hd-address-ticket');
	$ticket.hide();
	$ticket.find('span.hd-addr-ticket').html('');
	if (network.ticket && network.ticket.length > 0) {
		$ticket.show();
		$ticket.find('span.hd-addr-ticket').html(network.ticket);
	}

	// If the top address is staking, display it
	$('.dcr-badge-hd-address-actively-staking').hide();
	if (network.actively_staking == 't') {
		$('.dcr-badge-hd-address-actively-staking').show();
	}

	// Display current staking details
	$('.hd-addr-active-tickets').html(network.active_tickets);
	$('.hd-addr-completed-tickets').html(network.completed_tickets);
	$('.hd-addr-revoked-tickets').html(network.revoked_tickets);
	$('.hd-addr-active-stakesubmissions').html(network.active_stakesubmissions);
	$('.hd-addr-completed-stakesubmissions').html(network.completed_stakesubmissions);

	// Show the wallet's voting record
	showVotingRecord('hd', data.voting_tally, data.voting_record, data.tickets_staked);
}

function addHdAddressRow($hd_address_tbody, $hd_address_row, hd_address, row_number) {
	// Get local information
	var address    = hd_address.address;
	var balance    = hd_address.balance;
	var identifier = hd_address.identifier;
	var actively_staking = hd_address.actively_staking;

	// Add a row
	var $new_row = $hd_address_row.clone(true);
	$new_row.find('th').html(row_number);
	$new_row.find('td.hd-addr-address > a').html(address).data('address', address).attr('href', '#addr=' + address);
	$new_row.find('td.hd-addr-balance > .hd-addr-balance-value').html(parseFloat(balance).toLocaleString());
	$new_row.find('.hd-addr-view-connection').data('to', address).attr('data-to', address);

	// If the address has an identifier, display it
	$new_row.find('.hd-badge-address-identifier').hide();
	$new_row.find('.hd-addr-identifier').html('');
	if (hd_address.hasOwnProperty('identifier') && identifier) {
		$new_row.find('.hd-badge-address-identifier').show();
		$new_row.find('.hd-addr-identifier').html(identifier);
	}

	// Display known origin
	$new_row.find('.hd-badge-address-origin').hide();
	$new_row.find('.hd-addr-origin').html('');
	if (hd_address.hasOwnProperty('origin') && hd_address.origin) {
		$new_row.find('.hd-badge-address-origin').show();
		$new_row.find('.hd-addr-origin').html(hd_address.origin);
	}

	// If the address is a ticket, display it
	$new_row.find('.hd-badge-address-ticket').hide();
	$new_row.find('.hd-addr-ticket').html('');
	if (hd_address.hasOwnProperty('ticket') && hd_address.ticket) {
		$new_row.find('.hd-badge-address-ticket').show();
		$new_row.find('.hd-addr-ticket').html(hd_address.ticket);
	}

	// If the address is actively staking, make note of it
	$new_row.find('.hd-badge-address-actively-staking').hide();
	if (hd_address.hasOwnProperty('actively_staking') && actively_staking == 't') {
		$new_row.find('.hd-badge-address-actively-staking').show();
	}

	$hd_address_tbody.append($new_row);
}

function showAddressDistributionPie(results) {
	var data = results.data

	// Determine the size of the pie
	var e = document.documentElement,
		g = document.getElementsByTagName('body')[0],
		x = window.innerWidth || e.clientWidth || g.clientWidth;
	var pieSize         = (x < 768) ? 240 : ((x < 992) ? 320 : 440);
	var fontSize        = (x < 768) ? 11 : ((x < 992) ? 15 : 20);
	var subFontSize     = (x < 768) ? 9 : ((x < 992) ? 11 : 12);
	var subtitlePadding = (x < 768) ? 8 : ((x < 992) ? 10 : 12);
	var labelFontSize   = (x < 768) ? 9 : ((x < 992) ? 10 : 11);
	var truncateLength  = (x < 992) ? 10 : 12;
	var widthBuffer     = (x < 768) ? 130 : 220;

	// Generate colors for this data
	var gradient, colorsHsv;
	if (data.length > 2) {
		gradient = tinygradient([
			{color: '#2971FF', pos: 0},
			{color: '#69D3F5', pos: 0.5},
			{color: '#2ED6A1', pos: 1}
		]);
		colorsHsv = gradient.rgb(data.length);
	} else if (data.length <= 2) {
		colorsHsv = ['#2971FF','#2ED6A1'];
	}

	// Format the data
	var contentData = [];
	for (var i = 0; i < data.length; i++) {
		contentData.push({
			"label" : data[i].label,
			"value" : parseFloat(data[i].value),
			"color" : (data[i].label == 'Other') ? '#cccccc' : (data.length < 3) ? colorsHsv[i] : colorsHsv[i].toHexString()
		});
	}

	var title = "Address Breakdown";

	// Display the pie
	d3pie("modal-d3", {
		"header": {
			"title": { "text": title, "fontSize": fontSize},
			"location": "pie-center"
		},
		"size": { "canvasHeight": pieSize, "canvasWidth": pieSize+widthBuffer, "pieInnerRadius": "53%", "pieOuterRadius": "90%" },
		"data": {
			"sortOrder": "none",
			"smallSegmentGrouping": {
				"enabled": true,
				"value": 0.1,
				"valueType": "percentage",
				"label": "Other",
				"color": "#cccccc"
			},
			"content": contentData
		},
		"labels": {
			"outer": { "format": "label-value2", "pieDistance": 12, "hideWhenLessThanPercentage": 1 },
			"inner": { "hideWhenLessThanPercentage": 1.33 },
			"mainLabel": { "fontSize": labelFontSize },
			"percentage": { "color": "#ffffff", "decimalPlaces": 2 },
			"value": { "color": "#adadad", "fontSize": labelFontSize },
			"lines": { "enabled": false },
			"truncation": { "enabled": true, "truncateLength":truncateLength },
			formatter: function(ctx) { var label = ctx.label; if (ctx.part == 'value') { return parseInt(ctx.label).toLocaleString() + " DCR"; } return label; }
		},
		"effects": { "load": {
			"effect": "default", // none / default
			"speed": 750
		}, "pullOutSegmentOnClick": { "effect": "linear", "speed": 400, "size": 8 } },
		"misc": { "gradient": { "enabled": false, "percentage": 100 } },
		"callbacks" : {
			"onload" : function() { 
				$("[class$=_segmentMainLabel-outer]").each(function(idx, $el) {
					var addr = $(this).attr('data-text');
					if (addr.startsWith('Ds') || addr.startsWith('Dc')) {
						$(this).html("<a href=\"#addr=" + addr + "\">" + $(this).text() + "</a>");
					}
				});
			}
		}
	});
}

function showAddressInputPie(results, addr_or_wallet = 'Address') {
	var data = results.data

	// Determine the size of the pie
	var e = document.documentElement,
		g = document.getElementsByTagName('body')[0],
		x = window.innerWidth || e.clientWidth || g.clientWidth;
	var pieSize         = (x < 768) ? 240 : ((x < 992) ? 320 : 440);
	var fontSize        = (x < 768) ? 11 : ((x < 992) ? 15 : 20);
	var subFontSize     = (x < 768) ? 9 : ((x < 992) ? 11 : 12);
	var subtitlePadding = (x < 768) ? 8 : ((x < 992) ? 10 : 12);
	var labelFontSize   = (x < 768) ? 9 : ((x < 992) ? 10 : 11);
	var truncateLength  = (x < 992) ? 10 : 12;
	var widthBuffer     = (x < 768) ? 130 : 220;

	// Generate colors for this data
	var gradient, colorsHsv;
	if (data.length > 2) {
		gradient = tinygradient([
			{color: '#2971FF', pos: 0},
			{color: '#69D3F5', pos: 0.5},
			{color: '#2ED6A1', pos: 1}
		]);
		colorsHsv = gradient.rgb(data.length);
		for (var i = 0; i < data.length; i++) {
			colorsHsv[i] = colorsHsv[i].toHexString();
		}
	} else if (data.length <= 2) {
		colorsHsv = ['#2971FF','#2ED6A1'];
	}

	// Format the data
	var contentData = [], sum = 0;
	for (var i = 0; i < data.length; i++) {
		if (data[i].value <= 0) {
			continue;
		}

		sum += parseFloat(data[i].value);

		contentData.push({
			"label" : data[i].label,
			"value" : parseFloat(data[i].value)
		});
	}

	var title = addr_or_wallet + " Inputs";
	var subtitle = parseInt(sum).toLocaleString() + ' DCR';

	// Display the pie
	d3pie("modal-d3", {
		"header": {
			"title": { "text": title, "fontSize": fontSize},
			"subtitle": { "text": subtitle, "color": "#999999", "fontSize": subFontSize},
			"location": "pie-center",
			"titleSubtitlePadding": subtitlePadding
		},
		"size": { "canvasHeight": pieSize, "canvasWidth": pieSize+widthBuffer, "pieInnerRadius": "53%", "pieOuterRadius": "90%" },
		"data": {
			"sortOrder": "value-asc",
			"content": contentData
		},
		"labels": {
			"outer": { "format": "label-value2", "pieDistance": 12, "hideWhenLessThanPercentage": 0 },
			"inner": { "hideWhenLessThanPercentage": 1.33 },
			"mainLabel": { "fontSize": labelFontSize },
			"percentage": { "color": "#ffffff", "decimalPlaces": 2 },
			"value": { "color": "#adadad", "fontSize": labelFontSize },
			"lines": { "enabled": false },
			formatter: function(ctx) { var label = ctx.label; if (ctx.part == 'value') { return parseInt(ctx.label).toLocaleString() + " DCR"; } return label; }
		},
		"effects": { "load": {
			"effect": "default", // none / default
			"speed": 750
		}, "pullOutSegmentOnClick": { "effect": "linear", "speed": 400, "size": 8 } },
		"misc": { 
			"colors": {
				"background": null,
				"segments": colorsHsv,
				"segmentStroke": "#ffffff"
			},
			"gradient": { "enabled": false, "percentage": 100 } }
	});
}
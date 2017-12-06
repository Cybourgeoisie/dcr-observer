function pullTopAddresses(callback) {
	var filename = (historical_data_block == 190000) ? "./data/top_500_info_list.json?nocache=" + (new Date()).getTime() : "./data/historical/top_500_info_list." + historical_data_block + ".json";

	if (historical_data_block != 190000) {
		$('.historical-block-header').html('At Block ' + parseInt(historical_data_block).toLocaleString());
	} else {
		$('.historical-block-header').html('');
	}

	// Use the API if we're not loading historical data
	if (historical_data_block == 190000) {
		if (!MAINTENANCE_MODE) {
			pullTopAddressesFromApi(callback);
			return;
		}
	}

	$.getJSON(filename, function(data) {
		// Handle callbacks
		if (callback && typeof callback === 'function') {
			callback.call(this);
		}

		var $top_address_table = $('.table-addresses');
		var $top_address_tbody = $top_address_table.find('tbody');
		var $top_address_row = $top_address_table.find('tr:last').clone(true).show();

		// Clear the existing data
		$top_address_tbody.html('');

		// Pull the total supply
		var total_dcr = parseFloat(data.total_dcr);

		// Now display them all
		var sum_balance = 0, rank = 0;
		for (var address in data.top) {
			if (!data.top.hasOwnProperty(address)) {
				continue;
			}

			var address_info = data.top[address];
			rank++;

			var balance = parseFloat(address_info.val);
			sum_balance += balance;
			balance = balance.toFixed(1);

			var num_tx  = parseFloat(address_info.tx);
			var num_stx = parseFloat(address_info.stx);
			var pct_stx = ((num_stx/num_tx)*100).toFixed(2);

			var pct = ((parseFloat(address_info.val) / total_dcr) * 100).toFixed(2);

			var $new_row = $top_address_row.clone(true);
			$new_row.find('th').html(rank);
			$new_row.find('td.top-td-address > a').html(address).data('address', address).attr('href', '#addr=' + address);
			$new_row.find('td.top-td-balance > .top-balance').html(parseInt(balance).toLocaleString());
			$new_row.find('td.top-td-percent').html(pct + '%');
			$new_row.find('td.top-td-num-tx').html(num_tx);
			$new_row.find('td.top-td-pct-stx').html(pct_stx + '%');

			// Hide unhandled items
			$new_row.find('.top-td-badge-address-miner').hide();
			$new_row.find('.top-td-badge-address-ticket').hide();
			$new_row.find('.top-td-badge-address-actively-staking').hide();

			// If the address has an identifier, display it
			$new_row.find('.top-td-badge-address-identifier').hide();
			$new_row.find('.top-td-addr-identifier').html('');
			if (address_info.hasOwnProperty('identifier')) {
				$new_row.find('.top-td-badge-address-identifier').show();
				$new_row.find('.top-td-addr-identifier').html(address_info.identifier);
			}

			// Only display first 10 addresses by default
			if (rank > 10) {
				$new_row.hide();
			}

			$top_address_tbody.append($new_row);
		}

		// Reset the "show all 500" button
		$('button.show-all-500').removeAttr('disabled').html('Show All 500');

		// Set the "show all 500" button to do something
		$('button.show-all-500').off();
		$('button.show-all-500').click(function(event) {
			$('.table-addresses tr').show();
			$('button.show-all-500').attr("disabled", "disabled").html('Showing All 500');
		});

		// Show totals and percentages
		$('.top-sum').html(parseInt(sum_balance).toLocaleString());
		$('.total-dcr').html(parseInt(total_dcr).toLocaleString());

		var sum_percent = ((sum_balance / total_dcr) * 100).toFixed(2);
		$('.top-sum-percent').html(sum_percent + '%');
	});
}

function pullTopAddressesFromApi(callback) {
	$.post('api/Address/getTop')
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		// Handle callbacks
	 		if (callback && typeof callback === 'function') {
	 			callback.call(this);
	 		}

	 		// Get the DOM elements we're modifying
	 		var $top_address_table = $('.table-addresses');
			var $top_address_tbody = $top_address_table.find('tbody');
			var $top_address_row = $top_address_table.find('tr:last').clone(true).show();

			// Clear the existing data
			$top_address_tbody.html('');

	 		// Display
	 		var sum_balance = 0;
			for (var i = 0; i < data.top.length; i++) {
				var address_info = data.top[i];
				var address      = address_info['address'];

				var balance = parseFloat(address_info.balance);
				sum_balance += balance;
				balance = balance.toFixed(1);

				var num_tx  = parseFloat(address_info.tx);
				var num_stx = parseFloat(address_info.stx);
				var pct_stx = ((num_stx/num_tx)*100).toFixed(2);

				var pct = ((parseFloat(address_info.balance) / total_dcr) * 100).toFixed(2);

				var $new_row = $top_address_row.clone(true);
				$new_row.find('th').html(address_info.rank);
				$new_row.find('td.top-td-address > a').html(address).data('address', address).attr('href', '#addr=' + address);
				$new_row.find('td.top-td-balance > .top-balance').html(parseInt(balance).toLocaleString());
				$new_row.find('td.top-td-percent').html(pct + '%');
				$new_row.find('td.top-td-num-tx').html(num_tx);
				$new_row.find('td.top-td-pct-stx').html(pct_stx + '%');

				// Remove all break tags from the info section
				$new_row.find('.top-td-info').find('br').remove();

				// If the address has an identifier, display it
				$new_row.find('.top-td-badge-address-identifier').hide();
				$new_row.find('.top-td-addr-identifier').html('');
				if (address_info.hasOwnProperty('identifier') && address_info.identifier) {
					$new_row.find('.top-td-badge-address-identifier').show();
					$new_row.find('.top-td-addr-identifier').html(address_info.identifier);
					$new_row.find('.top-td-badge-address-identifier').after('<br />');
				}

				// If the address is mining, display it
				$new_row.find('.top-td-badge-address-miner').hide();
				$new_row.find('.top-td-addr-miner').html('');
				if (address_info.hasOwnProperty('miner') && address_info.miner) {
					$new_row.find('.top-td-badge-address-miner').show();
					$new_row.find('.top-td-addr-miner').html(address_info.miner);
					$new_row.find('.top-td-badge-address-miner').after('<br />');
				}

				// If the address is a ticket, display it
				$new_row.find('.top-td-badge-address-ticket').hide();
				$new_row.find('.top-td-addr-ticket').html('');
				if (address_info.hasOwnProperty('ticket') && address_info.ticket) {
					$new_row.find('.top-td-badge-address-ticket').show();
					$new_row.find('.top-td-addr-ticket').html(address_info.ticket);
					$new_row.find('.top-td-badge-address-ticket').after('<br />');
				}

				// If the address is actively staking, make note of it
				$new_row.find('.top-td-badge-address-actively-staking').hide();
				if (address_info.hasOwnProperty('actively_staking') && address_info.actively_staking == 't') {
					$new_row.find('.top-td-badge-address-actively-staking').show();
				}

				// Only display first 10 addresses by default
				if (i >= 10) {
					$new_row.hide();
				}

				$top_address_tbody.append($new_row);
			}

			// Reset the "show all 500" button
			$('button.show-all-500').removeAttr('disabled').html('Show All 500');

			// Set the "show all 500" button to do something
			$('button.show-all-500').off();
			$('button.show-all-500').click(function(event) {
				$('.table-addresses tr').show();
				$('button.show-all-500').attr("disabled", "disabled").html('Showing All 500');
			});

			// Show totals and percentages
			$('.top-sum').html(parseInt(sum_balance).toLocaleString());
			$('.total-dcr').html(parseInt(total_dcr).toLocaleString());

			var sum_percent = ((sum_balance / total_dcr) * 100).toFixed(2);
			$('.top-sum-percent').html(sum_percent + '%');
	 	}
	});
}

function pullTopNetworks(callback) {
	var filename = (historical_data_block == 190000) ? "./data/top_500_networks_list.json?nocache=" + (new Date()).getTime() : "./data/historical/top_500_networks_list." + historical_data_block + ".json";

	if (historical_data_block != 190000) {
		$('.historical-block-header').html('At Block ' + parseInt(historical_data_block).toLocaleString());
	} else {
		$('.historical-block-header').html('');
	}

	// Use the API if we're not loading historical data
	if (historical_data_block == 190000) {
		if (!MAINTENANCE_MODE) {
			pullTopNetworksFromApi(callback);
			return;
		}
	}

	$.getJSON(filename, function(data) {
		// Handle callbacks
		if (callback && typeof callback === 'function') {
			callback.call(this);
		}

		var $top_networks_table = $('.table-networks');
		var $top_networks_tbody = $top_networks_table.find('tbody');
		var $top_networks_row = $top_networks_table.find('tr:last').clone(true).show();

		// Clear the existing data
		$top_networks_tbody.html('');

		// Pull the total supply
		var total_dcr = data.total_dcr;

		// Sort the list by value
		data.top.sort(function(a, b) {return b[1] - a[1];});

		// Now display them all
		var sum_balance = 0;
		for (var i = 0; i < data.top.length; i++) {
			var address = data.top[i][3];
			var rank = i+1;

			var balance = parseFloat(data.top[i][1]);
			sum_balance += balance;
			balance = balance.toFixed(1);

			var num_addrs = parseInt(data.top[i][2]);

			var pct = ((parseFloat(balance) / total_dcr) * 100).toFixed(2);

			var $new_row = $top_networks_row.clone(true);
			$new_row.find('th').html(rank);
			$new_row.find('td.top-hd-td-top-address > a').html(address).data('address', address).attr('href', '#addr=' + address);
			$new_row.find('td.top-hd-td-balance > .top-hd-balance').html(parseInt(balance).toLocaleString());
			$new_row.find('td.top-hd-td-percent').html(pct + '%');
			$new_row.find('td.top-hd-td-num-addrs').html(num_addrs);

			// Hide unhandled items
			$new_row.find('.top-hd-td-badge-address-miner').hide();
			$new_row.find('.top-hd-td-badge-address-ticket').hide();
			$new_row.find('.top-hd-td-badge-address-actively-staking').hide();

			// If the address has an identifier, display it
			$new_row.find('.top-hd-td-badge-address-identifier').hide();
			$new_row.find('.top-hd-td-addr-identifier').html('');
			if (data.top[i].length > 4) {
				$new_row.find('.top-hd-td-badge-address-identifier').show();
				$new_row.find('.top-hd-td-addr-identifier').html(data.top[i][4]);
			}

			// Only display first 10 addresses by default
			if (i >= 10) {
				$new_row.hide();
			}

			$top_networks_tbody.append($new_row);
		}

		// Reset the "show all 500" button
		$('button.show-all-500-hd').removeAttr('disabled').html('Show All 500');

		// Set the "show all 500" button to do something
		$('button.show-all-500-hd').off();
		$('button.show-all-500-hd').click(function(event) {
			$('.table-networks tr').show();
			$('button.show-all-500-hd').attr("disabled", "disabled").html('Showing All 500');
		});

		// Show totals and percentages
		$('.top-hd-sum').html(parseInt(sum_balance).toLocaleString());
		$('.total-dcr').html(parseInt(total_dcr).toLocaleString());

		var sum_percent = ((sum_balance / total_dcr) * 100).toFixed(2);
		$('.top-hd-sum-percent').html(sum_percent + '%');
	});
}

function pullTopNetworksFromApi(callback) {
	$.post('api/Address/getTopNetworks')
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		// Handle callbacks
	 		if (callback && typeof callback === 'function') {
	 			callback.call(this);
	 		}

	 		// Get the DOM elements we're modifying
	 		var $top_networks_table = $('.table-networks');
			var $top_networks_tbody = $top_networks_table.find('tbody');
			var $top_networks_row = $top_networks_table.find('tr:last').clone(true).show();

			// Clear the existing data
			$top_networks_tbody.html('');

	 		// Display
	 		var sum_balance = 0;
			for (var i = 0; i < data.top.length; i++) {
				var network_info = data.top[i];
				var address      = network_info['address'];

				var balance = parseFloat(network_info.balance);
				sum_balance += balance;
				balance = balance.toFixed(1);

				var num_addrs = network_info.num_addresses;

				var pct = ((parseFloat(network_info.balance) / total_dcr) * 100).toFixed(2);

				var $new_row = $top_networks_row.clone(true);
				$new_row.find('th').html(network_info.rank);
				$new_row.find('td.top-hd-td-top-address > a').html(address).data('address', address).attr('href', '#hd-addr=' + address);
				$new_row.find('td.top-hd-td-balance > .top-hd-balance').html(parseInt(balance).toLocaleString());
				$new_row.find('td.top-hd-td-percent').html(pct + '%');
				$new_row.find('td.top-hd-td-num-addrs').html(num_addrs);

				// Remove all break tags from the info section
				$new_row.find('.top-hd-td-info').find('br').remove();

				// If the address has an identifier, display it
				$new_row.find('.top-hd-td-badge-address-identifier').hide();
				$new_row.find('.top-hd-td-addr-identifier').html('');
				if (network_info.hasOwnProperty('identifier') && network_info.identifier) {
					$new_row.find('.top-hd-td-badge-address-identifier').show();
					$new_row.find('.top-hd-td-addr-identifier').html(network_info.identifier);
					$new_row.find('.top-hd-td-badge-address-identifier').after('<br />');
				}

				// If the address is mining, display it
				$new_row.find('.top-hd-td-badge-address-miner').hide();
				$new_row.find('.top-hd-td-addr-miner').html('');
				if (network_info.hasOwnProperty('miner') && network_info.miner) {
					$new_row.find('.top-hd-td-badge-address-miner').show();
					$new_row.find('.top-hd-td-addr-miner').html(network_info.miner);
					$new_row.find('.top-hd-td-badge-address-miner').after('<br />');
				}

				// If the address is a ticket, display it
				$new_row.find('.top-hd-td-badge-address-ticket').hide();
				$new_row.find('.top-hd-td-addr-ticket').html('');
				if (network_info.hasOwnProperty('ticket') && network_info.ticket) {
					$new_row.find('.top-hd-td-badge-address-ticket').show();
					$new_row.find('.top-hd-td-addr-ticket').html(network_info.ticket);
					$new_row.find('.top-hd-td-badge-address-ticket').after('<br />');
				}

				// If the address is actively staking, make note of it
				$new_row.find('.top-hd-td-badge-address-actively-staking').hide();
				if (network_info.hasOwnProperty('actively_staking') && network_info.actively_staking == 't') {
					$new_row.find('.top-hd-td-badge-address-actively-staking').show();
				}

				// Only display first 10 addresses by default
				if (i >= 10) {
					$new_row.hide();
				}

				$top_networks_tbody.append($new_row);
			}

			// Reset the "show all 500" button
			$('button.show-all-500-hd').removeAttr('disabled').html('Show All 500');

			// Set the "show all 500" button to do something
			$('button.show-all-500-hd').off();
			$('button.show-all-500-hd').click(function(event) {
				$('.table-networks tr').show();
				$('button.show-all-500-hd').attr("disabled", "disabled").html('Showing All 500');
			});

			// Show totals and percentages
			$('.top-hd-sum').html(parseInt(sum_balance).toLocaleString());
			$('.total-dcr').html(parseInt(total_dcr).toLocaleString());

			var sum_percent = ((sum_balance / total_dcr) * 100).toFixed(2);
			$('.top-hd-sum-percent').html(sum_percent + '%');
	 	}
	});
}
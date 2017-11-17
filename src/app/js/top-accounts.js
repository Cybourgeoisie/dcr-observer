function pullTopAddresses(callback) {
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

			// Reset the "show all 500" button
			$('button.show-all-500').removeAttr('disabled').html('Show All 500');

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
	 	}
	});
}

function pullTopNetworks() {
	var $top_networks_table = $('.table-networks');
	var $top_networks_tbody = $top_networks_table.find('tbody');
	var $top_networks_row = $top_networks_table.find('tr:last').clone(true);

	// Clear the existing data
	$top_networks_tbody.html('');

	$.getJSON("./data/top_500_networks_list.json", function(data) {
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
			$new_row.find('td.top-hd-td-balance').html(parseInt(balance).toLocaleString() + ' DCR');
			$new_row.find('td.top-hd-td-percent').html(pct + '%');
			$new_row.find('td.top-hd-td-num-addrs').html(num_addrs);

			// Only display first 10 addresses by default
			if (i >= 10) {
				$new_row.hide();
			}

			$top_networks_tbody.append($new_row);
		}

		// Set the "show all 500" button to do something
		$('button.show-all-500-hd').click(function(event) {
			$('.table-networks tr').show();
			$('button.show-all-500-hd').attr("disabled", "disabled").html('Showing All 500');
		});

		// Show totals and percentages
		$('.top-hd-sum').html(parseInt(sum_balance).toLocaleString());
		$('.total-dcr').html(parseInt(total_dcr).toLocaleString());

		var sum_percent = ((sum_balance / total_dcr) * 100).toFixed(2);
		$('.top-hd-sum-percent').html(sum_percent + '%');

		// Store the top addresses outside of this function for the address page
		//address_store = data.top;
	});
}
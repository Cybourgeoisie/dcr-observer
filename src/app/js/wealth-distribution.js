function pullWealthDistribution(callback) {
	var filename = (historical_data_block == 190000) ? "./data/wealth_distribution.json?nocache=" + (new Date()).getTime() : "./data/historical/wealth_distribution." + historical_data_block + ".json";

	if (historical_data_block != 190000) {
		$('.dist-lead').html('The Decred address wealth distribution at block ' + parseInt(historical_data_block).toLocaleString() + '.');
	} else {
		$('.dist-lead').html('The current Decred address wealth distribution.');
	}

	// Use the API if we're not loading historical data
	if (historical_data_block == 190000) {
		pullWealthDistributionFromApi(callback);
		return;
	}

	$.getJSON(filename, function(data) {
		// Handle callbacks
		if (callback && typeof callback === 'function') {
			callback.call(this);
		}

		var $distrib_table = $('.table-distribution');
		var $distrib_tbody = $distrib_table.find('tbody');
		var $distrib_row = $distrib_table.find('tr:last').clone(false);

		// Clear the existing data
		$distrib_tbody.html('');

		// Pull the total supply
		var bins      = data.bins;
		var counts    = data.counts;
		var values    = data.value;

		// Get the total wallets count
		var total_wallets = 0, total_dcr = 0;
		for (var i = 0; i < counts.length; i++) {
			total_wallets += counts[i];
			total_dcr += values[i];
		}

		// Now display them all
		for (var i = 0; i < bins.length; i++) {
			var bin;
			if (i == 0) {
				bin = "0* to " + parseInt(bins[i]).toLocaleString() + " DCR";
			} else {
				bin = parseInt(bins[i-1]).toLocaleString() + " to " + parseInt(bins[i]).toLocaleString() + " DCR";
			}

			var count = counts[i];
			var value = values[i];

			var pct_wallets = ((parseFloat(count) / total_wallets) * 100).toFixed(4);
			var pct_dcr = ((parseFloat(value) / total_dcr) * 100).toFixed(2);

			var $new_row = $distrib_row.clone(false);
			$new_row.find('th').html(bin);
			$new_row.find('td.td-num-addrs').html(parseInt(count).toLocaleString());
			$new_row.find('td.td-pct-addrs .wealth-pct-addrs').html(pct_wallets + "%");
			$new_row.find('td.td-pct-addrs .progress-bar').css('width', pct_wallets + '%');
			$new_row.find('td.td-sum').html(parseInt(value).toLocaleString() + " DCR");
			//$new_row.find('td.td-sum-value').html();
			$new_row.find('td.td-pct-supply .wealth-pct-supply').html(pct_dcr + "%");
			$new_row.find('td.td-pct-supply .progress-bar').css('width', pct_dcr + '%');
			$distrib_tbody.append($new_row);
		}
	});
}

function pullWealthDistributionFromApi(callback) {
	$.post('api/Address/getWealth')
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		// Handle callbacks
	 		if (callback && typeof callback === 'function') {
	 			callback.call(this);
	 		}

			var $distrib_table = $('.table-distribution');
			var $distrib_tbody = $distrib_table.find('tbody');
			var $distrib_row = $distrib_table.find('tr:last').clone(false);

			// Clear the existing data
			$distrib_tbody.html('');

			// Get the total address count
			var total_accts = 0;
			for (var i = 0; i < data.wealth.length; i++) {
				total_accts += parseInt(data.wealth[i]['num_addresses']);
			}

			// Now display them all
			for (var i = 0; i < data.wealth.length; i++) {
				var bin;
				if (i == 0) {
					bin = "0* to " + parseInt(Math.pow(10, data.wealth[i]['bin'])).toLocaleString() + " DCR";
				} else {
					bin = parseInt(Math.pow(10, data.wealth[i-1]['bin'])).toLocaleString() + " to " + parseInt(Math.pow(10, data.wealth[i]['bin'])).toLocaleString() + " DCR";
				}

				var count = data.wealth[i]['num_addresses'];
				var value = data.wealth[i]['total_balance'];

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
		}
	});
}

function pullWealthDistributionNetworks(callback) {
	var filename = (historical_data_block == 190000) ? "./data/wealth_distribution_networks.json?nocache=" + (new Date()).getTime() : "./data/historical/wealth_distribution_networks." + historical_data_block + ".json";

	if (historical_data_block != 190000) {
		$('.dist-hd-lead').html('The Decred wealth distribution by connected addresses at block ' + parseInt(historical_data_block).toLocaleString() + '.');
	} else {
		$('.dist-hd-lead').html('The current Decred wealth distribution by connected addresses.');
	}

	// Use the API if we're not loading historical data
	if (historical_data_block == 190000) {
		pullWealthDistributionNetworksFromApi(callback);
		return;
	}

	$.getJSON(filename, function(data) {
		// Handle callbacks
		if (callback && typeof callback === 'function') {
			callback.call(this);
		}

		var $distrib_table = $('.table-distribution-hd');
		var $distrib_tbody = $distrib_table.find('tbody');
		var $distrib_row = $distrib_table.find('tr:last').clone(false);

		// Clear the existing data
		$distrib_tbody.html('');

		// Pull the total supply
		var bins      = data.bins;
		var counts    = data.counts;
		var values    = data.value;

		// Get the total wallets count
		var total_wallets = 0, total_dcr = 0;
		for (var i = 0; i < counts.length; i++) {
			total_wallets += counts[i];
			total_dcr += values[i];
		}

		// Now display them all
		for (var i = 0; i < bins.length; i++) {
			var bin;
			if (i == 0) {
				bin = "0* to " + parseInt(bins[i]).toLocaleString() + " DCR";
			} else {
				bin = parseInt(bins[i-1]).toLocaleString() + " to " + parseInt(bins[i]).toLocaleString() + " DCR";
			}

			var count = counts[i];
			var value = values[i];

			var pct_wallets = ((parseFloat(count) / total_wallets) * 100).toFixed(4);
			var pct_dcr = ((parseFloat(value) / total_dcr) * 100).toFixed(2);

			var $new_row = $distrib_row.clone(false);
			$new_row.find('th').html(bin);
			$new_row.find('td.td-hd-num-wallets').html(parseInt(count).toLocaleString());
			$new_row.find('td.td-hd-pct-wallets .wealth-hd-pct-wallets').html(pct_wallets + "%");
			$new_row.find('td.td-hd-pct-wallets .progress-bar').css('width', pct_wallets + '%');
			$new_row.find('td.td-hd-sum').html(parseInt(value).toLocaleString() + " DCR");
			//$new_row.find('td.td-sum-value').html();
			$new_row.find('td.td-hd-pct-supply .wealth-hd-pct-supply').html(pct_dcr + "%");
			$new_row.find('td.td-hd-pct-supply .progress-bar').css('width', pct_dcr + '%');
			$distrib_tbody.append($new_row);
		}
	});
}

function pullWealthDistributionNetworksFromApi(callback) {
	$.post('api/Address/getWealthNetworks')
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		// Handle callbacks
	 		if (callback && typeof callback === 'function') {
	 			callback.call(this);
	 		}

			var $distrib_table = $('.table-distribution-hd');
			var $distrib_tbody = $distrib_table.find('tbody');
			var $distrib_row = $distrib_table.find('tr:last').clone(false);

			// Clear the existing data
			$distrib_tbody.html('');

			// Get the total address count
			var total_wallets = 0;
			for (var i = 0; i < data.wealth.length; i++) {
				total_wallets += parseInt(data.wealth[i]['num_wallets']);
			}

			// Now display them all
			for (var i = 0; i < data.wealth.length; i++) {
				var bin;
				if (i == 0) {
					bin = "0* to " + parseInt(Math.pow(10, data.wealth[i]['bin'])).toLocaleString() + " DCR";
				} else {
					bin = parseInt(Math.pow(10, data.wealth[i-1]['bin'])).toLocaleString() + " to " + parseInt(Math.pow(10, data.wealth[i]['bin'])).toLocaleString() + " DCR";
				}

				var count = data.wealth[i]['num_wallets'];
				var value = data.wealth[i]['total_balance'];

				var pct_accts = ((parseFloat(count) / total_wallets) * 100).toFixed(4);
				var pct_dcr = ((parseFloat(value) / total_dcr) * 100).toFixed(2);

				var $new_row = $distrib_row.clone(false);
				$new_row.find('th').html(bin);
				$new_row.find('td.td-hd-num-wallets').html(parseInt(count).toLocaleString());
				$new_row.find('td.td-hd-pct-wallets .wealth-hd-pct-wallets').html(pct_accts + "%");
				$new_row.find('td.td-hd-pct-wallets .progress-bar').css('width', pct_accts + '%');
				$new_row.find('td.td-hd-sum').html(parseInt(value).toLocaleString() + " DCR");
				//$new_row.find('td.td-hd-sum-value').html();
				$new_row.find('td.td-hd-pct-supply .wealth-hd-pct-supply').html(pct_dcr + "%");
				$new_row.find('td.td-hd-pct-supply .progress-bar').css('width', pct_dcr + '%');
				$distrib_tbody.append($new_row);
			}
		}
	});
}
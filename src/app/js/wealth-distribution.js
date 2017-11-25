function pullWealthDistribution(callback) {
	var filename = (historical_data_block == 190000) ? "./data/wealth_distribution.json?nocache=" + (new Date()).getTime() : "./data/historical/wealth_distribution." + historical_data_block + ".json";

	if (historical_data_block != 190000) {
		$('.dist-lead').html('The Decred address wealth distribution at block ' + parseInt(historical_data_block).toLocaleString() + '.');
	} else {
		$('.dist-lead').html('The current Decred address wealth distribution.');
	}

	// Use the API if we're not loading historical data
	if (historical_data_block == 190000) {
		if (!MAINTENANCE_MODE) {
			// Show the breakdown button
			$('.dist-addr-view-all').show();

			pullWealthDistributionFromApi(callback);
			return;
		}
	}

	// Hide the breakdown button
	$('.dist-addr-view-all').hide();

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
			var bin, range_start, range_end;
			if (i == 0) {
				range_start = 0.01;
				range_end = 1;
				bin = "0* to " + parseInt(bins[i]).toLocaleString() + " DCR";
			} else {
				range_start = parseInt(bins[i-1]);
				range_end = parseInt(bins[i]);
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
			$new_row.find('td.td-view > button').data('range-start', range_start).data('range-end', range_end).attr('disabled', 'disabled');
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
				var bin, range_start, range_end;
				if (i == 0) {
					range_start = 0.01;
					range_end = 1;
					bin = "0* to " + parseInt(Math.pow(10, data.wealth[i]['bin'])).toLocaleString() + " DCR";
				} else {
					range_start = parseInt(Math.pow(10, data.wealth[i-1]['bin']));
					range_end = parseInt(Math.pow(10, data.wealth[i]['bin']));
					bin = parseInt(Math.pow(10, data.wealth[i-1]['bin'])).toLocaleString() + " to " + parseInt(Math.pow(10, data.wealth[i]['bin'])).toLocaleString() + " DCR";
				}

				var count = data.wealth[i]['num_addresses'];
				var value = data.wealth[i]['total_balance'];

				var pct_accts = ((parseFloat(count) / total_accts) * 100).toFixed(4);
				var pct_dcr = ((parseFloat(value) / total_dcr) * 100).toFixed(2);

				var $new_row = $distrib_row.clone(false);
				$new_row.data('source', i);
				$new_row.find('th').html(bin);
				$new_row.find('td.td-num-addrs').html(parseInt(count).toLocaleString());
				$new_row.find('td.td-pct-addrs .wealth-pct-addrs').html(pct_accts + "%");
				$new_row.find('td.td-pct-addrs .progress-bar').css('width', pct_accts + '%');
				$new_row.find('td.td-sum').html(parseInt(value).toLocaleString() + " DCR");
				//$new_row.find('td.td-sum-value').html();
				$new_row.find('td.td-pct-supply .wealth-pct-supply').html(pct_dcr + "%");
				$new_row.find('td.td-pct-supply .progress-bar').css('width', pct_dcr + '%');
				$new_row.find('td.td-view > button').data('range-start', range_start).data('range-end', range_end).removeAttr('disabled');
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
		if (!MAINTENANCE_MODE) {
			$('.dist-hd-addr-view-all').show();
			pullWealthDistributionNetworksFromApi(callback);
			return;
		}
	}

	// Hide the breakdown button
	$('.dist-hd-addr-view-all').hide();

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
			$new_row.find('td.td-hd-view > button').attr('disabled', 'disabled');
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
				var bin, range_start, range_end;
				if (i == 0) {
					range_start = 0.01;
					range_end = 1;
					bin = "0* to " + parseInt(Math.pow(10, data.wealth[i]['bin'])).toLocaleString() + " DCR";
				} else {
					range_start = parseInt(Math.pow(10, data.wealth[i-1]['bin']));
					range_end = parseInt(Math.pow(10, data.wealth[i]['bin']));
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
				$new_row.find('td.td-hd-view > button').data('range-start', range_start).data('range-end', range_end).removeAttr('disabled');
				$distrib_tbody.append($new_row);
			}
		}
	});
}

function getWealthDistributionPie($modal, $source) {
	// Display the loader
	$modal.find('.modal-data-loading').show();

	// Pull the ranges from the data source
	var range_start = parseFloat($source.data('range-start'));
	var range_end = parseFloat($source.data('range-end'));

	// Determine if we're getting networks or addresses
	var api_address;
	if ($source.data('origin') == 'dist-addr') {
		api_address = 'api/Address/getWealthAddressesBetweenRanges';
		$modal.find('.modal-title').html('Wealth Breakdown By Address');
	} else {
		api_address = 'api/Address/getWealthNetworksBetweenRanges';
		$modal.find('.modal-title').html('Wealth Breakdown By Wallet');
	}

	$.post(api_address, {range_start: range_start, range_end: range_end})
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		// Hide the loader
			$modal.find('.modal-data-loading').hide();

	 		// Load the pie
	 		showWealthDistributionPie(data);
	 	}
	});
}

function showWealthDistributionPie(results) {
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

	var title = "Wealth Breakdown";
	var subtitle = (results.bin == '0 to 100,000,000 DCR') ? "All Decred" : results.bin;

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
			"sortOrder": "none",
			"content": contentData
		},
		"labels": {
			"outer": { "format": "label-value2", "pieDistance": 12, "hideWhenLessThanPercentage": 1 },
			"inner": { "hideWhenLessThanPercentage": 1 },
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
		"misc": { "gradient": { "enabled": false, "percentage": 100 } }
	});
}

function pullVoteResultsFromApi(rci, callback) {
	$.post('api/Voting/getVotingResults', {rci : rci})
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		// Handle callbacks
	 		if (callback && typeof callback === 'function') {
	 			callback.call(this);
	 		}

	 		if (data.rci <= 0) {
	 			$('.vote-results-range').html('All Time');
	 			$('.vote-results-range-description').html('The Decred agenda vote results for blocks 4,096 to now.');
	 		} else {
	 			$('.vote-results-range').html('RCI #' + data.rci);
	 			$('.vote-results-range-description').html('The Decred agenda vote results for blocks ' + (parseInt(data.block_start)).toLocaleString() + ' to ' + (parseInt(data.block_end)).toLocaleString() + '.');
	 		}

	 		// Get the vote results
	 		var results = data.results;

	 		// Clear version overview
	 		var $container = $('.vote-results-version-overview');
	 		var $row = $container.find('.row:last').clone(true);
	 		$container.html('');

	 		// Version overview
	 		var versions = results.versions, version_data = [];
	 		for (var version in versions) {
	 			if (versions.hasOwnProperty(version)) {
	 				version_data.push({"label" : 'Version ' + version, "value": parseInt(versions[version])});

	 				var $new_row = $row.clone(true);
	 				$new_row.find('.vote-results-version-title').html('Version ' + version);
	 				$new_row.find('.vote-results-version-value').html(versions[version].toLocaleString());
	 				$container.append($new_row);
	 			}
	 		}

	 		var rci_str = '';
	 		if (data.rci > 0) {
	 			rci_str = data.rci;
	 		}

	 		$('.vote-results-summary-versions').data('rci', rci_str).data('results', JSON.stringify(version_data));

	 		// Clear vote summary
			var $table = $('.table-vote-results-summary');
			var $tbody = $table.find('tbody');
			var $row = $table.find('tr:last').clone(false).show();

			// Clear the existing data
			$tbody.html('');

			// Now display them all
			var summary = results.vote_summary;
			for (var item in summary) {
				if (summary.hasOwnProperty(item)) {
					// If there's something worth showing, let's show it
					var sum = (summary[item].abstain + summary[item].yes + summary[item].no);
					if (sum <= 0) {
						continue;
					}

					var yes_pct     = (parseFloat(summary[item].yes)     / sum)*100;
					var no_pct      = (parseFloat(summary[item].no)      / sum)*100;
					var abstain_pct = (parseFloat(summary[item].abstain) / sum)*100;

					var $new_row = $row.clone(false);
					$new_row.find('th.vote-results-summary-version').html(summary[item].version);
					$new_row.find('td.vote-results-summary-issue').html(summary[item].issue);
					$new_row.find('td.vote-results-summary-yes').html(summary[item].yes.toLocaleString() + ' (' + yes_pct.toLocaleString() + '%)');
					$new_row.find('td.vote-results-summary-no').html(summary[item].no.toLocaleString() + ' (' + no_pct.toLocaleString() + '%)');
					$new_row.find('td.vote-results-summary-abstain').html(summary[item].abstain.toLocaleString() + ' (' + abstain_pct.toLocaleString() + '%)');
					
					// Attach the data for graphing
					var data = [
						{"label" : 'Yes', "value" : parseInt(summary[item].yes)},
						{"label" : 'No', "value" : parseInt(summary[item].no)},
						{"label" : 'Abstain', "value" : parseInt(summary[item].abstain)}
					]
					$new_row.find('.vote-results-summary-graph-issue').data('issue', summary[item].issue).data('version', summary[item].version).data('results', JSON.stringify(data));

					$tbody.append($new_row);
				}
			}

			/*
			// Reset the "show all 200" button
			$('button.show-all-voting-200').removeAttr('disabled').html('Show All 200');

			// Set the "show all 500" button to do something
			$('button.show-all-voting-200').click(function(event) {
				$('.table-distribution-voting tr').show();
				$('button.show-all-voting-200').attr("disabled", "disabled").html('Showing All 200');
			});

			// Top number
			var top_hardcode = 200;

			// Show totals and percentages
			$('.top-votes').html(parseInt(top_count).toLocaleString());
			$('.total-votes').html(parseInt(total).toLocaleString());
			$('.top-voters').html(top_hardcode);
			$('.total-voters').html(parseInt(total_addresses).toLocaleString());

			var sum_percent_votes = ((top_count / total) * 100).toFixed(2);
			$('.top-votes-percent').html(sum_percent_votes + '%');

			var sum_percent_vote_addresses = ((top_hardcode / total_addresses) * 100).toFixed(2);
			$('.top-voters-percent').html(sum_percent_vote_addresses + '%');
			*/
		}
	});
}

function pullTicketDistributionFromApi(callback) {
	$.post('api/Voting/getTopAddresses')
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		// Handle callbacks
	 		if (callback && typeof callback === 'function') {
	 			callback.call(this);
	 		}

			var $distrib_table = $('.table-distribution-voting');
			var $distrib_tbody = $distrib_table.find('tbody');
			var $distrib_row = $distrib_table.find('tr:last').clone(false).show();

			// Clear the existing data
			$distrib_tbody.html('');

			// Get the totals
			var total = data.total;
			var total_addresses = data.total_addresses;

			// Now display them all
			var top_count = 0;
			for (var i = 0; i < data.top.length; i++) {
				var record = data.top[i];
				top_count += parseInt(record.num);
				var pct = (parseFloat(record.num) / parseFloat(total) * 100.0).toFixed(2);

				var $new_row = $distrib_row.clone(false);
				$new_row.find('th').html(i+1);
				$new_row.find('td.td-voting-address > a').html(record.address).attr('href', '#addr=' + record.address);
				$new_row.find('td.td-voting-num').html(parseInt(record.num));
				$new_row.find('td.td-voting-pct').html(pct + "%");

				// Only display first 10 addresses by default
				if (i >= 10) {
					$new_row.hide();
				}

				$distrib_tbody.append($new_row);
			}

			// Reset the "show all 200" button
			$('button.show-all-voting-200').removeAttr('disabled').html('Show All 200');

			// Set the "show all 500" button to do something
			$('button.show-all-voting-200').click(function(event) {
				$('.table-distribution-voting tr').show();
				$('button.show-all-voting-200').attr("disabled", "disabled").html('Showing All 200');
			});

			// Top number
			var top_hardcode = 200;

			// Show totals and percentages
			$('.top-votes').html(parseInt(top_count).toLocaleString());
			$('.total-votes').html(parseInt(total).toLocaleString());
			$('.top-voters').html(top_hardcode);
			$('.total-voters').html(parseInt(total_addresses).toLocaleString());

			var sum_percent_votes = ((top_count / total) * 100).toFixed(2);
			$('.top-votes-percent').html(sum_percent_votes + '%');

			var sum_percent_vote_addresses = ((top_hardcode / total_addresses) * 100).toFixed(2);
			$('.top-voters-percent').html(sum_percent_vote_addresses + '%');
		}
	});
}

function pullTicketNetworkDistributionFromApi(callback) {
	$.post('api/Voting/getTopNetworks')
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		// Handle callbacks
	 		if (callback && typeof callback === 'function') {
	 			callback.call(this);
	 		}

			var $distrib_table = $('.table-distribution-voting-hd');
			var $distrib_tbody = $distrib_table.find('tbody');
			var $distrib_row = $distrib_table.find('tr:last').clone(false).show();

			// Clear the existing data
			$distrib_tbody.html('');

			// Get the totals
			var total = data.total;
			var total_networks = data.total_networks;

			// Now display them all
			var top_count = 0;
			for (var i = 0; i < data.top.length; i++) {
				var record = data.top[i];
				top_count += parseInt(record.num);
				var pct = (parseFloat(record.num) / parseFloat(total) * 100.0).toFixed(2);

				var $new_row = $distrib_row.clone(false);
				$new_row.find('th').html(i+1);
				$new_row.find('td.td-voting-hd-address > a').html(record.address).attr('href', '#hd-addr=' + record.address);
				$new_row.find('td.td-voting-hd-num').html(parseInt(record.num));
				$new_row.find('td.td-voting-hd-pct').html(pct + "%");

				// Only display first 10 addresses by default
				if (i >= 10) {
					$new_row.hide();
				}

				$distrib_tbody.append($new_row);
			}

			// Reset the "show all 200" button
			$('button.show-all-voting-hd-200').removeAttr('disabled').html('Show All 200');

			// Set the "show all 500" button to do something
			$('button.show-all-voting-hd-200').click(function(event) {
				$('.table-distribution-voting-hd tr').show();
				$('button.show-all-voting-hd-200').attr("disabled", "disabled").html('Showing All 200');
			});

			// Top number
			var top_hardcode = 200;

			// Show totals and percentages
			$('.top-votes-hd').html(parseInt(top_count).toLocaleString());
			$('.total-votes-hd').html(parseInt(total).toLocaleString());
			$('.top-voters-hd').html(top_hardcode);
			$('.total-voters-hd').html(parseInt(total_networks).toLocaleString());

			var sum_percent_votes = ((top_count / total) * 100).toFixed(2);
			$('.top-votes-hd-percent').html(sum_percent_votes + '%');

			var sum_percent_vote_networks = ((top_hardcode / total_networks) * 100).toFixed(2);
			$('.top-voters-hd-percent').html(sum_percent_vote_networks + '%');
		}
	});
}

function pullTicketStakePoolDistributionFromApi(callback) {
	$.post('api/Voting/getTopStakeAddresses')
	 .done(function(data) {
	 	if (data.hasOwnProperty('success') && data.success) {
	 		// Handle callbacks
	 		if (callback && typeof callback === 'function') {
	 			callback.call(this);
	 		}

			var $distrib_table = $('.table-distribution-voting-stakesubmission');
			var $distrib_tbody = $distrib_table.find('tbody');
			var $distrib_row = $distrib_table.find('tr:last').clone(false).show();

			// Clear the existing data
			$distrib_tbody.html('');

			// Get the totals
			var total = data.total;
			var total_addresses = data.total_addresses;

			// Now display them all
			var top_count = 0;
			for (var i = 0; i < data.top.length; i++) {
				var record = data.top[i];
				top_count += parseInt(record.num);
				var pct = (parseFloat(record.num) / parseFloat(total) * 100.0).toFixed(2);

				var $new_row = $distrib_row.clone(false);
				$new_row.find('th').html(i+1);
				$new_row.find('td.td-voting-stakesubmission-address > a').html(record.address).attr('href', '#addr=' + record.address);
				$new_row.find('td.td-voting-stakesubmission-num').html(parseInt(record.num));
				$new_row.find('td.td-voting-stakesubmission-pct').html(pct + "%");

				// Only display first 10 addresses by default
				if (i >= 10) {
					$new_row.hide();
				}

				$distrib_tbody.append($new_row);
			}

			// Reset the "show all 200" button
			$('button.show-all-voting-stakesubmission-200').removeAttr('disabled').html('Show All 200');

			// Set the "show all 500" button to do something
			$('button.show-all-voting-stakesubmission-200').click(function(event) {
				$('.table-distribution-voting-stakesubmission tr').show();
				$('button.show-all-voting-stakesubmission-200').attr("disabled", "disabled").html('Showing All 200');
			});

			// Top number
			var top_hardcode = 200;

			// Show totals and percentages
			$('.top-stakesubmission-votes').html(parseInt(top_count).toLocaleString());
			$('.total-stakesubmission-votes').html(parseInt(total).toLocaleString());
			$('.top-stakesubmission-voters').html(top_hardcode);
			$('.total-stakesubmission-voters').html(parseInt(total_addresses).toLocaleString());

			var sum_percent_votes = ((top_count / total) * 100).toFixed(2);
			$('.top-stakesubmission-votes-percent').html(sum_percent_votes + '%');

			var sum_percent_vote_addresses = ((top_hardcode / total_addresses) * 100).toFixed(2);
			$('.top-stakesubmission-voters-percent').html(sum_percent_vote_addresses + '%');
		}
	});
}

function getIssueVoteResultsPie($modal, $source) {
	// Display the loader
	$modal.find('.modal-data-loading').hide();

	var issue = $source.data('issue');

	// Show the title
	if (issue == 'N/A') {
		$modal.find('.modal-title').html('Vote Breakdown for ' + $source.data('version'));
	} else {
		$modal.find('.modal-title').html('Vote Breakdown for ' + $source.data('issue'));		
	}

	// Pull the results
	var data = JSON.parse($source.data('results'));
	var title = $source.data('version');
	var subtitle = (issue == 'N/A') ? '' : $source.data('issue');

	displayVotePie(title, subtitle, data);
}

function getVersionVoteResultsPie($modal, $source) {
	// Display the loader
	$modal.find('.modal-data-loading').hide();
	var rci = $source.data('rci');

	var range = 'All Time';
	if (rci) {
		range = 'RCI #' + rci;
	}

	// Show the title
	$modal.find('.modal-title').html('Version Breakdown for ' + range);

	// Pull the results
	var data = JSON.parse($source.data('results'));
	var title = 'Version Breakdown';
	var subtitle = range;

	displayVotePie(title, subtitle, data);
}

function displayVotePie(title, subtitle, data) {
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
			"content": data
		},
		"labels": {
			"outer": { "format": "label-value2", "pieDistance": 12, "hideWhenLessThanPercentage": 1 },
			"inner": { "hideWhenLessThanPercentage": 1 },
			"mainLabel": { "fontSize": labelFontSize },
			"percentage": { "color": "#ffffff", "decimalPlaces": 2 },
			"value": { "color": "#adadad", "fontSize": labelFontSize },
			"lines": { "enabled": false },
			"truncation": { "enabled": true, "truncateLength":truncateLength }
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
			"gradient": { "enabled": false, "percentage": 100 }
		}
	});
}
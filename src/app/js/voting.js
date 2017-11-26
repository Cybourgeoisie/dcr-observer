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

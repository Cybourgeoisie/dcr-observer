var fs = require('fs');

// Get all top addresses
var addresses = [], address_map = {};
var addr_file = '../../../address_map.full.json';

// If we have a save state, use it
fs.exists(addr_file, function(exists) {
	if (exists) {
		console.log("Pulling data.");
		fs.readFile(addr_file, function(err, data) {
			if (err) {
				console.log("Could not read file.");
				process.exit();
			} else {
				// Pull the save state and restore
				var address_map = JSON.parse(data);

				// Remove the "next_height" parameter
				delete address_map.next_height;

				// Set the addresses
				for (var address in address_map) {
					if (address_map[address] < 0) { continue; }
					addresses.push([address, address_map[address].val]);
				}

				// Notification
				console.log("There are " + addresses.length + " addresses in total.");

				// Order the list
				console.log("Ordering rich list...");
				addresses.sort(function(a, b) {return b[1] - a[1];});

				// Now save the richest 500
				var top_500 = addresses.slice(0,500);
				fs.writeFileSync('top_500_list.json', JSON.stringify(top_500));

				// And determine the wealth distribution
				var bins   = [0, 1, 10, 100, 1000, 10000, 100000, 1000000];
				var counts = [0, 0,  0,   0,    0,     0,      0,       0];
				var value  = [0, 0,  0,   0,    0,     0,      0,       0];
				for (var i = 0; i < addresses.length; i++) {
					for (var j = 0; j < bins.length; j++) {
						if (addresses[i][1] <= bins[j]) {
							value[j] += addresses[i][1];
							counts[j]++;
							break;
						}
					}
				}

				fs.writeFileSync('wealth_distribution.json', JSON.stringify({
					'bins' : bins,
					'counts' : counts,
					'value' : value
				}));

				console.log("Bins: " + bins);
				console.log("Counts: " + counts);
				console.log("Value: " + value);
			}
		});
	}
});


var fs = require('fs');

//var network_file = 'address_network.json';
var network_file = '../../../address_network.json';

var address_networks = {};

// Pull the networks
fs.exists(network_file, function(exists) {
	if (!exists) {
		console.log("No network file found.");
		process.exit();
	} else {
		fs.readFile(network_file, function(err, data) {
			if (err) {
				console.log("Could not read network file.");
				process.exit();
			} else {
				// Pull the networks
				address_networks = JSON.parse(data);

				// Now process the blocks
				produceDbInserts();
			}
		});
	}
});

function produceDbInserts() {
	// Prep for the inserts
	var db_inserts = 'BEGIN;';

	// Notify
	console.log('Beginning compilation.');

	// For each address, collect all unique networks
	var network_addresses = {}, networks = [], addr_count = 0;
	for (var address in address_networks) {
		if (address_networks.hasOwnProperty(address)) {
			addr_count++;

			if (network_addresses.hasOwnProperty(address_networks[address])) {
				// Wrap in a string
				network_addresses[address_networks[address]].push('\'' + address + '\'');
			} else {
				network_addresses[address_networks[address]] = ['\'' + address + '\''];
			}

			if (networks.indexOf(address_networks[address]) === -1) {
				networks.push(address_networks[address]);
			}
		}
	}

	// Notify
	console.log(networks.length + " total networks, " + addr_count + ' total addresses.');

	// Wipe existing networks
	db_inserts += 'TRUNCATE hd_network_address RESTART IDENTITY; TRUNCATE hd_network RESTART IDENTITY;\r\n';

	// One large INSERT for all networks
	db_inserts += 'INSERT INTO hd_network (network) VALUES (' + networks.join(',') + ');\r\n';

	// Now insert all associations
	var num_inserts = 0;
	for (var network in network_addresses) {
		if (network_addresses.hasOwnProperty(network)) {
			if ((++num_inserts)%100000 == 0) {
				console.log("hrtbt@" + num_inserts);
			}

			var addresses = network_addresses[network];

			db_inserts += 'INSERT INTO hd_network_address (hd_network_id, address_id) VALUES (SELECT hn.hd_network_id, ';
			db_inserts += 'a.address_id FROM address a JOIN hd_network hn ON hn.network = ' + network + ' ';
			db_inserts += 'WHERE a.address IN (' + addresses.join(',') + '));';			
		}
	}

	db_inserts += 'ROLLBACK;\r\n';

	// Write the insert file
	var insert_location = './sql_data/hd_networks.sql';
	fs.writeFileSync(insert_location, db_inserts);
}

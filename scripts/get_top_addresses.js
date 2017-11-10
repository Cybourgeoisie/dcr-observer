var fs     = require('fs');
var shell  = require('shelljs');
var dcrd   = '~/go/bin/dcrd';
var dcrctl = '~/go/bin/dcrctl';

// Validate that we have the tools
if (!shell.which(dcrd) || !shell.which(dcrctl)) {
	shell.echo('Sorry, this script requires dcrd and dcrctl');
	shell.exit(1);
}

// Get all top addresses
var addresses = [], address_map = {}, opreturn_vouts = 0;
var savefile  = 'address_map.json';
var blockdir  = './blocks/';

// If we have a save state, use it
fs.exists(savefile, function(exists) {
	if (!exists) {
		startAtBeginning()
	} else {
		console.log("Using save state.");
		fs.readFile(savefile, function(err, data) {
			if (err) {
				console.log("Could not read save state file.");
				process.exit();
			} else {
				// Pull the save state and restore
				var save_state = JSON.parse(data);
				address_map = save_state.address_map;

				// Restore the addresses
				for (var address in address_map) {
					addresses.push(address);
				}

				// Report height
				console.log("Starting at height " + save_state.height + " with " + addresses.length + " addresses.");

				// Now process the blocks
				processBlocks(save_state.height, save_state.nextblockhash);
			}
		});
	}
});

function startAtBeginning() {
	shell.exec(dcrctl + ' getblockhash 1', {'silent':true}, function(code, stdout, stderr) {
		verify(code,stdout,stderr);

		// Now start collecting transactions
		var starting_block_hash = stdout;
		console.log("Starting at beginning, from hash " + starting_block_hash.trim());
		processBlocks(0, starting_block_hash);
	});
}

function processBlocks(height, next_block_hash) {
	if (height == null || !next_block_hash) {
		console.log("Invalid height and block hash to process blocks.");
		process.exit();
	}

	var current_block_hash = "";
	while (next_block_hash) {
		if (height % 500 == 0) {
			saveProgress(height, next_block_hash);
		}

		// Store as the current block hash & height
		current_block_hash = next_block_hash;
		height++;

		// Collect all transactions and move to the next block
		next_block_hash = collectTransactionsAtBlock(current_block_hash);
	}

	// Save the final state
	console.log("Reached end.");
	saveProgress(height-1, current_block_hash);
	// height-1 since we incremented before, prior to validating that the height was legitimate
}

function saveProgress(height, next_block_hash) {
	console.log("At height " + height + ". Address count is " + addresses.length + ". Saving state.");

	// Save our current state
	var save_state = {
		'height' : height,
		'nextblockhash' : next_block_hash,
		'address_map' : address_map
	};

	var save_state_json = JSON.stringify(save_state);
	fs.writeFileSync(savefile, save_state_json);
}


function verify(code, stdout, stderr) {
	if (code < 0) {
		shell.echo('Invalid response.\nCode: ' + code + '\nOut: ' + stdout + '\nError: ' + stderr);
		shell.exit(1);
		process.exit();
	}
}

function collectTransactionsAtBlock(block_hash) {
	// Collect the first block
	var cmd      = dcrctl + ' getblock "' + block_hash.trim() + '" 1 1';
	var getblock = shell.exec(cmd, {'silent':true});
	var code     = getblock.code;
	var stdout   = getblock.stdout;
	var stderr   = getblock.stderr;

	verify(code,stdout,stderr);

	// Collect all transactions
	var block = JSON.parse(stdout);
	var rawtxes = block["rawtx"];

	// Store parts of the block
	var reduced_block = {
		'hash' : block.hash.trim(),
		'height' : block.height,
		'time' : block.time,
		'rawtx' : []
	};

	for (var i = 0; i < rawtxes.length; i++) {
		// Get information about the transaction
		var tx = rawtxes[i];

		// Store parts of the raw tx
		var reduced_tx = {
			'txid' : tx.txid.trim(),
			'locktime' : tx.locktime,
			'expiry' : tx.expiry,
			'vin' : tx.vin,
			'vout' : tx.vout
		};
		reduced_block.rawtx.push(reduced_tx);

		// Get the incoming amounts
		var amount_in = 0;
		for (var j = 0; j < tx.vin.length; j++) {
			amount_in += tx.vin[j].amountin;
		}

		// Get the outgoing amounts & addresses
		var amount_out = 0;
		for (var j = 0; j < tx.vout.length; j++) {
			amount_out += tx.vout[j].value;

			if (!tx.vout[j].scriptPubKey.hasOwnProperty('addresses')) {
				opreturn_vouts += tx.vout[j].value;
			}
			else {
				for (var k = 0; k < tx.vout[j].scriptPubKey.addresses.length; k++) {
					var address = tx.vout[j].scriptPubKey.addresses[k];
					if (!address_map.hasOwnProperty(address)) {
						address_map[address] = 0;
						addresses.push(address);
					}

					address_map[address] += tx.vout[j].value;
				}
			}
		}
	}

	// Save the block to a file
	fs.writeFileSync(blockdir + 'block_' + block.height + '.json', JSON.stringify(reduced_block));

	// Move on to the next block
	return (block.hasOwnProperty('nextblockhash')) ? block.nextblockhash : null;
}
